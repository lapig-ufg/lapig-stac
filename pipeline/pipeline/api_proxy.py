"""Lightweight reverse proxy that enriches rustac serve responses.

Rewrites the catalog root metadata (title, description, id) that rustac
hardcodes as "stac-server-rs". All other requests are proxied as-is.

Usage:
    python -m pipeline.api_proxy --upstream http://localhost:7822 --port 8000
"""

from __future__ import annotations

import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import URLError

UPSTREAM = "http://localhost:7822"
PORT = 8000

CATALOG_OVERRIDES = {
    "id": "lapig-stac",
    "title": "LAPIG \u2014 Cat\u00e1logo de Dados Geoespaciais",
    "description": (
        "Cat\u00e1logo STAC do Laborat\u00f3rio de Processamento de Imagens e "
        "Geoprocessamento (LAPIG/UFG). S\u00e9ries hist\u00f3ricas de pastagem "
        "e uso do solo no Brasil \u2014 MapBiomas Cole\u00e7\u00e3o 10."
    ),
}


class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._proxy("GET")

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else None
        self._proxy("POST", body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    upstream = UPSTREAM

    def _proxy(self, method: str, body: bytes | None = None):
        url = f"{self.upstream}{self.path}"
        headers = {
            k: v for k, v in self.headers.items()
            if k.lower() not in ("host", "accept-encoding")
        }

        try:
            req = Request(url, data=body, headers=headers, method=method)
            with urlopen(req, timeout=30) as resp:
                data = resp.read()
                content_type = resp.headers.get("Content-Type", "")
                status = resp.status

                # Enrich catalog root response
                if self.path == "/" and "json" in content_type:
                    data = self._enrich_catalog(data)

                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(data)))
                self._cors_headers()
                self.end_headers()
                self.wfile.write(data)

        except URLError as e:
            self.send_error(502, f"Upstream error: {e}")

    def _enrich_catalog(self, data: bytes) -> bytes:
        try:
            obj = json.loads(data)
            obj.update(CATALOG_OVERRIDES)
            return json.dumps(obj, ensure_ascii=False).encode()
        except (json.JSONDecodeError, TypeError):
            return data

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.send_header("Access-Control-Expose-Headers", "Content-Crs")

    def log_message(self, format, *args):
        pass  # silencia logs por default


def main():
    import argparse
    parser = argparse.ArgumentParser(description="LAPIG STAC API proxy")
    parser.add_argument("--upstream", default=UPSTREAM, help="rustac serve URL")
    parser.add_argument("--port", type=int, default=PORT, help="Proxy port")
    args = parser.parse_args()

    ProxyHandler.upstream = args.upstream

    server = HTTPServer(("0.0.0.0", args.port), ProxyHandler)
    print(f"LAPIG STAC Proxy: http://0.0.0.0:{args.port} → {UPSTREAM}")
    server.serve_forever()


if __name__ == "__main__":
    main()
