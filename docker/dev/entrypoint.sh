#!/bin/sh
set -e

# Entrypoint de desenvolvimento para o serviço `stac-api` do docker-compose.
# Aguarda o Postgres, aplica migrações pgstac, carrega o catálogo montado
# via volume e sobe o stac-fastapi em 0.0.0.0:7822 (acessível na porta
# mapeada do host).

if [ -z "$DATABASE_URL" ]; then
    echo "ERRO: DATABASE_URL não está definida." >&2
    exit 1
fi

# stac-fastapi-pgstac v6+ usa variáveis PG* separadas (padrão libpq).
# Derivamos as variáveis da DATABASE_URL quando o orquestrador não as
# fornece explicitamente — mantém compatibilidade com ambos os modelos.
python - <<'PY' > /tmp/pgenv.sh
import os, shlex, urllib.parse as up
url = up.urlparse(os.environ["DATABASE_URL"])
pairs = {
    "PGUSER": up.unquote(url.username or ""),
    "PGPASSWORD": up.unquote(url.password or ""),
    "PGHOST": url.hostname or "",
    "PGPORT": str(url.port or 5432),
    "PGDATABASE": (url.path or "/").lstrip("/"),
}
for k, v in pairs.items():
    if not os.environ.get(k):
        print(f'export {k}={shlex.quote(v)}')
PY
. /tmp/pgenv.sh
rm -f /tmp/pgenv.sh

echo "Aguardando Postgres aceitar conexões..."
for i in $(seq 1 60); do
    if pg_isready -d "$DATABASE_URL" > /dev/null 2>&1; then
        echo "Postgres pronto."
        break
    fi
    if [ "$i" -eq 60 ]; then
        echo "ERRO: Postgres não respondeu em 60s." >&2
        exit 1
    fi
    sleep 1
done

echo "Aplicando migrações pgstac..."
pypgstac migrate --dsn "$DATABASE_URL"

CATALOG_DIR="${CATALOG_DIR:-/catalog}"

if [ ! -f "$CATALOG_DIR/collections.ndjson" ] || [ ! -f "$CATALOG_DIR/items.ndjson" ]; then
    echo "Gerando ndjson a partir dos JSONs do catálogo..."
    lapig-stac export-ndjson -d "$CATALOG_DIR"
fi

echo "Carregando collections..."
pypgstac load collections "$CATALOG_DIR/collections.ndjson" --dsn "$DATABASE_URL" --method upsert

echo "Carregando items..."
pypgstac load items "$CATALOG_DIR/items.ndjson" --dsn "$DATABASE_URL" --method upsert

# Configuração de root_path é opcional em dev — o nginx local usa /api/
# também, mas o acesso direto em http://localhost:7822 é sem prefixo.
# STAC_CATALOG_LANDING aponta para o catalog.json no volume montado em dev
# (em prod, o arquivo é COPY no Dockerfile e fica em /app/catalog/).
export STAC_CATALOG_LANDING="${STAC_CATALOG_LANDING:-${CATALOG_DIR:-/catalog}/catalog.json}"
cd /app
exec uvicorn stac_api_app:app \
    --host 0.0.0.0 --port 7822 \
    --root-path "${STAC_ROOT_PATH:-}" \
    --proxy-headers --forwarded-allow-ips='*'
