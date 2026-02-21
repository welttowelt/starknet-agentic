#!/usr/bin/env python3
"""
Run SQL queries against Cartridge Torii SQL endpoints.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_ENDPOINT = "https://api.cartridge.gg/x/pg-mainnet-10/torii/sql"
DEFAULT_SCHEMA_QUERY = """
SELECT
  m.name AS table_name,
  p.name AS column_name,
  p.type AS data_type,
  p."notnull" AS is_nullable,
  p.pk AS is_primary_key
FROM sqlite_master m
JOIN pragma_table_info(m.name) p
WHERE m.type = 'table'
AND m.name NOT LIKE 'sqlite_%'
ORDER BY m.name, p.cid;
""".strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Query a Torii SQL endpoint.")
    parser.add_argument(
        "--endpoint",
        default=DEFAULT_ENDPOINT,
        help=f"Torii SQL endpoint (default: {DEFAULT_ENDPOINT})",
    )
    parser.add_argument("--query", help="SQL query string.")
    parser.add_argument("--query-file", type=Path, help="Path to a .sql file.")
    parser.add_argument(
        "--schema",
        action="store_true",
        help="Run a built-in schema discovery query.",
    )
    parser.add_argument(
        "--format",
        choices=("table", "json", "csv"),
        default="table",
        help="Output format (default: table).",
    )
    parser.add_argument(
        "--max-cell-width",
        type=int,
        default=80,
        help="Maximum cell width in table mode.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="HTTP timeout in seconds (default: 30).",
    )
    return parser.parse_args()


def load_query(args: argparse.Namespace) -> str:
    provided = int(bool(args.query)) + int(bool(args.query_file)) + int(bool(args.schema))
    if provided > 1:
        raise ValueError("Use only one of --query, --query-file, or --schema.")

    if args.schema:
        return DEFAULT_SCHEMA_QUERY

    if args.query:
        return args.query.strip()

    if args.query_file:
        return args.query_file.read_text(encoding="utf-8").strip()

    if not sys.stdin.isatty():
        return sys.stdin.read().strip()

    raise ValueError("Provide --query, --query-file, --schema, or pipe SQL via stdin.")


def run_query(endpoint: str, query: str, timeout: float) -> Any:
    params = urllib.parse.urlencode({"query": query})
    request = urllib.request.Request(
        f"{endpoint}?{params}",
        headers={"Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {exc.reason}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error: {exc.reason}") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Failed to decode JSON response: {exc}") from exc


def collect_columns(rows: list[dict[str, Any]]) -> list[str]:
    columns: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                columns.append(key)
    return columns


def stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def truncate(text: str, max_width: int) -> str:
    if max_width < 4 or len(text) <= max_width:
        return text
    return text[: max_width - 3] + "..."


def print_table(rows: list[dict[str, Any]], max_cell_width: int) -> None:
    if not rows:
        print("No rows returned.")
        return

    columns = collect_columns(rows)
    rendered = [
        [truncate(stringify(row.get(col)), max_cell_width) for col in columns] for row in rows
    ]
    widths = [len(col) for col in columns]
    for row in rendered:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(cell))

    header = " | ".join(col.ljust(widths[i]) for i, col in enumerate(columns))
    divider = "-+-".join("-" * widths[i] for i in range(len(columns)))
    print(header)
    print(divider)
    for row in rendered:
        print(" | ".join(cell.ljust(widths[i]) for i, cell in enumerate(row)))


def print_csv(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    columns = collect_columns(rows)
    writer = csv.DictWriter(sys.stdout, fieldnames=columns)
    writer.writeheader()
    for row in rows:
        writer.writerow({key: stringify(row.get(key)) for key in columns})


def normalize_rows(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        normalized: list[dict[str, Any]] = []
        for item in data:
            if isinstance(item, dict):
                normalized.append(item)
            else:
                normalized.append({"value": item})
        return normalized

    if isinstance(data, dict):
        return [data]

    return [{"value": data}]


def main() -> int:
    args = parse_args()
    try:
        query = load_query(args)
        data = run_query(args.endpoint, query, args.timeout)
        rows = normalize_rows(data)

        if args.format == "json":
            print(json.dumps(data, indent=2, ensure_ascii=False))
        elif args.format == "csv":
            print_csv(rows)
        else:
            print_table(rows, args.max_cell_width)
    except Exception as exc:  # pragma: no cover - CLI boundary
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
