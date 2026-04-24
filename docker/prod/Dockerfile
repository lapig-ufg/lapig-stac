# =============================================================================
# LAPIG STAC — Imagem unificada de produção
# Multi-stage: Angular build (Node) + Python/FastAPI + nginx
# =============================================================================

# Stage 1: Build Angular
FROM node:22-alpine AS browser-build

WORKDIR /app

COPY browser-v2/package.json browser-v2/package-lock.json ./
RUN npm ci --ignore-scripts

COPY browser-v2/ .
RUN npx ng build --configuration=production

# Stage 2: Export do catálogo em ndjson (entrada para pypgstac load no boot)
FROM python:3.12-slim AS catalog-ndjson

WORKDIR /pipeline
COPY pipeline/pyproject.toml pipeline/README.md* /pipeline/
COPY pipeline/pipeline /pipeline/pipeline
RUN pip install --no-cache-dir --root-user-action=ignore .

COPY catalog /catalog
RUN lapig-stac export-ndjson -d /catalog

# Stage 3: Imagem final — Python + FastAPI (stac-fastapi-pgstac) + nginx + SPA
FROM python:3.12-slim

RUN apt-get update && \
    apt-get install --no-install-recommends -y nginx curl postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Dependências da API STAC
RUN pip install --no-cache-dir --root-user-action=ignore \
        'stac-fastapi.pgstac==6.2.2' \
        'pypgstac[psycopg]==0.9.6' \
        'uvicorn[standard]==0.32.*'

# SPA Angular
COPY --from=browser-build /app/dist/apollo-ng/browser/ /usr/share/nginx/html/

# Catálogo — estilos (servidos pelo nginx) e ndjson (ingestão no boot).
COPY catalog/styles/ /app/catalog/styles/
COPY --from=catalog-ndjson /catalog/collections.ndjson /app/catalog/collections.ndjson
COPY --from=catalog-ndjson /catalog/items.ndjson /app/catalog/items.ndjson

# version.json (gerado pelo CI)
COPY version.json /app/version.json

# Configuração nginx de produção
COPY docker/prod/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# Entrypoint
COPY docker/prod/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
