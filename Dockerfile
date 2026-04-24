# =============================================================================
# LAPIG STAC API — stac-fastapi-pgstac (desenvolvimento / docker-compose)
# =============================================================================
FROM python:3.12-slim

RUN apt-get update && \
    apt-get install --no-install-recommends -y curl postgresql-client && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependências da API e do carregador pgstac. Versões fixadas no pyproject
# do pipeline; aqui replicamos por clareza de runtime.
RUN pip install --no-cache-dir --root-user-action=ignore \
        'stac-fastapi.pgstac==6.2.2' \
        'pypgstac[psycopg]==0.9.6' \
        'uvicorn[standard]==0.32.*'

# Pipeline (usado para export-ndjson quando o catálogo muda em dev)
COPY pipeline/pyproject.toml pipeline/README.md* /app/pipeline/
COPY pipeline/pipeline /app/pipeline/pipeline
RUN pip install --no-cache-dir --root-user-action=ignore /app/pipeline

# Entrypoint dev: aguarda Postgres → pypgstac migrate → load → uvicorn.
COPY docker/dev/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7822

ENTRYPOINT ["/entrypoint.sh"]
