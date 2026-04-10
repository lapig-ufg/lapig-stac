#!/bin/sh
set -e

# Injetar MAPBOX_TOKEN em runtime no build Angular
if [ -n "$MAPBOX_TOKEN" ]; then
    sed -i "s/__MAPBOX_TOKEN_PLACEHOLDER__/$MAPBOX_TOKEN/g" /usr/share/nginx/html/index.html
fi

# Iniciar rustac em background (API STAC na porta 7822, localhost apenas)
rustac serve \
    /app/catalog/pasture-area.json \
    /app/catalog/pasture-vigor.json \
    /app/catalog/items_rustac.parquet \
    --addr 127.0.0.1:7822 &

RUSTAC_PID=$!

# Encerrar ambos os processos no SIGTERM
cleanup() {
    kill "$RUSTAC_PID" 2>/dev/null || true
    nginx -s quit 2>/dev/null || true
    wait "$RUSTAC_PID" 2>/dev/null || true
}
trap cleanup TERM INT

# Aguardar rustac estar pronto (máximo 30s)
echo "Aguardando rustac iniciar..."
for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:7822/ > /dev/null 2>&1; then
        echo "rustac pronto na porta 7822"
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "ERRO: rustac não iniciou em 30s"
        exit 1
    fi
    sleep 1
done

# Iniciar nginx em foreground
exec nginx -g 'daemon off;'
