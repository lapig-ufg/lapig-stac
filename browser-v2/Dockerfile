# =============================================================================
# LAPIG STAC Browser v2 — Angular 21 + PrimeNG 21
# Multi-stage: build com Node, serve com nginx
# =============================================================================

# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

# Copiar manifesto de dependências primeiro (cache layer)
COPY package.json package-lock.json ./

# Instalar dependências
RUN npm ci --ignore-scripts

# Copiar código-fonte
COPY . .

# Build de produção
RUN npx ng build --configuration=production

# Stage 2: Serve com nginx
FROM nginx:alpine

# Copiar build para nginx
COPY --from=build /app/dist/apollo-ng/browser /usr/share/nginx/html

# SPA fallback: redireciona rotas desconhecidas para index.html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    \n\
    # Gzip\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml;\n\
    gzip_min_length 256;\n\
    \n\
    # Cache assets estáticos\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
    \n\
    # SPA fallback\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

# Injetar token Mapbox em runtime via variável de ambiente
ENV MAPBOX_TOKEN=""
CMD ["/bin/sh", "-c", "sed -i \"s/__MAPBOX_TOKEN_PLACEHOLDER__/$MAPBOX_TOKEN/g\" /usr/share/nginx/html/index.html && nginx -g 'daemon off;'"]

EXPOSE 80
