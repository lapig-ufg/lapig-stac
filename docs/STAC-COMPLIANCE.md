# Conformidade STAC v1.1.0

## Visão Geral

O LAPIG STAC implementa a especificação [STAC v1.1.0](https://github.com/radiantearth/stac-spec/tree/v1.1.0) e a [STAC API v1.0.0](https://github.com/radiantearth/stac-api-spec/tree/v1.0.0).

## Checklist — STAC Core

### Catalog

| Requisito | Status | Observacao |
|---|---|---|
| `type` = `"Catalog"` | OK | |
| `stac_version` = `"1.1.0"` | OK | |
| `id` presente | OK | `lapig-stac` |
| `description` presente | OK | |
| `links` com `rel: root` | OK | |
| `links` com `rel: self` | OK | |
| `links` com `rel: child` para colecoes | OK | |

### Collection

| Requisito | Status | Observacao |
|---|---|---|
| `type` = `"Collection"` | OK | |
| `stac_version` = `"1.1.0"` | OK | |
| `id` presente e unico | OK | |
| `title` presente | OK | |
| `description` presente | OK | |
| `license` presente | OK | `CC-BY-4.0` |
| `extent.spatial.bbox` presente | OK | |
| `extent.temporal.interval` presente | OK | |
| `links` com `rel: items` | OK | |
| `links` com `rel: root` | OK | |
| `links` com `rel: self` | OK | |
| `links` com `rel: parent` | OK | |
| `summaries` presente | OK | |
| `providers` presente | OK | LAPIG/UFG |

### Item

| Requisito | Status | Observacao |
|---|---|---|
| `type` = `"Feature"` | OK | GeoJSON Feature |
| `stac_version` = `"1.1.0"` | OK | |
| `id` presente e unico na colecao | OK | |
| `geometry` presente (GeoJSON) | OK | Poligono do tile |
| `bbox` presente | OK | |
| `properties.datetime` presente | OK | |
| `links` com `rel: collection` | OK | |
| `links` com `rel: root` | OK | |
| `links` com `rel: self` | OK | |
| `links` com `rel: parent` | OK | |
| `assets` presente com pelo menos 1 ativo | OK | COG remoto |

### Assets

| Requisito | Status | Observacao |
|---|---|---|
| `href` presente | OK | URL s3.ecodatacube.eu |
| `type` presente | OK | `image/tiff; application=geotiff; profile=cloud-optimized` |
| `roles` presente | OK | `["data"]` |

## Checklist — STAC API

### Endpoints obrigatorios (Core)

| Endpoint | Metodo | Status |
|---|---|---|
| `/` | GET | OK — Landing Page |
| `/conformsTo` | GET | OK |
| `/collections` | GET | OK |
| `/collections/{id}` | GET | OK |
| `/collections/{id}/items` | GET | OK |
| `/collections/{id}/items/{itemId}` | GET | OK |

### Landing Page

| Requisito | Status |
|---|---|
| `conformsTo` presente | OK |
| Link `rel: self` | OK |
| Link `rel: root` | OK |
| Link `rel: service-desc` (OpenAPI) | OK |
| Link `rel: data` (collections) | OK |
| `type` = `"Catalog"` | OK |
| `stac_version` = `"1.1.0"` | OK |

### Content-Type

| Requisito | Status |
|---|---|
| Respostas com `application/json` | OK |
| Respostas GeoJSON com `application/geo+json` | OK |

## Extensoes Utilizadas

| Extensao | Identificador |
|---|---|
| (nenhuma extensao obrigatoria ativada neste momento) | — |

## Validacao

Para validar os itens STAC gerados pelo pipeline:

```bash
cd pipeline
pip install stac-validator
lapig-stac validate
```
