"""Scan local data directories and build STAC item definitions from YAML config.

Reads collection definitions from config/collections.yaml and scans the local
filesystem for matching GeoTIFF files.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

import yaml


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ProviderConfig:
    """Provider definition loaded from YAML."""

    name: str
    description: str
    roles: list[str]
    url: str


@dataclass(frozen=True)
class ClassEntry:
    """A single classification value with label and color."""

    value: int
    label: str
    color: str


@dataclass(frozen=True)
class StylePaths:
    """Paths to style files (relative to pipeline/ dir)."""

    sld: str | None = None
    qml: str | None = None


@dataclass(frozen=True)
class CollectionConfig:
    """Collection definition loaded from YAML."""

    id: str
    title: str
    description: str
    license: str
    keywords: tuple[str, ...]
    source_dir: str
    filename_pattern: str
    providers: tuple[ProviderConfig, ...]
    spatial_extent: tuple[float, ...]  # (west, south, east, north)
    gsd: float
    data_type: str
    nodata: int
    unit: str
    styles: StylePaths = StylePaths()
    classification: tuple[ClassEntry, ...] = ()


@dataclass
class CatalogConfig:
    """Catalog root definition from YAML."""

    id: str
    title: str
    description: str


@dataclass
class ScannedItem:
    """A single discovered GeoTIFF file."""

    item_id: str
    collection_id: str
    year: int
    filename: str
    file_path: Path
    file_size: int


@dataclass
class ScanResult:
    """Aggregated result of scanning all configured collections."""

    catalog: CatalogConfig
    providers: dict[str, ProviderConfig]
    collections: list[CollectionConfig]
    items: dict[str, list[ScannedItem]] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# YAML loader
# ---------------------------------------------------------------------------

_DEFAULT_CONFIG = Path(__file__).parent.parent / "config" / "collections.yaml"


def load_config(config_path: Path | None = None) -> tuple[CatalogConfig, dict[str, ProviderConfig], list[CollectionConfig]]:
    """Load and parse the YAML configuration file.

    Args:
        config_path: Path to collections.yaml. Uses default if None.

    Returns:
        Tuple of (catalog, providers_map, collections).
    """
    path = config_path or _DEFAULT_CONFIG
    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f)

    # Catalog
    cat_data = data.get("catalog", {})
    catalog = CatalogConfig(
        id=cat_data.get("id", "lapig-stac"),
        title=cat_data.get("title", "LAPIG Data Catalog"),
        description=cat_data.get("description", ""),
    )

    # Providers
    providers_map: dict[str, ProviderConfig] = {}
    for key, prov_data in data.get("providers", {}).items():
        providers_map[key] = ProviderConfig(
            name=prov_data["name"],
            description=prov_data.get("description", ""),
            roles=prov_data.get("roles", []),
            url=prov_data.get("url", ""),
        )

    # Collections
    collections: list[CollectionConfig] = []
    for entry in data.get("collections", []):
        # Resolve provider references
        prov_refs = entry.get("providers_ref", [])
        resolved_providers = tuple(
            providers_map[ref] for ref in prov_refs if ref in providers_map
        )

        # Styles
        styles_data = entry.get("styles", {})
        styles = StylePaths(
            sld=styles_data.get("sld"),
            qml=styles_data.get("qml"),
        )

        # Classification
        classification = tuple(
            ClassEntry(
                value=int(c["value"]),
                label=c["label"],
                color=c["color"],
            )
            for c in entry.get("classification", [])
        )

        collections.append(CollectionConfig(
            id=entry["id"],
            title=entry["title"],
            description=entry["description"],
            license=entry.get("license", "proprietary"),
            keywords=tuple(entry.get("keywords", [])),
            source_dir=entry["source_dir"],
            filename_pattern=entry["filename_pattern"],
            providers=resolved_providers,
            spatial_extent=tuple(entry.get("spatial_extent", [-180, -90, 180, 90])),
            gsd=float(entry.get("gsd", 30.0)),
            data_type=entry.get("data_type", "uint8"),
            nodata=int(entry.get("nodata", 0)),
            unit=entry.get("unit", ""),
            styles=styles,
            classification=classification,
        ))

    return catalog, providers_map, collections


# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------

def scan_local_data(
    data_root: Path,
    config_path: Path | None = None,
) -> ScanResult:
    """Scan data directories for GeoTIFF files matching YAML-defined collections.

    Args:
        data_root: Absolute path to the root data directory
                   (e.g., /home/user/lapig-stac/data).
        config_path: Path to collections.yaml. Uses default if None.

    Returns:
        ScanResult with catalog info, providers, collections, and items.
    """
    data_root = data_root.resolve()
    if not data_root.is_dir():
        raise FileNotFoundError(f"Data root directory not found: {data_root}")

    catalog, providers_map, collections = load_config(config_path)
    result = ScanResult(
        catalog=catalog,
        providers=providers_map,
        collections=collections,
    )

    for config in collections:
        source_path = data_root / config.source_dir

        if not source_path.is_dir():
            print(f"  Warning: source directory not found, skipping: {source_path}")
            result.items[config.id] = []
            continue

        pattern = re.compile(config.filename_pattern)
        scanned: list[ScannedItem] = []

        for tif_path in sorted(source_path.glob("*.tif")):
            match = pattern.match(tif_path.name)
            if not match:
                continue

            year = int(match.group(1))
            item_id = f"{config.id}-{year}"

            scanned.append(ScannedItem(
                item_id=item_id,
                collection_id=config.id,
                year=year,
                filename=tif_path.name,
                file_path=tif_path,
                file_size=tif_path.stat().st_size,
            ))

        result.items[config.id] = scanned
        print(f"  {config.id}: found {len(scanned)} items in {source_path}")

    total = sum(len(v) for v in result.items.values())
    print(f"  Total: {len(result.collections)} collections, {total} items")

    return result
