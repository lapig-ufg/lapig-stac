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
┌─────────────────┐     ┌─────────────────────────┐
│   STAC API      │     │   STAC Browser          │
│   (rustac)      │     │   (Angular 21 + PrimeNG)│
│   porta 7822    │     │   porta 80              │
│                 │     │                         │
│   DuckDB ───►  │     │   OpenLayers 10.7       │
│   items.parquet │     │   WebGL COG rendering   │
│                 │     │   Estilos classificados │
└─────────────────┘     └─────────────────────────┘
         │
         ▼
┌─────────────────┐
│   Catálogo      │
│   (somente      │
│    leitura)     │
│                 │
│  items.parquet  │
│  collections    │
│  .json          │
└─────────────────┘
```

## Fluxo de dados

1. **Pipeline (Python)**: lê configuração YAML, escaneia dados locais (GeoTIFF), gera itens STAC em JSON, converte para COG otimizado, enriquece com metadados GDAL e consolida em `items.parquet` via GeoParquet.
2. **STAC API (rustac)**: carrega `items.parquet` e `collections.json` na inicialização. Utiliza DuckDB para consultas analíticas sobre o Parquet com filtros espaciais e temporais.
3. **Browser (Angular 21)**: interface web que consome a API via `/api`, exibe coleções, itens e renderiza COGs diretamente no mapa via WebGL (OpenLayers `WebGLTileLayer` + `GeoTIFF` source). Estilos classificados são derivados de `classification:classes` dos summaries da coleção.
4. **Nginx**: ponto de entrada unificado na porta 80. Roteia `/api/*` para a API, `/cog-proxy/*` para o S3 (com CORS e suporte a Range requests), e `/*` para o browser Angular.

## Decisões arquiteturais

| Decisão | Justificativa |
|---|---|
| DuckDB + Parquet (sem PostgreSQL) | Catálogo estático com poucos milhares de itens; DuckDB oferece consultas analíticas sem servidor externo |
| COGs remotos (S3 LAPIG) | Ativos raster servidos via S3 com suporte a HTTP Range requests; proxy CORS via Nginx |
| WebGL COG rendering | Renderização direta de COGs no browser via OpenLayers WebGLTileLayer — sem necessidade de tile server intermediário |
| Estilos por classificação | Cores derivadas de `classification:classes` (STAC summaries) e SLD (OGC) — estilo data-driven, sem hardcode |
| Multi-stage Docker build | Imagem final leve (python-slim + rustac wheel) |
| Nginx como proxy reverso | URL unificada, simplifica CORS, serve estilos estáticos (SLD/QML) |

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
│   └── *.json                 #   Coleções limpas para rustac
├── docs/                       # Documentação técnica
├── infra/nginx/                # Configuração do proxy reverso
├── Dockerfile                  # Build da API STAC (rustac via pip)
├── docker-compose.yml          # Orquestração dos 3 serviços
└── Justfile                    # Comandos de desenvolvimento e pipeline
```
