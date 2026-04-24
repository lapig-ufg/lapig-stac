"""Wrapper do stac-fastapi-pgstac que enriquece a landing page.

Motivação:

O `stac_fastapi.pgstac.app` gera a landing page (`GET /`) dinamicamente,
apenas com links navegacionais (`self`, `root`, `data`, `search`, ...).
Para propagar, na landing, links que pertencem ao conjunto do catálogo
(em especial `rel: stylesheet` dos items), interceptamos a resposta e
mesclamos os links únicos encontrados no próprio banco pgstac.

Nenhum arquivo estático é lido: o banco é a fonte da verdade. A lista é
cacheada em memória após a primeira request ao endpoint.

Uso:

    uvicorn stac_api_app:app --host 127.0.0.1 --port 7822 --root-path /api
"""

from __future__ import annotations

import json
import logging
import os
from urllib.parse import urlparse, unquote

import psycopg
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from stac_fastapi.pgstac.app import app

logger = logging.getLogger(__name__)


# Links que o stac-fastapi emite em toda landing; não duplicamos.
_GENERATED_RELS: frozenset[str] = frozenset({
    "self", "root", "parent", "child", "data", "search",
    "conformance", "service-desc", "service-doc", "queryables",
    "collections",
})

# Rels interessantes: cross-catalog (não específicos de um Item). Para
# stylesheets isso bate — o arquivo SLD/QML é da collection, replicado
# em cada item.
_PROPAGATED_RELS: frozenset[str] = frozenset({"stylesheet"})


def _build_dsn() -> str | None:
    """Retorna uma DSN Postgres a partir de DATABASE_URL ou PG* env vars."""
    if dsn := os.environ.get("DATABASE_URL"):
        return dsn
    user = os.environ.get("PGUSER")
    pwd = os.environ.get("PGPASSWORD")
    host = os.environ.get("PGHOST")
    port = os.environ.get("PGPORT", "5432")
    dbname = os.environ.get("PGDATABASE")
    if user and host and dbname:
        auth = f"{user}:{pwd}" if pwd else user
        return f"postgresql://{auth}@{host}:{port}/{dbname}"
    return None


def _fetch_propagated_links() -> list[dict]:
    """Busca links únicos (por href) com rel em _PROPAGATED_RELS nos items.

    Retorna lista deduplicada preservando title e type. Falhas silenciosas:
    se o banco estiver indisponível ou o schema não existir, retorna [].
    """
    dsn = _build_dsn()
    if not dsn:
        logger.warning("DATABASE_URL/PG* não definidas — landing sem links extras")
        return []
    try:
        with psycopg.connect(dsn, connect_timeout=5) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (link->>'href')
                    link->>'href'    AS href,
                    link->>'rel'     AS rel,
                    link->>'type'    AS type,
                    link->>'title'   AS title
                FROM pgstac.items,
                     jsonb_array_elements(content->'links') AS link
                WHERE link->>'rel' = ANY(%s)
                ORDER BY link->>'href'
                """,
                (list(_PROPAGATED_RELS),),
            )
            rows = cur.fetchall()
    except psycopg.Error as exc:
        logger.warning("falha ao consultar links extras no pgstac: %s", exc)
        return []

    links: list[dict] = []
    for href, rel, mime, title in rows:
        entry: dict[str, str] = {"rel": rel, "href": href}
        if mime:
            entry["type"] = mime
        if title:
            entry["title"] = title
        links.append(entry)
    logger.info("landing terá %d link(s) extra(s) carregados do pgstac", len(links))
    return links


# Carrega uma vez, na importação do módulo (após pypgstac load no boot).
EXTRA_LINKS: list[dict] = _fetch_propagated_links()


class LandingPageLinksMiddleware(BaseHTTPMiddleware):
    """Mescla `EXTRA_LINKS` na resposta GET da landing page (`/`)."""

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # `request.url.path` inclui o `root_path` quando o uvicorn é iniciado
        # com --root-path=/api. Normalizamos removendo o prefixo para
        # comparar só a rota STAC (esperamos "/" ou "").
        root_path = request.scope.get("root_path", "") or ""
        path = request.url.path
        if root_path and path.startswith(root_path):
            path = path[len(root_path):]
        path = path.rstrip("/")
        if (
            not EXTRA_LINKS
            or request.method != "GET"
            or path != ""
            or "json" not in (response.headers.get("content-type") or "").lower()
        ):
            return response

        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
            )

        if isinstance(data, dict):
            # Evita duplicar um link que o stac-fastapi já tenha emitido
            existing_hrefs = {
                l.get("href") for l in data.get("links", []) if isinstance(l, dict)
            }
            new_links = [l for l in EXTRA_LINKS if l.get("href") not in existing_hrefs]
            data.setdefault("links", []).extend(new_links)

        new_body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        headers = dict(response.headers)
        headers.pop("content-length", None)
        return Response(
            content=new_body,
            status_code=response.status_code,
            headers=headers,
            media_type="application/json",
        )


# Adicionamos nosso middleware com cuidado quanto à ordem:
#
# O stac-fastapi-pgstac já registra BrotliMiddleware, que comprime a
# response antes de devolver ao cliente. Se nosso middleware for o mais
# externo (`app.add_middleware`, que faz `insert(0, ...)`), vamos receber
# o body já comprimido e não conseguimos parsear JSON. Precisamos estar
# no lado "interno" do Brotli — appendamos ao final de `user_middleware`
# para que o nosso wrapper role depois que o Brotli descomprimiu/antes
# dele comprimir na volta.
#
# O stac_fastapi também monta `middleware_stack` durante a construção
# do StacApi; limpamos o cache para forçar rebuild com a nova ordem.
from starlette.middleware import Middleware
app.user_middleware.append(Middleware(LandingPageLinksMiddleware))
app.middleware_stack = None
