"""Exportação opcional do catálogo como stac-geoparquet.

O servidor STAC em produção (stac-fastapi-pgstac) ingere o catálogo
diretamente dos arquivos `collections.ndjson`/`items.ndjson` emitidos
por `pipeline.load_pgstac.export_ndjson`. Este módulo fica disponível
apenas para quem precise publicar o catálogo também no formato
stac-geoparquet — útil para consumidores DuckDB, pystac-client offline
ou ferramentas como `rustac` e `stac-geoparquet`.

Não é parte do caminho crítico do deploy.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import geopandas as gpd
import pyarrow as pa
import pyarrow.parquet as pq
from shapely.geometry import shape
from shapely import wkb


def _load_items(items_dir: Path) -> list[dict[str, Any]]:
    """Recursively load all STAC Item JSON files from the items directory."""
    items: list[dict[str, Any]] = []
    for json_path in sorted(items_dir.rglob("*.json")):
        with open(json_path, "r", encoding="utf-8") as f:
            item = json.load(f)
        if item.get("type") == "Feature":
            items.append(item)
    return items


def _flatten_item(item: dict[str, Any]) -> dict[str, Any]:
    """Flatten a STAC Item dict for the geoparquet table.

    Follows stac-geoparquet conventions:
    - geometry stored as WKB
    - bbox as JSON array string
    - assets as JSON string
    - links as JSON string
    - properties are flattened to top-level columns
    """
    row: dict[str, Any] = {
        "type": item.get("type", "Feature"),
        "stac_version": item.get("stac_version", ""),
        "id": item["id"],
        "collection": item.get("collection", ""),
    }

    # Geometry → WKB bytes
    geom = item.get("geometry")
    if geom:
        row["geometry"] = shape(geom)
    else:
        row["geometry"] = None

    # BBox — individual columns for efficient DuckDB queries
    bbox = item.get("bbox")
    row["bbox"] = json.dumps(bbox) if bbox else None
    if bbox and len(bbox) >= 4:
        row["bbox_xmin"] = bbox[0]
        row["bbox_ymin"] = bbox[1]
        row["bbox_xmax"] = bbox[2]
        row["bbox_ymax"] = bbox[3]
    else:
        row["bbox_xmin"] = None
        row["bbox_ymin"] = None
        row["bbox_xmax"] = None
        row["bbox_ymax"] = None

    # Flatten properties
    props = item.get("properties", {})
    for key, value in props.items():
        row[key] = value

    # Assets and links as JSON strings
    row["assets"] = json.dumps(item.get("assets", {}))
    row["links"] = json.dumps(item.get("links", []))

    # STAC extensions
    row["stac_extensions"] = json.dumps(item.get("stac_extensions", []))

    return row


def build_geoparquet(catalog_dir: str | Path, output_path: str | Path | None = None) -> Path:
    """Build a single GeoParquet file from all STAC items in the catalog.

    Args:
        catalog_dir: Root catalog directory containing items/ subdirectory.
        output_path: Output parquet file path. Defaults to catalog_dir/items.parquet.

    Returns:
        Path to the generated parquet file.
    """
    catalog_path = Path(catalog_dir)
    items_dir = catalog_path / "items"

    if not items_dir.exists():
        raise FileNotFoundError(f"Items directory not found: {items_dir}")

    items = _load_items(items_dir)
    if not items:
        raise ValueError(f"No STAC items found in {items_dir}")

    print(f"Building GeoParquet from {len(items)} items...")

    rows = [_flatten_item(item) for item in items]

    gdf = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")

    out_path = Path(output_path) if output_path else catalog_path / "items.parquet"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    gdf.to_parquet(out_path, engine="pyarrow", index=False)

    print(f"GeoParquet written: {out_path} ({len(rows)} rows, "
          f"{out_path.stat().st_size / 1024:.1f} KB)")

    return out_path
