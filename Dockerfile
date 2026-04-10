# =============================================================================
# LAPIG STAC API — rustac serve via pip (Python wheel com binário Rust)
# =============================================================================
FROM python:3.12-slim

RUN pip install --no-cache-dir rustac==0.9.8

WORKDIR /app

# Catálogo: collections JSON + items parquet (montados via volume ou COPY)
COPY catalog/pasture-area.json catalog/pasture-vigor.json /app/catalog/
COPY catalog/items_rustac.parquet /app/catalog/

EXPOSE 7822

CMD ["rustac", "serve", \
     "/app/catalog/pasture-area.json", \
     "/app/catalog/pasture-vigor.json", \
     "/app/catalog/items_rustac.parquet", \
     "--addr", "0.0.0.0:7822"]
