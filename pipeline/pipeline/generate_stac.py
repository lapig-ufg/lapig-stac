"""Generate STAC Catalog, Collections, and Items from local or Excel data."""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from shapely.geometry import Polygon, mapping

from pipeline.excel_parser import (
    CatalogInfo,
    CollectionRecord,
    ItemDefinition,
    ParseResult,
    Provider,
)
from pipeline.local_scanner import (
    CatalogConfig,
    ClassEntry,
    CollectionConfig,
    ProviderConfig,
    ScanResult,
    ScannedItem,
    StylePaths,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STAC_VERSION = "1.1.0"
COG_MEDIA_TYPE = "image/tiff; application=geotiff; profile=cloud-optimized"
GLOBAL_BBOX = [-180.0, -90.0, 180.0, 90.0]
GLOBAL_GEOMETRY = mapping(Polygon([
    (-180, -90), (180, -90), (180, 90), (-180, 90), (-180, -90)
]))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_utc_isoformat(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _bbox_to_geometry(bbox: list[float]) -> dict:
    w, s, e, n = bbox
    return mapping(Polygon([(w, s), (e, s), (e, n), (w, n), (w, s)]))


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
        f.write("\n")


# ---------------------------------------------------------------------------
# ScanResult → ParseResult bridge
# ---------------------------------------------------------------------------

def scan_result_to_parse_result(
    scan: ScanResult,
    base_url: str = "https://minio.lapig.ufg.br/lapig-cogs",
) -> ParseResult:
    """Convert a ScanResult (from local_scanner) to a ParseResult for the generator."""
    catalog = CatalogInfo(
        id=scan.catalog.id,
        title=scan.catalog.title,
        description=scan.catalog.description,
    )

    # Convert ProviderConfig → Provider (excel_parser type)
    providers_map: dict[str, Provider] = {}
    for key, pc in scan.providers.items():
        providers_map[pc.name] = Provider(
            name=pc.name,
            description=pc.description,
            roles=pc.roles,
            url=pc.url,
        )

    collections: list[CollectionRecord] = []

    for config in scan.collections:
        scanned_items = scan.items.get(config.id, [])

        # Ensure providers from this collection are in the map
        for pc in config.providers:
            if pc.name not in providers_map:
                providers_map[pc.name] = Provider(
                    name=pc.name,
                    description=pc.description,
                    roles=pc.roles,
                    url=pc.url,
                )

        # Convert ScannedItems → ItemDefinitions
        items: list[ItemDefinition] = []
        for si in scanned_items:
            start_dt = datetime(si.year, 1, 1, tzinfo=timezone.utc)
            end_dt = datetime(si.year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            href = f"{base_url.rstrip('/')}/{config.id}/cogs/{si.filename}"
            thumb_href = f"{base_url.rstrip('/')}/{config.id}/thumbnails/{si.item_id}.png"
            items.append(ItemDefinition(
                item_id=si.item_id,
                start_datetime=start_dt,
                end_datetime=end_dt,
                assets={
                    "data": href,
                    "thumbnail": thumb_href,
                },
            ))

        # Compute temporal extent from actual items
        years = [si.year for si in scanned_items]
        start_date = datetime(min(years), 1, 1, tzinfo=timezone.utc) if years else None
        end_date = datetime(max(years), 12, 31, tzinfo=timezone.utc) if years else None

        record = CollectionRecord(
            id=config.id,
            row_index=0,
            dt_position=None,
            catalog="lapig-stac",
            collection_class="",
            title=config.title,
            description=config.description,
            keywords=list(config.keywords),
            stac_url=None,
            version=None,
            doi=None,
            citation=None,
            license=config.license,
            layer_unit=config.unit,
            scale=None,
            offset=None,
            spatial_aggregation=None,
            contact_name=None,
            contact_email=None,
            provider_ids=[pc.name for pc in config.providers],
            gsd=config.gsd,
            start_date=start_date,
            end_date=end_date,
            date_step="1",
            date_offset=None,
            date_unit="years",
            date_style="interval",
            depth_list=[],
            main_url=None,
            extra_urls={},
            sld_urls=[config.styles.sld] if config.styles.sld else [],
            qml_urls=[config.styles.qml] if config.styles.qml else [],
            custom_bbox=list(config.spatial_extent),
            items=items,
        )
        collections.append(record)

    return ParseResult(
        catalog=catalog,
        providers=providers_map,
        collections=collections,
    )


# ---------------------------------------------------------------------------
# Collection builder
# ---------------------------------------------------------------------------

def _make_collection_dict(
    record: CollectionRecord,
    providers_map: dict[str, Provider],
) -> dict[str, Any]:
    """Build a STAC Collection dict."""
    start_iso = _to_utc_isoformat(record.start_date)
    end_iso = _to_utc_isoformat(record.end_date)

    bbox = record.custom_bbox or GLOBAL_BBOX

    stac_providers = []
    for pid in record.provider_ids:
        if pid in providers_map:
            prov = providers_map[pid]
            stac_providers.append({
                "name": prov.name,
                "description": prov.description,
                "roles": prov.roles,
                "url": prov.url,
            })

    summaries: dict[str, Any] = {}
    if record.gsd is not None:
        summaries["gsd"] = [record.gsd]

    links: list[dict[str, str]] = [
        {"rel": "self", "href": f"./collections/{record.id}.json", "type": "application/json"},
        {"rel": "root", "href": "../catalog.json", "type": "application/json"},
    ]

    # Stylesheets (SLD, QML) — rel IANA "stylesheet" é o padrão canônico
    for sld_path in record.sld_urls:
        links.append({
            "rel": "stylesheet",
            "type": "application/vnd.ogc.sld+xml",
            "href": f"./styles/{Path(sld_path).name}",
            "title": f"Estilo SLD — {record.title}",
        })
    for qml_path in record.qml_urls:
        links.append({
            "rel": "stylesheet",
            "type": "application/x-qgis-style",
            "href": f"./styles/{Path(qml_path).name}",
            "title": f"Estilo QML — {record.title}",
        })

    collection: dict[str, Any] = {
        "type": "Collection",
        "stac_version": STAC_VERSION,
        "stac_extensions": [
            "https://stac-extensions.github.io/projection/v2.0.0/schema.json",
        ],
        "id": record.id,
        "title": record.title,
        "description": record.description,
        "keywords": record.keywords,
        "license": record.license,
        "providers": stac_providers,
        "extent": {
            "spatial": {"bbox": [bbox]},
            "temporal": {"interval": [[start_iso, end_iso]]},
        },
        "summaries": summaries,
        "links": links,
    }

    # Extra properties (layer_unit, class, etc.)
    extra: dict[str, Any] = {}
    if record.layer_unit:
        extra["lapig:layer_unit"] = record.layer_unit
    if record.collection_class:
        extra["lapig:class"] = record.collection_class
    if extra:
        collection["extra_fields"] = extra

    return collection


# ---------------------------------------------------------------------------
# Item builder
# ---------------------------------------------------------------------------

def _make_item_dict(
    collection_id: str,
    item_def: ItemDefinition,
    gsd: float | None,
    bbox: list[float],
    geometry: dict,
) -> dict[str, Any]:
    """Build a STAC Item dict."""
    properties: dict[str, Any] = {
        "datetime": None,
        "start_datetime": _to_utc_isoformat(item_def.start_datetime),
        "end_datetime": _to_utc_isoformat(item_def.end_datetime),
        "proj:code": "EPSG:4326",
    }
    if gsd is not None:
        properties["gsd"] = gsd

    assets: dict[str, Any] = {}
    for key, href in item_def.assets.items():
        if key == "thumbnail":
            assets[key] = {
                "href": href,
                "type": "image/png",
                "roles": ["thumbnail"],
            }
        else:
            assets[key] = {
                "href": href,
                "type": COG_MEDIA_TYPE,
                "roles": ["data"],
            }

    return {
        "type": "Feature",
        "stac_version": STAC_VERSION,
        "stac_extensions": [
            "https://stac-extensions.github.io/projection/v2.0.0/schema.json",
        ],
        "id": item_def.item_id,
        "collection": collection_id,
        "geometry": geometry,
        "bbox": bbox,
        "properties": properties,
        "assets": assets,
        "links": [
            {"rel": "collection", "href": f"../../collections/{collection_id}.json", "type": "application/json"},
            {"rel": "root", "href": "../../catalog.json", "type": "application/json"},
        ],
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_catalog(
    parse_result: ParseResult,
    output_dir: str | Path,
    scan: ScanResult | None = None,
) -> Path:
    """Generate the full STAC catalog on disk.

    Args:
        parse_result: Parsed metadata (from Excel or local scan bridge).
        output_dir: Output directory for the catalog.
        scan: Optional ScanResult to enrich collections with classification.
    """
    out = Path(output_dir)
    collections_dir = out / "collections"
    items_dir = out / "items"
    collections_dir.mkdir(parents=True, exist_ok=True)
    items_dir.mkdir(parents=True, exist_ok=True)

    # -- Catalog root --
    catalog_dict: dict[str, Any] = {
        "type": "Catalog",
        "stac_version": STAC_VERSION,
        "id": parse_result.catalog.id,
        "title": parse_result.catalog.title,
        "description": parse_result.catalog.description,
        "links": [
            {"rel": "self", "href": "./catalog.json", "type": "application/json"},
            {"rel": "root", "href": "./catalog.json", "type": "application/json"},
        ],
    }

    for rec in parse_result.collections:
        catalog_dict["links"].append({
            "rel": "child",
            "href": f"./collections/{rec.id}.json",
            "type": "application/json",
            "title": rec.title,
        })

    _write_json(out / "catalog.json", catalog_dict)

    # -- Collections + Items --
    collections_array: list[dict[str, Any]] = []
    total_items = 0

    # Copy style files to catalog/styles/
    styles_dir = out / "styles"
    pipeline_root = Path(__file__).parent.parent  # pipeline/ dir
    for rec in parse_result.collections:
        for style_path_str in rec.sld_urls + rec.qml_urls:
            src = pipeline_root / style_path_str
            if src.exists():
                styles_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, styles_dir / src.name)

    # Build classification lookup from ScanResult
    classification_map: dict[str, list[dict[str, Any]]] = {}
    if scan:
        for cfg in scan.collections:
            if cfg.classification:
                classification_map[cfg.id] = [
                    {"value": c.value, "label": c.label, "color": c.color}
                    for c in cfg.classification
                ]

    for rec in parse_result.collections:
        col_dict = _make_collection_dict(rec, parse_result.providers)

        # Add classification to summaries
        if rec.id in classification_map:
            col_dict.setdefault("summaries", {})["classification:classes"] = classification_map[rec.id]

        bbox = rec.custom_bbox or GLOBAL_BBOX
        geom = _bbox_to_geometry(bbox)

        # Add item links
        for item_def in rec.items:
            col_dict["links"].append({
                "rel": "item",
                "href": f"../items/{rec.id}/{item_def.item_id}.json",
                "type": "application/json",
            })

        _write_json(collections_dir / f"{rec.id}.json", col_dict)
        collections_array.append(col_dict)

        # Items
        col_items_dir = items_dir / rec.id
        col_items_dir.mkdir(parents=True, exist_ok=True)

        for item_def in rec.items:
            item_dict = _make_item_dict(rec.id, item_def, rec.gsd, bbox, geom)
            _write_json(col_items_dir / f"{item_def.item_id}.json", item_dict)
            total_items += 1

    _write_json(out / "collections.json", collections_array)

    print(f"Generated {len(collections_array)} collections, {total_items} items in {out}")
    return out
