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

## Deploy em Produção

### Infraestrutura

A aplicação está publicada em **https://stac.lapig.iesa.ufg.br** com a seguinte infraestrutura:

| Componente | Tecnologia |
|---|---|
| Orquestração | Docker Swarm (vm1 + vm2) |
| Reverse proxy | Traefik v3.6.7 com TLS automático (Let's Encrypt) |
| DNS | BIND9 (zona `lapig.iesa.ufg.br`) |
| CI/CD | GitHub Actions → DockerHub → zelador (deploy automático) |
| Imagem | `lapig/lapig-stac:prod_latest` (Python 3.12 + nginx + rustac + Angular SPA) |

### Pipeline CI/CD

Cada push na branch `main` executa automaticamente:

1. **Build** (GitHub Actions, `ubuntu-latest`): constrói imagem Docker unificada via `docker/prod/Dockerfile` e publica no DockerHub.
2. **Deploy** (runner self-hosted `vm1`): `zelador` atualiza o serviço no Docker Swarm.

```
push main → GitHub Actions → DockerHub → zelador → Docker Swarm → Traefik (TLS)
```

### Arquivos de configuração (servidor)

| Arquivo | Caminho no servidor |
|---|---|
| Compose do serviço | `/glusterfs/aplications/services/lapig-stac/prod.compose.yml` |
| Zona DNS | `/glusterfs/aplications/lapig.zone` |
| Configuração Traefik | `/glusterfs/aplications/tools/002_treaefik/traefik.yml` |

### Variáveis de ambiente (produção)

| Variável | Descrição |
|---|---|
| `MAPBOX_TOKEN` | Token do Mapbox para basemap do browser (injetado em runtime) |

### Verificação

```bash
# Landing page da API
curl -s https://stac.lapig.iesa.ufg.br/api/ | jq .

# Listar coleções
curl -s https://stac.lapig.iesa.ufg.br/api/collections | jq '.collections[].id'

# Health check
curl -f https://stac.lapig.iesa.ufg.br/api/
```

### Variáveis de ambiente (desenvolvimento local)

| Variável | Padrão | Descrição |
|---|---|---|
| `STAC_HOST` | `0.0.0.0` | Endereço de bind da API |
| `STAC_PORT` | `8000` | Porta da API |
| `CATALOG_PARQUET_PATH` | `/app/catalog/items.parquet` | Caminho do arquivo Parquet |
| `COLLECTIONS_JSON_PATH` | `/app/catalog/collections.json` | Caminho do JSON de coleções |
| `CATALOG_TITLE` | `LAPIG Data Catalog` | Título do catálogo |
| `PUBLIC_URL` | `http://localhost` | URL pública da API |
| `RUST_LOG` | `info` | Nível de log (trace, debug, info, warn, error) |

### Health Check

A API expõe a rota raiz (`/`) como health check. Em produção, o Docker Swarm verifica `curl -f http://localhost/api/` periodicamente.

```bash
# Desenvolvimento local
curl -f http://localhost:3000/api/

# Produção
curl -f https://stac.lapig.iesa.ufg.br/api/
```

## Atualização do catálogo

Em produção, os dados do catálogo estão embutidos na imagem Docker. Para atualizar:

1. Executar o pipeline Python para regenerar os artefatos no diretório `catalog/`.
2. Fazer commit e push para `main` — o CI/CD reconstrói a imagem automaticamente.

Em desenvolvimento local, os arquivos são montados via volume (`./catalog:/app/catalog:ro`), permitindo atualização sem rebuild.
