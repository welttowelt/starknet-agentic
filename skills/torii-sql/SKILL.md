---
name: torii-sql
description: Query Cartridge Torii SQL endpoints and turn indexed world data into actionable summaries. Use when a task needs Torii schema discovery, model/event analysis, ad-hoc SQL, or reproducible endpoint queries.
license: Apache-2.0
metadata:
  author: starknet-agentic
  version: "1.0.0"
  org: keep-starknet-strange
keywords:
  - cartridge
  - torii
  - sql
  - starknet
  - dojo
  - analytics
  - indexing
  - entities
  - events
allowed-tools:
  - Bash
  - Read
  - Write
  - Glob
  - Grep
  - Task
user-invocable: true
---

# Torii SQL Skill

Query Cartridge Torii SQL endpoints with reproducible CLI commands and bounded exploration patterns.

## Workflow

1. Resolve endpoint.
   - Default: `https://api.cartridge.gg/x/pg-mainnet-10/torii/sql`
   - Override with `--endpoint` for another slot.
2. Inspect schema first when table/column names are unknown.
3. Build bounded queries (`LIMIT`, explicit columns) before broad scans.
4. Execute query with `scripts/torii_sql.py`.
5. Report endpoint, exact SQL, row count, and concise findings.

## Commands

```bash
# From this skill directory:
# cd skills/torii-sql

# Discover schema
python3 scripts/torii_sql.py --schema

# Run ad-hoc query on default endpoint
python3 scripts/torii_sql.py \
  --query "SELECT * FROM entities LIMIT 20;"

# Query another Torii slot and emit JSON
python3 scripts/torii_sql.py \
  --endpoint "https://api.cartridge.gg/x/<slot>/torii/sql" \
  --query-file ./query.sql \
  --format json
```

## Guardrails

- Prefer narrow `SELECT` lists over `SELECT *` for summaries.
- Use `COUNT(*)` first to size datasets.
- Keep exploratory queries bounded with `LIMIT`.
- If results are empty, re-check schema before changing logic.

## Resources

- Query helper script: `scripts/torii_sql.py`
- Query snippets: `references/queries.md`
