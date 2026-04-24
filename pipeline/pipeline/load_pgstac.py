"""Exporta o catálogo STAC como ndjson e carrega em pgstac.

Duas etapas complementares:

1. `export_ndjson(catalog_dir)` — lê `collections/*.json` e `items/**/*.json`
   e escreve `collections.ndjson` e `items.ndjson` na raiz do catálogo.
   Esses arquivos viram artefato do build Docker, copiado para dentro da
   imagem e consumido pelo entrypoint.

2. `load_to_pgstac(catalog_dir, dsn, method)` — opcional; usado no boot do
   container (ou em desenvolvimento) para inserir/atualizar os registros no
   Postgres. Chama `pypgstac.load.Loader` programaticamente em vez de
   depender do CLI para obter mensagens de erro mais úteis.

Os JSONs do catálogo são gerados em `pipeline/generate_stac.py` e já estão
no schema STAC 1.1.0. Links navegacionais (self/root/parent/items/item)
podem permanecer — o pgstac armazena o item tal como vier; a API regera
dinamicamente se necessário.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Iterable

logger = logging.getLogger(__name__)


def _iter_collection_files(catalog_dir: Path) -> Iterable[Path]:
    return sorted((catalog_dir / "collections").glob("*.json"))


def _iter_item_files(catalog_dir: Path) -> Iterable[Path]:
    return sorted((catalog_dir / "items").rglob("*.json"))


def _write_ndjson(records: Iterable[dict], path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with open(path, "w", encoding="utf-8") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
            f.write("\n")
            count += 1
    return count


def export_ndjson(catalog_dir: str | Path) -> tuple[Path, Path]:
    """Emite `collections.ndjson` e `items.ndjson` a partir dos JSONs do catálogo.

    Retorna os paths dos dois arquivos emitidos.
    """
    root = Path(catalog_dir)

    collections_path = root / "collections.ndjson"
    items_path = root / "items.ndjson"

    col_count = _write_ndjson(
        (json.loads(p.read_text(encoding="utf-8")) for p in _iter_collection_files(root)),
        collections_path,
    )
    item_count = _write_ndjson(
        (json.loads(p.read_text(encoding="utf-8")) for p in _iter_item_files(root)),
        items_path,
    )

    logger.info("ndjson export: %d collections, %d items", col_count, item_count)
    return collections_path, items_path


def load_to_pgstac(
    catalog_dir: str | Path,
    dsn: str,
    method: str = "upsert",
) -> tuple[int, int]:
    """Carrega `collections.ndjson` e `items.ndjson` em uma instância pgstac.

    Usa `pypgstac.load.Loader` diretamente. Não aplica migrações — isso é
    responsabilidade do entrypoint (`pypgstac migrate`) ou do CI.

    Args:
        catalog_dir: Diretório raiz do catálogo (contém os ndjson).
        dsn: URL de conexão (postgresql://user:pass@host:port/db).
        method: Estratégia de escrita — `insert`, `ignore`, `upsert`,
            `delsert`, `insert_ignore`. `upsert` é o padrão seguro para
            ingestões idempotentes executadas em cada boot.

    Returns:
        Tupla (collections_carregadas, items_carregados).
    """
    from pypgstac.db import PgstacDB
    from pypgstac.load import Loader, Methods, Tables

    root = Path(catalog_dir)
    collections_path = root / "collections.ndjson"
    items_path = root / "items.ndjson"

    if not collections_path.exists() or not items_path.exists():
        export_ndjson(root)

    method_enum = Methods(method)

    with PgstacDB(dsn=dsn) as db:
        loader = Loader(db=db)
        loader.load_collections(str(collections_path), insert_mode=method_enum)
        loader.load_items(
            str(items_path),
            insert_mode=method_enum,
            # Os itens vêm completos (hydrated); o pgstac dehidrata
            # internamente para economizar espaço.
            dehydrated=False,
        )

    with open(collections_path, encoding="utf-8") as f:
        collections_loaded = sum(1 for _ in f)
    with open(items_path, encoding="utf-8") as f:
        items_loaded = sum(1 for _ in f)

    return collections_loaded, items_loaded
