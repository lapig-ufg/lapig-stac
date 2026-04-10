"""Enrich STAC Items with real metadata extracted from COG files.

Reads each COG and updates the corresponding STAC Item JSON with:
  - proj:epsg, proj:shape, proj:transform (from CRS/GeoTransform)
  - raster:bands (data_type, nodata, statistics)
  - file:size, file:checksum (SHA-256 multihash)
  - Precise bbox and geometry (from GeoTransform, not hardcoded)
  - properties.created / properties.updated timestamps

Also adds STAC extensions to the extensions list.
"""

from __future__ import annotations

import hashlib
import json
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from osgeo import gdal
from shapely.geometry import Polygon, mapping

gdal.UseExceptions()

STAC_EXTENSIONS = [
    "https://stac-extensions.github.io/projection/v2.0.0/schema.json",
    "https://stac-extensions.github.io/raster/v2.0.0/schema.json",
    "https://stac-extensions.github.io/file/v2.0.0/schema.json",
]

NOW_ISO = datetime.now(timezone.utc).isoformat()


def _sha256_multihash(path: Path, chunk_size: int = 65536) -> str:
    """Compute SHA-256 multihash (0x1220 prefix + hex digest)."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return f"1220{h.hexdigest()}"


def _extract_cog_metadata(cog_path: Path) -> dict[str, Any]:
    """Extract metadata from a COG file using GDAL."""
    ds = gdal.Open(str(cog_path), gdal.GA_ReadOnly)
    if ds is None:
        raise RuntimeError(f"Cannot open {cog_path}")

    gt = ds.GetGeoTransform()
    srs = ds.GetSpatialRef()
    epsg = int(srs.GetAuthorityCode(None)) if srs else 4326

    xsize = ds.RasterXSize
    ysize = ds.RasterYSize

    west = gt[0]
    north = gt[3]
    east = gt[0] + gt[1] * xsize
    south = gt[3] + gt[5] * ysize

    band = ds.GetRasterBand(1)
    nodata = band.GetNoDataValue()
    dtype = gdal.GetDataTypeName(band.DataType).lower()

    # Statistics (min, max, mean, stddev)
    stats = band.GetStatistics(True, True)
    raster_stats = None
    if stats and stats[0] is not None:
        raster_stats = {
            "minimum": stats[0],
            "maximum": stats[1],
            "mean": round(stats[2], 6),
            "stddev": round(stats[3], 6),
        }

    ds = None

    file_size = os.path.getsize(cog_path)

    return {
        "epsg": epsg,
        "shape": [ysize, xsize],
        "transform": [gt[1], gt[2], gt[0], gt[4], gt[5], gt[3]],
        "bbox": [west, south, east, north],
        "dtype": dtype,
        "nodata": nodata,
        "stats": raster_stats,
        "file_size": file_size,
    }


def enrich_item(item_json_path: Path, cog_dir: Path, thumb_dir: Path) -> tuple[bool, str]:
    """Enrich a single STAC Item JSON with COG metadata.

    Returns (success, message).
    """
    try:
        with open(item_json_path, encoding="utf-8") as f:
            item = json.load(f)

        collection_id = item.get("collection", "")
        item_id = item["id"]

        # Find the COG file
        data_asset = item.get("assets", {}).get("data", {})
        cog_filename = Path(data_asset.get("href", "")).name
        cog_path = cog_dir / collection_id / cog_filename

        if not cog_path.exists():
            return False, f"COG not found: {cog_path}"

        meta = _extract_cog_metadata(cog_path)

        # Update bbox and geometry with real values
        w, s, e, n = meta["bbox"]
        item["bbox"] = [round(w, 6), round(s, 6), round(e, 6), round(n, 6)]
        item["geometry"] = mapping(Polygon([
            (w, s), (e, s), (e, n), (w, n), (w, s),
        ]))

        # Update extensions
        item["stac_extensions"] = STAC_EXTENSIONS

        # Update properties
        props = item.setdefault("properties", {})
        props["proj:epsg"] = meta["epsg"]
        props["proj:shape"] = meta["shape"]
        props["proj:transform"] = meta["transform"]
        props["created"] = NOW_ISO
        props["updated"] = NOW_ISO

        # Raster bands
        raster_band: dict[str, Any] = {
            "data_type": meta["dtype"],
            "nodata": meta["nodata"],
        }
        if meta["stats"]:
            raster_band["statistics"] = meta["stats"]
        props["raster:bands"] = [raster_band]

        # File extension on data asset
        data_asset["file:size"] = meta["file_size"]
        data_asset["proj:shape"] = meta["shape"]
        data_asset["proj:transform"] = meta["transform"]

        # Checksum (SHA-256 multihash) — skip for large files to save time
        if meta["file_size"] < 500 * 1024 * 1024:  # < 500 MB
            data_asset["file:checksum"] = _sha256_multihash(cog_path)

        # Thumbnail file:size
        thumb_path = thumb_dir / collection_id / f"{item_id}.png"
        if thumb_path.exists():
            thumb_asset = item.get("assets", {}).get("thumbnail", {})
            thumb_asset["file:size"] = os.path.getsize(thumb_path)

        # Write back
        with open(item_json_path, "w", encoding="utf-8") as f:
            json.dump(item, f, indent=2, ensure_ascii=False, default=str)
            f.write("\n")

        return True, f"Enriched: {item_id}"

    except Exception as e:
        return False, f"Error enriching {item_json_path.name}: {e}"


def enrich_all_items(
    catalog_dir: Path,
    workers: int = 8,
) -> tuple[int, int, list[str]]:
    """Enrich all STAC Items in the catalog with COG metadata.

    Args:
        catalog_dir: Root catalog directory.
        workers: Number of parallel workers.

    Returns:
        (ok_count, error_count, error_messages)
    """
    items_dir = catalog_dir / "items"
    cog_dir = catalog_dir / "cogs"
    thumb_dir = catalog_dir / "thumbnails"

    if not items_dir.exists():
        raise FileNotFoundError(f"Items directory not found: {items_dir}")

    json_files = sorted(items_dir.rglob("*.json"))
    total = len(json_files)
    print(f"Enriching {total} items with COG metadata ({workers} workers)...")

    ok_count = 0
    errors: list[str] = []

    with ProcessPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(enrich_item, f, cog_dir, thumb_dir): f.name
            for f in json_files
        }

        for future in as_completed(futures):
            success, msg = future.result()
            if success:
                ok_count += 1
                if ok_count % 10 == 0 or ok_count == total:
                    print(f"  [{ok_count}/{total}] {msg}")
            else:
                errors.append(msg)
                print(f"  [ERROR] {msg}")

    print(f"Enrichment complete: {ok_count}/{total} OK, {len(errors)} errors")
    return ok_count, len(errors), errors
