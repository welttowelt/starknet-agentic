# Torii SQL Query Snippets

## Schema Discovery
```sql
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
```

## Row Counts By Table
Start with schema discovery, then run count queries for candidate tables.
```sql
SELECT COUNT(*) AS total_rows
FROM entities;
```

## Recent Events Pattern
```sql
SELECT *
FROM events
ORDER BY created_at DESC
LIMIT 100;
```

## Notes
- Endpoint shape: `https://api.cartridge.gg/x/<slot>/torii/sql`
- Request style: `GET` with URL parameter `query=<sql>`
- Keep exploratory queries bounded with `LIMIT`
