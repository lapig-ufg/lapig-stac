# =============================================================================
# LAPIG STAC — Imagem unificada de produção
# Multi-stage: Angular build (Node) + Python/rustac + nginx
# =============================================================================

# Stage 1: Build Angular
FROM node:22-alpine AS browser-build

WORKDIR /app

COPY browser-v2/package.json browser-v2/package-lock.json ./
RUN npm ci --ignore-scripts

COPY browser-v2/ .
RUN npx ng build --configuration=production

# Stage 2: Imagem final — Python + nginx + rustac + SPA
FROM python:3.12-slim

RUN apt-get update && \
    apt-get install --no-install-recommends -y nginx curl && \
    rm -rf /var/lib/apt/lists/*

# rustac (módulo Python com extensão Rust .abi3.so)
RUN pip install --no-cache-dir rustac==0.9.8

# SPA Angular
COPY --from=browser-build /app/dist/apollo-ng/browser/ /usr/share/nginx/html/

# Catálogo STAC (collections JSON + items parquet + estilos)
COPY catalog/pasture-area.json catalog/pasture-vigor.json /app/catalog/
COPY catalog/items_rustac.parquet /app/catalog/
COPY catalog/styles/ /app/catalog/styles/

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
