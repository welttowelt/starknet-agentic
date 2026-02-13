import { describe, it, expect, vi } from "vitest";
import { IdempotencyStore } from "../../src/utils/idempotency";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("IdempotencyStore", () => {
  it("bypasses caching when key is missing/blank", async () => {
    const store = new IdempotencyStore();
    const fn = vi.fn(async () => ({ ok: true, n: fn.mock.calls.length }));

    const a = await store.execute("transfer", undefined, { amount: 1 }, fn);
    const b = await store.execute("transfer", "   ", { amount: 1 }, fn);

    expect(a.key).toBeNull();
    expect(a.replayed).toBe(false);
    expect(b.key).toBeNull();
    expect(b.replayed).toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(a.result).not.toEqual(b.result);
  });

  it("caches completed results per operation+key", async () => {
    const store = new IdempotencyStore();
    const fn = vi.fn(async () => ({ ok: true, t: Date.now() }));

    const first = await store.execute("swap", "abc", { a: 1, b: 2 }, fn);
    const second = await store.execute("swap", "abc", { b: 2, a: 1 }, fn);

    expect(first.key).toBe("abc");
    expect(first.replayed).toBe(false);
    expect(second.key).toBe("abc");
    expect(second.replayed).toBe(true);
    expect(second.result).toEqual(first.result);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("coalesces in-flight executions", async () => {
    const store = new IdempotencyStore();
    const d = deferred<string>();

    const fn = vi.fn(async () => d.promise);

    const p1 = store.execute("invoke", "k1", { x: 1 }, fn);
    const p2 = store.execute("invoke", "k1", { x: 1 }, fn);

    // Only one execution should be started.
    expect(fn).toHaveBeenCalledTimes(1);

    d.resolve("ok");

    const r1 = await p1;
    const r2 = await p2;

    expect(r1.replayed).toBe(false);
    expect(r2.replayed).toBe(true);
    expect(r1.result).toBe("ok");
    expect(r2.result).toBe("ok");
  });

  it("throws if the same key is reused with different input", async () => {
    const store = new IdempotencyStore();

    await store.execute("transfer", "k", { amount: 1 }, async () => "ok");

    await expect(
      store.execute("transfer", "k", { amount: 2 }, async () => "ok")
    ).rejects.toThrow("Idempotency key reuse with different input: transfer:k");
  });

  it("expires cached entries after ttl", async () => {
    const now = vi.spyOn(Date, "now");
    now.mockReturnValue(1000);

    const store = new IdempotencyStore(500);
    const fn = vi.fn(async () => ({ v: fn.mock.calls.length }));

    const first = await store.execute("swap", "k", { a: 1 }, fn);
    expect(first.replayed).toBe(false);

    now.mockReturnValue(1200);
    const cached = await store.execute("swap", "k", { a: 1 }, fn);
    expect(cached.replayed).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);

    // After ttl (>= 1500), should re-execute.
    now.mockReturnValue(1500);
    const afterExpiry = await store.execute("swap", "k", { a: 1 }, fn);
    expect(afterExpiry.replayed).toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);

    now.mockRestore();
  });
});
