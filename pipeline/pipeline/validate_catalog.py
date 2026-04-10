"""Validate generated STAC JSON files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _load_json(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _validate_structure(data: dict[str, Any], path: Path) -> list[str]:
    """Perform basic structural validation on a STAC object."""
    errors: list[str] = []
    filename = str(path)

    stac_type = data.get("type")

    if stac_type == "Catalog":
        for field in ("id", "description", "links"):
            if field not in data:
                errors.append(f"{filename}: missing required field '{field}'")

    elif stac_type == "Collection":
        for field in ("id", "description", "license", "extent", "links"):
            if field not in data:
                errors.append(f"{filename}: missing required field '{field}'")
        extent = data.get("extent", {})
        if "spatial" not in extent or "temporal" not in extent:
            errors.append(f"{filename}: extent must have 'spatial' and 'temporal'")

    elif stac_type == "Feature":
        for field in ("id", "geometry", "bbox", "properties", "assets", "links"):
            if field not in data:
                errors.append(f"{filename}: missing required field '{field}'")
        props = data.get("properties", {})
        if "datetime" not in props:
            errors.append(f"{filename}: properties missing 'datetime'")
        if props.get("datetime") is None:
            if "start_datetime" not in props or "end_datetime" not in props:
                errors.append(
                    f"{filename}: datetime is null but start_datetime/end_datetime "
                    f"not provided"
                )

    else:
        errors.append(f"{filename}: unknown STAC type '{stac_type}'")

    # Check STAC version
    version = data.get("stac_version")
    if version != "1.1.0":
        errors.append(f"{filename}: stac_version is '{version}', expected '1.1.0'")

    return errors


def validate_catalog(catalog_dir: str | Path) -> tuple[int, int, list[str]]:
    """Validate all STAC JSON files in the catalog directory.

    Returns:
        Tuple of (files_checked, errors_count, error_messages).
    """
    root = Path(catalog_dir)
    all_errors: list[str] = []
    files_checked = 0

    # Validate catalog.json
    catalog_path = root / "catalog.json"
    if catalog_path.exists():
        data = _load_json(catalog_path)
        all_errors.extend(_validate_structure(data, catalog_path))
        files_checked += 1
    else:
        all_errors.append(f"catalog.json not found in {root}")

    # Validate collection files
    collections_dir = root / "collections"
    if collections_dir.exists():
        for cpath in sorted(collections_dir.glob("*.json")):
            data = _load_json(cpath)
            all_errors.extend(_validate_structure(data, cpath))
            files_checked += 1

    # Validate item files
    items_dir = root / "items"
    if items_dir.exists():
        for ipath in sorted(items_dir.rglob("*.json")):
            data = _load_json(ipath)
            all_errors.extend(_validate_structure(data, ipath))
            files_checked += 1

    return files_checked, len(all_errors), all_errors


def validate_with_stac_validator(catalog_dir: str | Path) -> tuple[int, int, list[str]]:
    """Validate using the stac-validator library (optional dependency).

    Returns:
        Tuple of (files_checked, errors_count, error_messages).
    """
    try:
        from stac_validator import stac_validator
    except ImportError:
        return 0, 1, [
            "stac-validator not installed. "
            "Install with: pip install 'lapig-stac-pipeline[validate]'"
        ]

    root = Path(catalog_dir)
    all_errors: list[str] = []
    files_checked = 0

    json_files = list(root.rglob("*.json"))
    for json_path in sorted(json_files):
        stac = stac_validator.StacValidate(str(json_path))
        stac.run()
        files_checked += 1
        if not stac.valid:
            for msg in stac.message:
                if isinstance(msg, dict) and not msg.get("valid", True):
                    reason = msg.get("error_message", "unknown error")
                    all_errors.append(f"{json_path}: {reason}")
                elif isinstance(msg, str):
                    all_errors.append(f"{json_path}: {msg}")

    return files_checked, len(all_errors), all_errors
