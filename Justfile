# =============================================================================
# LAPIG STAC — Justfile (rustac + pipeline Python)
# =============================================================================

set dotenv-load

data_dir := "data"
catalog := "catalog"

# ---------- Pipeline ----------------------------------------------------------

# Pipeline completo: scan → STAC JSON → validação → GeoParquet
generate:
    cd pipeline && lapig-stac all -d ../{{ data_dir }} -o ../{{ catalog }}

# Converter TIFFs para COG + gerar thumbnails
convert:
    cd pipeline && lapig-stac convert -d ../{{ data_dir }} -o ../{{ catalog }} --cog-workers 4

# Enriquecer items com metadados reais dos COGs
enrich:
    cd pipeline && lapig-stac enrich -d ../{{ catalog }}

# Gerar parquet no formato rustac (stac-geoparquet)
build-parquet:
    cd pipeline && python3 -c " \
    import json, os; \
    out = open('/tmp/stac_items.ndjson', 'w'); \
    [out.write(json.dumps(json.load(open(os.path.join(r,f)))) + '\n') \
     for r,_,fs in os.walk('{{ catalog }}/items') for f in sorted(fs) if f.endswith('.json')]; \
    out.close()" && \
    rustac translate /tmp/stac_items.ndjson {{ catalog }}/items_rustac.parquet -i ndjson -o parquet

# Gerar JSONs de collection limpos para rustac serve
# Remove links navegacionais (self/root/parent/items/item/child/collection)
# para que o rustac regenere dinamicamente sob o domínio oficial; preserva
# apenas os stylesheets, que precisam ser referenciados no clean file.
build-collections:
    cd pipeline && uv run python -c " \
    import json; \
    NAV = {'self', 'root', 'parent', 'items', 'item', 'child', 'collection'}; \
    [( \
        d := json.load(open(f'../{{ catalog }}/collections/{c}.json', encoding='utf-8')), \
        d.__setitem__('links', [l for l in d.get('links', []) if l.get('rel') not in NAV]), \
        json.dump(d, open(f'../{{ catalog }}/{c}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2) \
    ) for c in ('pasture-area', 'pasture-vigor')]"

# Validar items STAC (checagem estrutural do pipeline)
validate:
    cd pipeline && lapig-stac validate -d ../{{ catalog }}

# Validar schema oficial STAC 1.1.0 (stac-validator 4.x, recursivo via links)
validate-schema:
    cd pipeline && uv run --extra validate stac-validator validate ../{{ catalog }}/catalog.json --recursive --links --assets

# Validar items em lote (multi-core) — útil para CI com volume alto
validate-batch:
    cd pipeline && find ../{{ catalog }}/items -name '*.json' -print0 | xargs -0 uv run --extra validate stac-validator batch --cores -1 --links --assets

# Linting STAC best-practices (stac-check em ambiente efêmero, v3.x)
lint:
    cd pipeline && uv run --isolated --with 'stac-check>=1.11' stac-check ../{{ catalog }}/catalog.json --recursive --links --assets

# Instalar dependências Python
pip-install:
    cd pipeline && pip install -e .

# Pipeline completo: generate → convert → enrich → parquet
full: generate convert enrich build-parquet build-collections
    @echo "Pipeline completo executado."

# ---------- Serve (local) -----------------------------------------------------

# Subir stack de desenvolvimento: Postgres + stac-fastapi-pgstac + SPA + nginx.
serve:
    docker compose up -d --build db stac-api

# Parar e remover apenas a stack de desenvolvimento.
stop:
    docker compose down

# Zerar o banco local (volume nomeado pgdata). O próximo `just serve`
# aplicará migrações e recarregará o catálogo do zero.
db-reset:
    docker compose down -v
    docker volume rm -f lapig-stac_pgdata 2>/dev/null || true

# Exportar o catálogo como ndjson (artefato consumido pelo `pypgstac load`).
export-ndjson:
    cd pipeline && uv run lapig-stac export-ndjson -d ../{{ catalog }}

# Carregar o catálogo em uma instância pgstac apontada por DATABASE_URL.
# Útil em dev quando se quer recarregar sem reiniciar o container.
load-pgstac:
    cd pipeline && uv run --extra pgstac lapig-stac load-pgstac -d ../{{ catalog }}

# ---------- Docker Compose ----------------------------------------------------

up:
    docker compose up -d --build

down:
    docker compose down

logs *ARGS:
    docker compose logs -f {{ ARGS }}
