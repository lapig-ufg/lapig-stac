# =============================================================================
# LAPIG STAC — Justfile (pipeline Python + stac-fastapi-pgstac)
# =============================================================================

set dotenv-load

data_dir := "data"
catalog := "catalog"

# ---------- Pipeline ----------------------------------------------------------

# Pipeline completo: scan → STAC JSON → validação → ndjson (pronto p/ pypgstac load)
generate:
    cd pipeline && uv run lapig-stac all -d ../{{ data_dir }} -o ../{{ catalog }}

# Converter TIFFs para COG + gerar thumbnails
convert:
    cd pipeline && uv run lapig-stac convert -d ../{{ data_dir }} -o ../{{ catalog }} --cog-workers 4

# Enriquecer items com metadados reais dos COGs
enrich:
    cd pipeline && uv run lapig-stac enrich -d ../{{ catalog }}

# Validar items STAC (checagem estrutural do pipeline)
validate:
    cd pipeline && uv run lapig-stac validate -d ../{{ catalog }}

# Validar schema oficial STAC 1.1.0 (stac-validator 4.x, recursivo via links)
validate-schema:
    cd pipeline && uv run --extra validate stac-validator validate ../{{ catalog }}/catalog.json --recursive --links --assets

# Validar items em lote (multi-core) — útil para CI com volume alto
validate-batch:
    cd pipeline && find ../{{ catalog }}/items -name '*.json' -print0 | xargs -0 uv run --extra validate stac-validator batch --cores -1 --links --assets

# Linting STAC best-practices (stac-check em ambiente efêmero, v3.x)
lint:
    cd pipeline && uv run --isolated --with 'stac-check>=1.11' stac-check ../{{ catalog }}/catalog.json --recursive --links --assets

# Exportar o catálogo como ndjson (artefato consumido pelo `pypgstac load`).
export-ndjson:
    cd pipeline && uv run lapig-stac export-ndjson -d ../{{ catalog }}

# Carregar o catálogo em uma instância pgstac apontada por DATABASE_URL.
# Útil em dev quando se quer recarregar sem reiniciar o container.
load-pgstac:
    cd pipeline && uv run --extra pgstac lapig-stac load-pgstac -d ../{{ catalog }}

# Pipeline completo: generate → convert → enrich
full: convert enrich generate
    @echo "Pipeline completo executado."

# ---------- Exportação opcional (stac-geoparquet) ---------------------------
#
# Alvo mantido apenas para casos em que se queira publicar o catálogo
# também como stac-geoparquet (útil para clients DuckDB e interoperabilidade
# com ferramentas como rustac / stac-geoparquet).  Não é usado em produção.
export-geoparquet:
    cd pipeline && uv run lapig-stac build-parquet -d ../{{ catalog }}

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

# ---------- Docker Compose ----------------------------------------------------

up:
    docker compose up -d --build

down:
    docker compose down

logs *ARGS:
    docker compose logs -f {{ ARGS }}
