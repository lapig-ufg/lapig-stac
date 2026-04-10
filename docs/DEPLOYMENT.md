# Deployment — LAPIG STAC

## Pre-requisitos

- Docker >= 24.0
- Docker Compose >= 2.20
- (Opcional) [Just](https://github.com/casey/just) >= 1.25 para comandos de conveniencia

## Deploy Local (Desenvolvimento)

### 1. Gerar o catalogo

O pipeline Python precisa ser executado antes da API, pois gera os arquivos `catalog/items.parquet` e `catalog/collections.json`.

```bash
cd pipeline
python -m venv .venv
source .venv/bin/activate
pip install -e .
python run_pipeline.py
```

### 2. Subir os servicos

```bash
docker compose up -d --build
```

Ou com Just:

```bash
just up
```

### 3. Verificar

| Servico | URL | Descricao |
|---|---|---|
| Nginx (proxy) | http://localhost | Ponto de entrada unificado |
| STAC API | http://localhost/api | API STAC v1.1.0 |
| STAC Browser | http://localhost | Interface web |
| API direta | http://localhost:8000 | Acesso direto (sem proxy) |

```bash
# Landing page da API
curl -s http://localhost/api/ | jq .

# Listar colecoes
curl -s http://localhost/api/collections | jq '.collections[].id'
```

## Deploy em Producao

### Variaveis de Ambiente

| Variavel | Padrao | Descricao |
|---|---|---|
| `STAC_HOST` | `0.0.0.0` | Endereco de bind da API |
| `STAC_PORT` | `8000` | Porta da API |
| `CATALOG_PARQUET_PATH` | `/app/catalog/items.parquet` | Caminho do arquivo Parquet |
| `COLLECTIONS_JSON_PATH` | `/app/catalog/collections.json` | Caminho do JSON de colecoes |
| `CATALOG_TITLE` | `LAPIG Data Catalog` | Titulo do catalogo |
| `PUBLIC_URL` | `http://localhost` | URL publica da API |
| `RUST_LOG` | `info` | Nivel de log (trace, debug, info, warn, error) |

### Com Docker Compose

1. Ajustar variaveis no `docker-compose.yml` ou criar um arquivo `.env`.
2. Alterar `PUBLIC_URL` para o dominio de producao.
3. Configurar TLS no nginx ou em um load balancer externo.

```bash
docker compose -f docker-compose.yml up -d --build
```

### Sem Docker (binario nativo)

```bash
# Compilar
cargo build --release --package lapig-stac-api

# Executar
STAC_HOST=0.0.0.0 \
STAC_PORT=8000 \
CATALOG_PARQUET_PATH=./catalog/items.parquet \
COLLECTIONS_JSON_PATH=./catalog/collections.json \
PUBLIC_URL=https://stac.lapig.iesa.ufg.br \
RUST_LOG=info \
./target/release/lapig-stac-api
```

### TLS/HTTPS

Em producao, recomenda-se utilizar um dos seguintes mecanismos para TLS:

- **Traefik** ou **Caddy** como reverse proxy com certificado automatico (Let's Encrypt).
- **Nginx** com `certbot` para gerenciamento de certificados.
- **Load balancer externo** (AWS ALB, GCP LB) terminando TLS antes do container.

### Health Check

A API expoe a rota raiz (`/`) como health check. O `docker-compose.yml` ja inclui configuracao de healthcheck para o servico `stac-api`.

```bash
curl -f http://localhost:8000/
```

## Atualizacao do Catalogo

Para atualizar os dados sem reconstruir as imagens Docker:

1. Executar o pipeline Python para regenerar `items.parquet` e `collections.json`.
2. Reiniciar apenas o servico da API:

```bash
docker compose restart stac-api
```

Os arquivos do catalogo sao montados via volume (`./catalog:/app/catalog:ro`), portanto nao e necessario rebuild da imagem.
