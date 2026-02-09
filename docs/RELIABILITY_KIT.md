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
- Next: implement bounded exponential backoff (with jitter) only when `retryable === true`, then address x402 workspace entry resolution to restore full handler suite.
