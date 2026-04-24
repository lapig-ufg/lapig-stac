"""CLI entry point for the LAPIG STAC pipeline."""

from __future__ import annotations

from pathlib import Path

import click


@click.group()
@click.version_option(version="0.1.0", prog_name="lapig-stac")
def main() -> None:
    """LAPIG STAC Pipeline — Generate STAC catalog from local MapBiomas data."""


# ---------------------------------------------------------------------------
# Generate (local scan → STAC JSON)
# ---------------------------------------------------------------------------

@main.command()
@click.option(
    "--data-dir", "-d",
    required=True,
    type=click.Path(exists=True),
    help="Root data directory (e.g., data/).",
)
@click.option(
    "--output", "-o",
    default="catalog",
    type=click.Path(),
    help="Output directory (default: ./catalog).",
)
@click.option(
    "--base-url",
    default="https://s3.lapig.iesa.ufg.br/stac/col10",
    help="Base URL pública (S3) para os assets de dados (COGs, thumbnails).",
)
def generate(data_dir: str, output: str, base_url: str) -> None:
    """Scan local data directories and generate STAC Collections + Items."""
    from pipeline.generate_stac import generate_catalog, scan_result_to_parse_result
    from pipeline.local_scanner import scan_local_data

    data_path = Path(data_dir).resolve()
    output_path = Path(output).resolve()

    click.echo(f"Scanning: {data_path}")
    scan = scan_local_data(data_path)

    click.echo(f"Converting to STAC (base_url={base_url})")
    parse_result = scan_result_to_parse_result(scan, base_url)

    click.echo(f"Generating STAC catalog in: {output_path}")
    generate_catalog(parse_result, output_path, scan=scan)

    click.echo("Done.")


# ---------------------------------------------------------------------------
# Build GeoParquet
# ---------------------------------------------------------------------------

@main.command("build-parquet")
@click.option(
    "--catalog-dir", "-d",
    default="catalog",
    type=click.Path(exists=True),
    help="Path to generated catalog directory (default: ./catalog).",
)
@click.option(
    "--output", "-o",
    default=None,
    type=click.Path(),
    help="Output parquet file (default: catalog_dir/items.parquet).",
)
def build_parquet(catalog_dir: str, output: str | None) -> None:
    """Build a GeoParquet file from generated STAC Items."""
    from pipeline.build_geoparquet import build_geoparquet

    catalog_path = Path(catalog_dir).resolve()
    output_path = Path(output).resolve() if output else None

    build_geoparquet(catalog_path, output_path)


# ---------------------------------------------------------------------------
# Validate
# ---------------------------------------------------------------------------

@main.command()
@click.option(
    "--catalog-dir", "-d",
    default="catalog",
    type=click.Path(exists=True),
    help="Path to generated catalog directory.",
)
def validate(catalog_dir: str) -> None:
    """Validate generated STAC JSON files."""
    from pipeline.validate_catalog import validate_catalog

    catalog_path = Path(catalog_dir).resolve()

    click.echo(f"Validating: {catalog_path}")
    files, errors, messages = validate_catalog(catalog_path)
    click.echo(f"Checked {files} files, {errors} errors")
    for msg in messages:
        click.echo(f"  ERROR: {msg}")

    if errors > 0:
        raise SystemExit(1)
    click.echo("All checks passed.")


# ---------------------------------------------------------------------------
# Enrich metadata from COGs
# ---------------------------------------------------------------------------

@main.command("enrich")
@click.option(
    "--catalog-dir", "-d",
    default="catalog",
    type=click.Path(exists=True),
    help="Catalog directory with items/, cogs/, thumbnails/.",
)
@click.option(
    "--workers", "-w",
    default=8,
    type=int,
    help="Parallel workers for metadata extraction (default: 8).",
)
def enrich(catalog_dir: str, workers: int) -> None:
    """Enrich STAC Items with real metadata from COG files (bbox, proj, raster, file)."""
    from pipeline.enrich_metadata import enrich_all_items

    catalog_path = Path(catalog_dir).resolve()
    ok, errs, msgs = enrich_all_items(catalog_path, workers)

    click.echo(f"Enriched: {ok} items, {errs} errors")
    if errs > 0:
        for m in msgs:
            click.echo(f"  ERROR: {m}")
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# COG + Thumbnail generation
# ---------------------------------------------------------------------------

@main.command("convert")
@click.option(
    "--data-dir", "-d",
    required=True,
    type=click.Path(exists=True),
    help="Root data directory.",
)
@click.option(
    "--output", "-o",
    default="catalog",
    type=click.Path(),
    help="Output directory (COGs and thumbnails saved here).",
)
@click.option(
    "--cog-workers",
    default=4,
    type=int,
    help="Parallel COG conversions (default: 4, ~12 GB peak RAM).",
)
@click.option(
    "--thumb-workers",
    default=8,
    type=int,
    help="Parallel thumbnail generations (default: 8).",
)
def convert(data_dir: str, output: str, cog_workers: int, thumb_workers: int) -> None:
    """Convert source GeoTIFFs to COGs and generate thumbnails."""
    from pipeline.cog_thumbnail import build_tasks_from_scan, run_conversions
    from pipeline.local_scanner import scan_local_data

    data_path = Path(data_dir).resolve()
    output_path = Path(output).resolve()

    click.echo(f"Scanning: {data_path}")
    scan = scan_local_data(data_path)

    tasks = build_tasks_from_scan(scan, output_path)
    click.echo(f"Tasks: {len(tasks)} files to convert")

    ok, errors, messages = run_conversions(tasks, cog_workers, thumb_workers)

    click.echo(f"COGs: {ok}/{len(tasks)} OK, {errors} errors")
    if errors > 0:
        for msg in messages:
            click.echo(f"  ERROR: {msg}")
        raise SystemExit(1)

    click.echo("Conversion complete.")


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

@main.command("all")
@click.option(
    "--data-dir", "-d",
    required=True,
    type=click.Path(exists=True),
    help="Root data directory.",
)
@click.option(
    "--output", "-o",
    default="catalog",
    type=click.Path(),
    help="Output directory (default: ./catalog).",
)
@click.option(
    "--base-url",
    default="https://s3.lapig.iesa.ufg.br/stac/col10",
    help="Base URL pública (S3) para os assets de dados (COGs, thumbnails).",
)
def run_all(data_dir: str, output: str, base_url: str) -> None:
    """Run the full pipeline: scan → generate → validate → build-parquet."""
    from pipeline.build_geoparquet import build_geoparquet
    from pipeline.generate_stac import generate_catalog, scan_result_to_parse_result
    from pipeline.local_scanner import scan_local_data
    from pipeline.validate_catalog import validate_catalog

    data_path = Path(data_dir).resolve()
    output_path = Path(output).resolve()

    # 1. Scan + Generate
    click.echo(f"[1/3] Scanning: {data_path}")
    scan = scan_local_data(data_path)
    parse_result = scan_result_to_parse_result(scan, base_url)

    click.echo(f"[1/3] Generating STAC in: {output_path}")
    generate_catalog(parse_result, output_path, scan=scan)

    # 2. Validate
    click.echo("[2/3] Validating...")
    files, errors, messages = validate_catalog(output_path)
    click.echo(f"  {files} files, {errors} errors")
    for msg in messages:
        click.echo(f"  ERROR: {msg}")
    if errors > 0:
        raise SystemExit(1)

    # 3. Build GeoParquet
    click.echo("[3/3] Building GeoParquet...")
    build_geoparquet(output_path)

    click.echo("Pipeline complete.")


# ---------------------------------------------------------------------------
# pgstac — export ndjson e load no banco
# ---------------------------------------------------------------------------

@main.command("export-ndjson")
@click.option(
    "--catalog-dir", "-d",
    default="catalog",
    type=click.Path(exists=True),
    help="Diretório raiz do catálogo (contém collections/ e items/).",
)
def export_ndjson_cmd(catalog_dir: str) -> None:
    """Emite collections.ndjson e items.ndjson a partir dos JSONs do catálogo."""
    from pipeline.load_pgstac import export_ndjson

    col_path, items_path = export_ndjson(catalog_dir)
    click.echo(f"ndjson emitido:\n  {col_path}\n  {items_path}")


@main.command("load-pgstac")
@click.option(
    "--catalog-dir", "-d",
    default="catalog",
    type=click.Path(exists=True),
    help="Diretório raiz do catálogo.",
)
@click.option(
    "--dsn",
    envvar="DATABASE_URL",
    required=True,
    help="String de conexão Postgres (lê DATABASE_URL do ambiente se não passada).",
)
@click.option(
    "--method",
    default="upsert",
    type=click.Choice(["insert", "ignore", "upsert", "delsert", "insert_ignore"]),
    help="Estratégia de escrita (padrão: upsert).",
)
def load_pgstac_cmd(catalog_dir: str, dsn: str, method: str) -> None:
    """Emite ndjson (se faltar) e carrega o catálogo em uma instância pgstac."""
    from pipeline.load_pgstac import load_to_pgstac

    collections, items = load_to_pgstac(catalog_dir, dsn=dsn, method=method)
    click.echo(f"Carregado: {collections} collections, {items} items (method={method}).")


if __name__ == "__main__":
    main()
