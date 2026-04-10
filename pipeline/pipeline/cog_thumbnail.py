"""COG conversion and thumbnail generation for MapBiomas rasters.

Converts source GeoTIFFs to Cloud Optimized GeoTIFFs and generates
styled PNG thumbnails in parallel, with explicit memory control.

Memory strategy:
  - GDAL_CACHEMAX=512 MB per COG subprocess
  - NUM_THREADS=2 per gdal_translate (limits internal GDAL thread count)
  - Workers capped at 4 for COGs (~2-3 GB peak each → ~12 GB total)
  - Thumbnails are lightweight (~50 MB peak each), 8 workers is safe
  - Skips files that already exist (resume support)
"""

from __future__ import annotations

import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from osgeo import gdal

gdal.UseExceptions()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# Memory limit per GDAL subprocess (MB)
GDAL_CACHEMAX_MB = 512

# COG creation options — optimized for categorical Byte rasters
COG_OPTIONS = [
    "-of", "COG",
    "-co", "COMPRESS=DEFLATE",
    "-co", "LEVEL=9",
    "-co", "BLOCKSIZE=256",
    "-co", "OVERVIEWS=AUTO",
    "-co", "OVERVIEW_RESAMPLING=NEAREST",
    "-co", "NUM_THREADS=2",
    "-co", "BIGTIFF=IF_SAFER",
]

THUMBNAIL_WIDTH = 512

# Color palettes: collection_id → { pixel_value → (R, G, B, A) }
COLOR_PALETTES: dict[str, dict[int, tuple[int, int, int, int]]] = {
    "pasture-area": {
        0: (0, 0, 0, 0),
        1: (232, 215, 76, 255),     # #E8D74C
    },
    "pasture-vigor": {
        0: (0, 0, 0, 0),
        1: (211, 47, 47, 255),      # #D32F2F
        2: (255, 179, 0, 255),      # #FFB300
        3: (56, 142, 60, 255),      # #388E3C
    },
}


@dataclass
class ConversionTask:
    src_path: Path
    cog_path: Path
    thumb_path: Path
    collection_id: str
    item_id: str


# ---------------------------------------------------------------------------
# COG conversion
# ---------------------------------------------------------------------------

def convert_to_cog(src: Path, dst: Path) -> tuple[bool, str]:
    """Convert a GeoTIFF to COG. Skips if dst already exists."""
    if dst.exists():
        return True, f"COG skip (exists): {dst.name}"

    dst.parent.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    env["GDAL_CACHEMAX"] = str(GDAL_CACHEMAX_MB)

    cmd = ["gdal_translate"] + COG_OPTIONS + [str(src), str(dst)]

    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            timeout=900, env=env,
        )
        if result.returncode != 0:
            # Clean up partial file
            dst.unlink(missing_ok=True)
            return False, f"gdal_translate failed for {src.name}: {result.stderr[:300]}"

        size_mb = dst.stat().st_size / 1024 / 1024
        return True, f"COG: {dst.name} ({size_mb:.1f} MB)"

    except subprocess.TimeoutExpired:
        dst.unlink(missing_ok=True)
        return False, f"Timeout (15 min) converting {src.name}"
    except Exception as e:
        dst.unlink(missing_ok=True)
        return False, f"Error converting {src.name}: {e}"


# ---------------------------------------------------------------------------
# Thumbnail generation
# ---------------------------------------------------------------------------

def generate_thumbnail(src: Path, dst: Path, collection_id: str) -> tuple[bool, str]:
    """Generate a styled PNG thumbnail. Skips if dst already exists."""
    if dst.exists():
        return True, f"Thumb skip (exists): {dst.name}"

    dst.parent.mkdir(parents=True, exist_ok=True)
    palette = COLOR_PALETTES.get(collection_id, COLOR_PALETTES["pasture-area"])

    try:
        ds = gdal.Open(str(src), gdal.GA_ReadOnly)
        if ds is None:
            return False, f"Cannot open {src.name}"

        xsize = ds.RasterXSize
        ysize = ds.RasterYSize
        thumb_w = THUMBNAIL_WIDTH
        thumb_h = max(1, int(ysize * (THUMBNAIL_WIDTH / xsize)))

        band = ds.GetRasterBand(1)
        data = band.ReadAsArray(buf_xsize=thumb_w, buf_ysize=thumb_h)
        ds = None

        if data is None:
            return False, f"Failed to read {src.name}"

        # Apply color palette → RGBA
        rgba = np.zeros((thumb_h, thumb_w, 4), dtype=np.uint8)
        for value, color in palette.items():
            mask = data == value
            for c in range(4):
                rgba[:, :, c][mask] = color[c]

        # Write PNG via MEM → CreateCopy (PNG driver has no Create)
        mem_drv = gdal.GetDriverByName("MEM")
        mem_ds = mem_drv.Create("", thumb_w, thumb_h, 4, gdal.GDT_Byte)
        for i in range(4):
            mem_ds.GetRasterBand(i + 1).WriteArray(rgba[:, :, i])

        png_drv = gdal.GetDriverByName("PNG")
        png_drv.CreateCopy(str(dst), mem_ds, strict=0)
        mem_ds = None

        return True, f"Thumb: {dst.name} ({thumb_w}×{thumb_h})"

    except Exception as e:
        dst.unlink(missing_ok=True)
        return False, f"Thumbnail error for {src.name}: {e}"


# ---------------------------------------------------------------------------
# Workers
# ---------------------------------------------------------------------------

def _process_cog(task: ConversionTask) -> tuple[str, bool, str]:
    ok, msg = convert_to_cog(task.src_path, task.cog_path)
    return task.item_id, ok, msg


def _process_thumb(task: ConversionTask) -> tuple[str, bool, str]:
    ok, msg = generate_thumbnail(task.src_path, task.thumb_path, task.collection_id)
    return task.item_id, ok, msg


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------

def run_conversions(
    tasks: list[ConversionTask],
    cog_workers: int = 4,
    thumb_workers: int = 8,
) -> tuple[int, int, list[str]]:
    """Run COG conversions and thumbnails in parallel with memory control.

    COGs and thumbnails run in separate pools concurrently.
    Already-existing outputs are skipped automatically.

    Args:
        tasks: Conversion tasks.
        cog_workers: Parallel COG processes (default 4, ~12 GB peak).
        thumb_workers: Parallel thumbnail processes (default 8, lightweight).

    Returns:
        (cog_ok_count, error_count, error_messages)
    """
    total = len(tasks)
    errors: list[str] = []

    # Estimate peak memory
    peak_gb = cog_workers * 3  # ~3 GB per COG process worst case
    print(f"Processing {total} files")
    print(f"  COG workers: {cog_workers} (est. peak ~{peak_gb} GB RAM)")
    print(f"  Thumbnail workers: {thumb_workers}")
    print(f"  GDAL_CACHEMAX: {GDAL_CACHEMAX_MB} MB per process")

    cog_ok = 0
    thumb_ok = 0

    with ProcessPoolExecutor(max_workers=cog_workers) as cog_pool, \
         ProcessPoolExecutor(max_workers=thumb_workers) as thumb_pool:

        cog_futures = {cog_pool.submit(_process_cog, t): t.item_id for t in tasks}
        thumb_futures = {thumb_pool.submit(_process_thumb, t): t.item_id for t in tasks}

        # COG results
        for future in as_completed(cog_futures):
            item_id, success, msg = future.result()
            if success:
                cog_ok += 1
                print(f"  [{cog_ok}/{total}] {msg}")
            else:
                errors.append(msg)
                print(f"  [ERROR] {msg}", file=sys.stderr)

        # Thumbnail results
        for future in as_completed(thumb_futures):
            item_id, success, msg = future.result()
            if success:
                thumb_ok += 1
            else:
                errors.append(msg)
                print(f"  [THUMB ERROR] {msg}", file=sys.stderr)

    print(f"  COGs: {cog_ok}/{total} | Thumbs: {thumb_ok}/{total} | Errors: {len(errors)}")
    return cog_ok, len(errors), errors


def build_tasks_from_scan(scan_result, output_dir: Path) -> list[ConversionTask]:
    """Build tasks from a ScanResult.

    Output layout:
        output_dir/cogs/{collection_id}/{filename}.tif
        output_dir/thumbnails/{collection_id}/{item_id}.png
    """
    tasks: list[ConversionTask] = []
    cog_dir = output_dir / "cogs"
    thumb_dir = output_dir / "thumbnails"

    for config in scan_result.collections:
        for item in scan_result.items.get(config.id, []):
            tasks.append(ConversionTask(
                src_path=item.file_path,
                cog_path=cog_dir / config.id / item.filename,
                thumb_path=thumb_dir / config.id / f"{item.item_id}.png",
                collection_id=config.id,
                item_id=item.item_id,
            ))

    return tasks
