<p align="center">
  <img src="browser-v2/src/assets/layout/logos/lapig-stac.png" alt="LAPIG STAC" width="340" />
</p>

<p align="center">
  <a href="https://stacspec.org/"><img src="https://img.shields.io/badge/STAC-v1.1.0-blue" alt="STAC v1.1.0" /></a>
  <a href="https://creativecommons.org/licenses/by-sa/4.0/"><img src="https://img.shields.io/badge/License-CC--BY--SA--4.0-lightgrey" alt="License" /></a>
</p>

Catálogo de dados geoespaciais do **LAPIG/UFG** compatível com [STAC v1.1.0](https://stacspec.org/).

Disponibiliza coleções de pastagem (área e vigor) do MapBiomas como itens STAC com COGs otimizados, servidos dinamicamente via [rustac](https://github.com/stac-utils/rustac).

<p align="center">
  <video src="docs/assets/lapig-stac-demo.mp4" width="920" autoplay loop muted>
    Seu navegador não suporta o elemento de vídeo.
  </video>
</p>

## Arquitetura

### Infraestrutura (runtime)

![Infraestrutura runtime](docs/assets/infraestrutura-runtime.png)

### Pipeline de dados (offline)

![Pipeline de dados](docs/assets/pipeline-dados.png)

### Componentes

| Componente | Tecnologia | Funcao |
|---|---|---|
| **API STAC** | [rustac](https://github.com/stac-utils/rustac) v0.9.8 + DuckDB | Servidor STAC dinamico a partir de GeoParquet |
| **Browser** | Angular 21 + PrimeNG 21 + OpenLayers 10.7 | Visualizacao interativa com renderizacao WebGL de COGs |
| **Proxy** | Nginx 1.29 | Roteamento, CORS para COGs no S3, estilos estaticos (SLD/QML) |
| **Pipeline** | Python 3.11 + GDAL + Click | Geracao de catalogo STAC, conversao COG, enriquecimento de metadados |

## Início rápido

### Pré-requisitos

- Python >= 3.11
- Docker >= 24.0 (para produção)
- GDAL >= 3.9 (para conversão COG)
- [Just](https://github.com/casey/just) (opcional)

### 1. Instalar dependências

```bash
cd pipeline
python -m venv .venv
source .venv/bin/activate
pip install -e .
pip install rustac
```

### 2. Pipeline completo

```bash
# Gerar metadados STAC a partir dos dados locais
lapig-stac all -d ../data -o ../catalog

# Converter TIFFs para COG otimizados + thumbnails
lapig-stac convert -d ../data -o ../catalog --cog-workers 4

# Enriquecer itens com metadados reais dos COGs
lapig-stac enrich -d ../catalog

# Gerar parquet no formato stac-geoparquet (rustac)
rustac translate /tmp/stac_items.ndjson catalog/items_rustac.parquet
```

### 3. Servir localmente

```bash
rustac serve \
    catalog/pasture-area.json \
    catalog/pasture-vigor.json \
    catalog/items_rustac.parquet \
    --addr 0.0.0.0:7822
```

### 4. Docker Compose (produção)

```bash
docker compose up -d --build
```

| URL | Descrição |
|---|---|
| `http://localhost:3000` | Browser STAC |
| `http://localhost:3000/api` | API STAC (JSON) |
| `http://localhost:3000/api/collections` | Coleções |
| `http://localhost:3000/api/search` | Busca (POST) |

## Coleções

| ID | Título | Período | Itens |
|---|---|---|---|
| `pasture-area` | MapBiomas Col. 10 — Área de Pastagem | 1985–2024 | 40 |
| `pasture-vigor` | MapBiomas Col. 10 — Vigor de Pastagem | 2000–2024 | 25 |

Cada item inclui:
- **COG** otimizado (DEFLATE, 256x256 tiles, 10 overviews)
- **Thumbnail** PNG estilizado (512x485 px)
- Metadados: `proj:epsg`, `proj:shape`, `raster:bands`, `file:size`, `file:checksum`
- Estilos: SLD (OGC) + QML (QGIS) por coleção

## Estrutura do projeto

```
lapig-stac/
├── browser-v2/               # Frontend Angular 21 + PrimeNG + OpenLayers
│   ├── src/app/features/     #   Módulos: search, catalog, item, map
│   └── Dockerfile            #   Build multi-stage (Node → Nginx)
├── pipeline/                  # Pipeline Python (scan → STAC → COG → enrich)
│   ├── pipeline/             #   Módulos: cli, generate_stac, cog_thumbnail, etc.
│   ├── config/               #   collections.yaml (definição das coleções)
│   └── styles/               #   SLD + QML (estilos de classificação)
├── catalog/                   # Artefatos gerados (não versionados, exceto styles/)
│   ├── styles/               #   SLD/QML servidos pelo Nginx
│   ├── pasture-area.json     #   Coleção limpa para rustac
│   └── pasture-vigor.json    #   Coleção limpa para rustac
├── docs/                      # Documentação técnica
├── infra/nginx/               # Configuração do proxy reverso
├── Dockerfile                 # Build da API STAC (rustac via pip)
├── docker-compose.yml         # Orquestração dos 3 serviços
└── Justfile                   # Task runner para pipeline e Docker
```

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Conformidade STAC](docs/STAC-COMPLIANCE.md)
- [Deployment](docs/DEPLOYMENT.md)

## Parceiros

<p align="center">
  <a href="https://www.lapig.iesa.ufg.br"><img src="browser-v2/src/assets/images/logo-lapig.png" alt="LAPIG" height="50" /></a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://ufg.br"><img src="browser-v2/src/assets/images/logo-ufg.png" alt="UFG" height="50" /></a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://mapbiomas.org"><img src="browser-v2/src/assets/images/logo-mapbiomas.png" alt="MapBiomas" height="50" /></a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://opengeohub.org"><img src="browser-v2/src/assets/images/logo-opengeohub.png" alt="OpenGeoHub" height="50" /></a>
</p>

## Licença

Dados distribuídos sob [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/).
