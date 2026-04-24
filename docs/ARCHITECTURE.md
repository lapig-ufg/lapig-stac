# Arquitetura — LAPIG STAC

## Visão geral

O LAPIG STAC é um catálogo de dados geoespaciais compatível com a especificação STAC v1.1.0, desenvolvido para disponibilizar as coleções de dados do LAPIG/UFG (pastagens, vigor, entre outros) de forma padronizada e interoperável.

## Componentes

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (porta 80)                     │
│                   Proxy reverso                         │
│                                                         │
│   /api/collections/*/styles/*  ──►  /catalog/styles/    │
│   /api/*       ──►  stac-api:7822  (strip /api prefix)  │
│   /cog-proxy/* ──►  s3.lapig.iesa.ufg.br  (CORS + Range)│
│   /*           ──►  browser:80     (SPA Angular)        │
└─────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────────────┐  ┌─────────────────────────┐
│   STAC API               │  │   STAC Browser          │
│   (stac-fastapi-pgstac)  │  │   (Angular 21 + PrimeNG)│
│   porta 7822             │  │   porta 80              │
│   root_path=/api         │  │                         │
│                          │  │   OpenLayers 10.7       │
│        │                 │  │   WebGL COG rendering   │
└────────┼─────────────────┘  │   Estilos classificados │
         ▼                    └─────────────────────────┘
┌──────────────────────────┐
│   PostgreSQL + PostGIS   │
│   schema `pgstac`        │
│   database `stac_lapig`  │
└──────────────────────────┘
```

## Fluxo de dados

1. **Pipeline (Python)**: lê configuração YAML, escaneia dados locais (GeoTIFF), gera itens STAC em JSON, converte para COG otimizado, enriquece com metadados GDAL e consolida como `collections.ndjson` + `items.ndjson` (via `lapig-stac export-ndjson`).
2. **STAC API (stac-fastapi-pgstac)**: no boot, aplica migrações `pgstac` (idempotente) e carrega o catálogo via `pypgstac load … --method upsert`. Em runtime, responde às rotas STAC consultando o Postgres/PostGIS; o `--root-path=/api` garante que todos os hrefs já saiam prefixados corretamente.
3. **Browser (Angular 21)**: interface web que consome a API via `/api`, exibe coleções, itens e renderiza COGs diretamente no mapa via WebGL (OpenLayers `WebGLTileLayer` + `GeoTIFF` source). Estilos classificados são derivados de `classification:classes` dos summaries da coleção.
4. **Nginx**: ponto de entrada unificado na porta 80. Roteia `/api/*` para a API (proxy transparente, sem reescrita de body), `/cog-proxy/*` para o S3 (com CORS e suporte a Range requests), e `/*` para o browser Angular.

## Decisões arquiteturais

| Decisão | Justificativa |
|---|---|
| PostgreSQL + PostGIS + pgstac | Backend production-grade da STAC API; suporta filter (CQL2), sort, fields e transactions prontos; escala para milhões de items |
| stac-fastapi `root_path=/api` | Elimina a reescrita de hrefs no proxy reverso (sub_filter): o FastAPI emite os links com prefixo correto na origem |
| COGs remotos (S3 LAPIG) | Ativos raster servidos via S3 com suporte a HTTP Range requests; proxy CORS via Nginx |
| WebGL COG rendering | Renderização direta de COGs no browser via OpenLayers WebGLTileLayer — sem necessidade de tile server intermediário |
| Estilos por classificação | Cores derivadas de `classification:classes` (STAC summaries) e SLD (OGC) — estilo data-driven, sem hardcode |
| Multi-stage Docker build | Imagem unificada de produção (Node build → Python/FastAPI + nginx + Angular SPA) |
| Nginx como proxy reverso | URL unificada, simplifica CORS, serve estilos estáticos (SLD/QML) |
| CI/CD automatizado | GitHub Actions → DockerHub → zelador → Docker Swarm (https://stac.lapig.iesa.ufg.br) |

## Estrutura de diretórios

```
lapig-stac/
├── browser-v2/                # Frontend Angular 21 + PrimeNG + OpenLayers
│   ├── src/app/features/      #   Módulos: search, catalog, item, map
│   │   ├── map/               #     WebGL COG rendering + controles de estilo
│   │   ├── item/              #     Detalhe de item com mapa + metadados
│   │   └── search/            #     Busca espacial + temporal
│   └── Dockerfile             #   Build multi-stage (Node 22 → Nginx)
├── pipeline/                   # Pipeline Python (scan → STAC → COG → enrich)
│   ├── pipeline/              #   Módulos: cli, generate_stac, cog_thumbnail, etc.
│   ├── config/                #   collections.yaml (definição das coleções)
│   └── styles/                #   SLD + QML (estilos de classificação)
├── catalog/                    # Artefatos gerados (não versionados, exceto styles/)
│   ├── styles/                #   SLD/QML servidos pelo Nginx
│   ├── collections/*.json     #   Coleções STAC (fonte de verdade, gerada pelo pipeline)
│   └── items/**/*.json        #   Items STAC (fonte de verdade)
├── docs/                       # Documentação técnica
├── infra/nginx/                # Configuração do proxy reverso
├── docker/prod/                # Dockerfile e configs de produção (CI/CD)
│   ├── Dockerfile              #   Imagem unificada (Node build → Python/FastAPI + nginx)
│   ├── nginx.conf              #   Configuração nginx de produção
│   └── entrypoint.sh           #   Entrypoint: pypgstac migrate/load + uvicorn + nginx
├── docker/dev/                 # Entrypoint do container de dev
│   └── entrypoint.sh           #   Entrypoint: pypgstac migrate/load + uvicorn
├── .github/workflows/          # GitHub Actions CI/CD
│   └── prod.yml                #   Build → DockerHub → zelador → Swarm
├── Dockerfile                  # Build da API STAC (stac-fastapi-pgstac, desenvolvimento)
├── docker-compose.yml          # Orquestração dos 3 serviços (desenvolvimento)
└── Justfile                    # Comandos de desenvolvimento e pipeline
```
