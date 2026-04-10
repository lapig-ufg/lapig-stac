# =============================================================================
# LAPIG STAC — Imagem unificada de produção
# Multi-stage: Angular build + rustac binary + nginx
# =============================================================================

# Stage 1: Build Angular
FROM node:22-alpine AS browser-build

WORKDIR /app

COPY browser-v2/package.json browser-v2/package-lock.json ./
RUN npm ci --ignore-scripts

COPY browser-v2/ .
RUN npx ng build --configuration=production

# Stage 2: Extrair binário rustac (Rust estático via PyPI)
FROM python:3.12-slim AS rustac-build

RUN pip install --no-cache-dir rustac==0.9.8

# Stage 3: Imagem final — nginx + rustac + SPA
FROM nginx:bookworm

RUN apt-get update && \
    apt-get install --no-install-recommends -y curl && \
    rm -rf /var/lib/apt/lists/*

# Binário rustac (Rust estático, ~30 MB)
COPY --from=rustac-build /usr/local/bin/rustac /usr/local/bin/rustac

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
