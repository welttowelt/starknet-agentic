# Tinker: workspace dependency map

Goal: quickly see the workspace package surface and internal coupling before deeper contribution work.

## What I added

- `scripts/workspace_map.py`
  - Enumerates workspace `package.json` files under `packages/*`, `examples/*`, and `website`.
  - Prints package inventory.
  - Prints internal dependency edges (package-to-package references).

Run:

```bash
python3 scripts/workspace_map.py
```

## Snapshot (current)

Packages discovered: 10

Only explicit internal edge found:

- `@starknet-agentic/mcp-server -> @starknet-agentic/x402-starknet`

## Why this is useful

- Fast orientation for onboarding and architecture reviews.
- Helps spot high-leverage targets for refactors or tests.
- Gives a baseline that can be diffed over time as new packages are added.

## Next tinker ideas

1. Add `--json` output for CI drift checks.
2. Add a tiny graph export (`.dot`) for visualization.
3. Add warning mode for packages with no tests.
