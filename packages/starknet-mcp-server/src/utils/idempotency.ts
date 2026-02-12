type IdempotencyEntry<T> = {
  fingerprint: string;
  expiresAt: number;
  result: T;
};

export type IdempotencyExecutionResult<T> = {
  key: string | null;
  replayed: boolean;
  result: T;
};

export class IdempotencyStore {
  private readonly completed = new Map<string, IdempotencyEntry<unknown>>();
  private readonly inFlight = new Map<string, { fingerprint: string; promise: Promise<unknown> }>();

  constructor(private readonly ttlMs: number = 10 * 60 * 1000) {}

  async execute<T>(
    operation: string,
    idempotencyKey: string | undefined,
    input: unknown,
    fn: () => Promise<T>
  ): Promise<IdempotencyExecutionResult<T>> {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey) {
      return {
        key: null,
        replayed: false,
        result: await fn(),
      };
    }

    this.cleanupExpired();

    const cacheKey = `${operation}:${normalizedKey}`;
    const fingerprint = stableStringify(input);

    const existing = this.completed.get(cacheKey);
    if (existing) {
      this.assertFingerprint(cacheKey, existing.fingerprint, fingerprint);
      return {
        key: normalizedKey,
        replayed: true,
        result: existing.result as T,
      };
    }

    const active = this.inFlight.get(cacheKey);
    if (active) {
      this.assertFingerprint(cacheKey, active.fingerprint, fingerprint);
      return {
        key: normalizedKey,
        replayed: true,
        result: await active.promise as T,
      };
    }

    const promise = fn();
    this.inFlight.set(cacheKey, { fingerprint, promise });

    try {
      const result = await promise;
      this.completed.set(cacheKey, {
        fingerprint,
        expiresAt: Date.now() + this.ttlMs,
        result,
      });
      return {
        key: normalizedKey,
        replayed: false,
        result,
      };
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.completed.entries()) {
      if (entry.expiresAt <= now) {
        this.completed.delete(key);
      }
    }
  }

  private assertFingerprint(cacheKey: string, cached: string, incoming: string) {
    if (cached !== incoming) {
      throw new Error(`Idempotency key reuse with different input: ${cacheKey}`);
    }
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);

  return `{${entries.join(",")}}`;
}
