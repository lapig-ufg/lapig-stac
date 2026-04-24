#!/bin/sh
set -e

# ----------------------------------------------------------------------------
# Injeção do token Mapbox no bundle da SPA (feita em runtime para não vazar
# segredos na imagem publicada).
# ----------------------------------------------------------------------------
if [ -n "$MAPBOX_TOKEN" ]; then
    sed -i "s/__MAPBOX_TOKEN_PLACEHOLDER__/$MAPBOX_TOKEN/g" /usr/share/nginx/html/index.html
fi

# ----------------------------------------------------------------------------
# Validação da variável de conexão com o Postgres.
# ----------------------------------------------------------------------------
if [ -z "$DATABASE_URL" ]; then
    echo "ERRO: DATABASE_URL não está definida. Defina-a no orquestrador (Docker Swarm / zelador)." >&2
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

# Aguarda o Postgres aceitar conexões (até 60s).
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

# ----------------------------------------------------------------------------
# Aplicar migrações do pgstac (idempotente) e carregar o catálogo.
# ----------------------------------------------------------------------------
echo "Aplicando migrações pgstac..."
pypgstac migrate --dsn "$DATABASE_URL"

echo "Carregando collections..."
pypgstac load collections /app/catalog/collections.ndjson --dsn "$DATABASE_URL" --method upsert

echo "Carregando items..."
pypgstac load items /app/catalog/items.ndjson --dsn "$DATABASE_URL" --method upsert

# ----------------------------------------------------------------------------
# Iniciar stac-fastapi-pgstac via uvicorn, ouvindo apenas em localhost; o
# nginx na frente faz o proxy para /api/. root_path=/api faz o FastAPI
# emitir os hrefs com o prefixo correto (elimina o sub_filter antigo).
# ----------------------------------------------------------------------------
export POSTGRES_READ_URL="$DATABASE_URL"
export POSTGRES_WRITE_URL="$DATABASE_URL"

uvicorn stac_fastapi.pgstac.app:app \
    --host 127.0.0.1 --port 7822 \
    --root-path /api \
    --proxy-headers --forwarded-allow-ips='*' \
    --no-server-header &

API_PID=$!

cleanup() {
    kill "$API_PID" 2>/dev/null || true
    nginx -s quit 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
}
trap cleanup TERM INT

# Aguardar a API STAC responder na landing page (até 30s).
echo "Aguardando stac-fastapi iniciar..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:7822/ > /dev/null 2>&1; then
        echo "stac-fastapi pronto na porta 7822"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERRO: stac-fastapi não iniciou em 30s." >&2
        exit 1
    fi
    sleep 1
done

exec nginx -g 'daemon off;'
