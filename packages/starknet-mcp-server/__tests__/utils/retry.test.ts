import { describe, it, expect, vi } from "vitest";
import { calculateBackoffMs, withRetry } from "../../src/utils/retry";

describe("calculateBackoffMs", () => {
  it("applies exponential growth with cap", () => {
    expect(calculateBackoffMs(1, { baseDelayMs: 100, maxDelayMs: 250, jitterFactor: 0, random: () => 0.5 })).toBe(100);
    expect(calculateBackoffMs(2, { baseDelayMs: 100, maxDelayMs: 250, jitterFactor: 0, random: () => 0.5 })).toBe(200);
    expect(calculateBackoffMs(3, { baseDelayMs: 100, maxDelayMs: 250, jitterFactor: 0, random: () => 0.5 })).toBe(250);
  });

  it("applies bounded jitter", () => {
    const min = calculateBackoffMs(1, { baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0.2, random: () => 0 });
    const max = calculateBackoffMs(1, { baseDelayMs: 100, maxDelayMs: 1000, jitterFactor: 0.2, random: () => 1 });
    expect(min).toBe(80);
    expect(max).toBe(120);
  });
});

describe("withRetry", () => {
  it("retries retryable errors then succeeds", async () => {
    const sleep = vi.fn(async () => undefined);
    const task = vi
      .fn<[], Promise<string>>()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValue("ok");

    const result = await withRetry("quote", task, {
      maxAttempts: 3,
      sleep,
      random: () => 0.5,
      jitterFactor: 0,
      baseDelayMs: 10,
      maxDelayMs: 10,
    });

    expect(result).toBe("ok");
    expect(task).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-retryable errors", async () => {
    const sleep = vi.fn(async () => undefined);
    const task = vi.fn<[], Promise<string>>().mockRejectedValue(new Error("INSUFFICIENT_BALANCE"));

    await expect(
      withRetry("transfer", task, {
        maxAttempts: 3,
        sleep,
      })
    ).rejects.toThrow("INSUFFICIENT_BALANCE");

    expect(task).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
