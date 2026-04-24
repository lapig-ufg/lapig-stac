#!/usr/bin/env python3
"""Run the LAPIG STAC pipeline."""

from pathlib import Path

from pipeline.local_scanner import scan_local_data
from pipeline.generate_stac import generate_catalog, scan_result_to_parse_result
from pipeline.load_pgstac import export_ndjson
from pipeline.validate_catalog import validate_catalog

DATA_DIR = Path(__file__).parent.parent / "data"
OUTPUT_DIR = Path(__file__).parent.parent / "catalog"
BASE_URL = "https://s3.lapig.iesa.ufg.br/stac/col10"

print(f"Data dir: {DATA_DIR}")
print(f"Output:   {OUTPUT_DIR}")

# 1. Scan
scan = scan_local_data(DATA_DIR)

# 2. Convert
result = scan_result_to_parse_result(scan, BASE_URL)

# 3. Generate
generate_catalog(result, OUTPUT_DIR)

# 4. Validate
files, errors, msgs = validate_catalog(OUTPUT_DIR)
print(f"Validation: {files} files, {errors} errors")
for m in msgs:
    print(f"  ERROR: {m}")

# 5. Export ndjson (consumido por pypgstac load no boot dos containers)
export_ndjson(OUTPUT_DIR)

print("Pipeline complete!")
