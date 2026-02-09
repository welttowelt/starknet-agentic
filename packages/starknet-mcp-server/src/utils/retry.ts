import { classifyError } from "./formatter.js";

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (context: {
    operation: string;
    attempt: number;
    nextDelayMs: number;
    error: string;
    category: string;
  }) => void;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 2_000;
const DEFAULT_JITTER_FACTOR = 0.2;

export function calculateBackoffMs(
  attempt: number,
  {
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    maxDelayMs = DEFAULT_MAX_DELAY_MS,
    jitterFactor = DEFAULT_JITTER_FACTOR,
    random = Math.random,
  }: Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "jitterFactor" | "random"> = {}
): number {
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
  const jitterRange = Math.max(0, exponential * jitterFactor);
  const jitter = (random() * 2 - 1) * jitterRange;

  return Math.max(0, Math.round(exponential + jitter));
}

export async function withRetry<T>(
  operation: string,
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const classified = classifyError(errorMessage);
      const canRetry = classified.retryable && attempt < maxAttempts;

      if (!canRetry) {
        throw error;
      }

      const delayMs = calculateBackoffMs(attempt, options);
      options.onRetry?.({
        operation,
        attempt,
        nextDelayMs: delayMs,
        error: errorMessage,
        category: classified.category,
      });

      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
