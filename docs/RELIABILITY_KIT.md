# Agent Reliability Kit (testground)

Scope: production-grade reliability primitives for Starknet agent workflows.

## Pillars

1. Retry and backoff policies
   - deterministic retry classes
   - capped exponential backoff with jitter
   - retry budget per operation

2. Idempotency and deduplication
   - operation keys for mutating actions
   - replay-safe execution wrappers
   - conflict handling semantics

3. Error taxonomy
   - normalized error envelope (transport, chain, app, policy)
   - machine-readable error codes
   - remediation hints and retryability flags

4. Tracing and observability
   - trace_id propagation across mcp/x402 boundaries
   - structured logs and event contracts
   - outcome metrics for success/failure/retry

5. Guardrails
   - configurable action limits
   - timeout budgets and circuit-break style cutoffs
   - explicit policy-failure handling

## Daily build protocol

- Ship one small, testable increment per day.
- Update this file with what changed and next step.
- Prefer additive changes with backward compatibility.

## Progress log

### 2026-02-09
- Implemented shared MCP error taxonomy in `packages/starknet-mcp-server/src/utils/formatter.ts` via `classifyError()` with normalized categories and retryability flags.
- Added traceability primitive `createErrorTraceId()` and wired `traceId`, `category`, and `retryable` into MCP tool error responses and structured stderr logs (`src/index.ts`).
- Added unit coverage for taxonomy + trace-id generation (`__tests__/utils/formatter.test.ts`).
- Verified: `pnpm exec vitest run __tests__/utils/formatter.test.ts` passed (21/21).
- Blocker (verified): full package test run fails in `__tests__/handlers/tools.test.ts` due to unresolved workspace entry for `@starknet-agentic/x402-starknet`.
- Implemented bounded exponential backoff with jitter in new `withRetry()` utility (`src/utils/retry.ts`) and wired quote fetches (`starknet_swap`, `starknet_get_quote`) to retry only classified retryable errors.
- Extended error taxonomy with `transport` category for transient network/rate-limit failures so retry policy is data-driven.
- Added unit coverage for retry math and retry gating (`__tests__/utils/retry.test.ts`) plus taxonomy coverage for transient transport classification.
- Verified: `pnpm exec vitest run __tests__/utils/formatter.test.ts __tests__/utils/retry.test.ts` passed.
- Blocker (verified): full package test run still fails in `__tests__/handlers/tools.test.ts` due to unresolved workspace entry for `@starknet-agentic/x402-starknet`.
- Next: add idempotency key support for mutating tools (`transfer`/`invoke`/`swap`) with replay-safe response caching, then fix x402 workspace resolution to restore full handler suite.

### 2026-02-12
- Implemented in-memory idempotency/dedup store (`IdempotencyStore`) with stable input fingerprinting, TTL expiry, and in-flight coalescing.
- Wired optional `idempotencyKey` into mutating tools: `starknet_transfer`, `starknet_invoke_contract`, `starknet_swap`.
- Added `IDEMPOTENCY_TTL_MS` env config (default 10 minutes) and documented `idempotencyKey` + TTL in `packages/starknet-mcp-server/README.md`.
- Tool responses now include `idempotency: { key, replayed }` when a key is provided.
- Blocker (verified): package test suite + DTS build still fail due to unresolved workspace entry for `@starknet-agentic/x402-starknet` (same root issue as earlier).
- Next: add unit tests for `IdempotencyStore` and then fix the `@starknet-agentic/x402-starknet` workspace/export resolution so handler tests + DTS builds pass.

### 2026-02-13
- Added unit tests for `IdempotencyStore` covering: no-key bypass, completed-result caching, in-flight coalescing, fingerprint mismatch, and TTL expiry (`packages/starknet-mcp-server/__tests__/utils/idempotency.test.ts`).
- Verified: `pnpm -C packages/starknet-mcp-server exec vitest run __tests__/utils/idempotency.test.ts` passed (5/5).
- Next: fix the `@starknet-agentic/x402-starknet` workspace/export resolution so the full handler test suite + DTS builds pass again.
