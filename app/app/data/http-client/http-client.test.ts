import { describe, expect, it, vi } from "vitest";
import { HttpClient } from "./http-client";
import { ApiError } from "./api-error";

function createHangingFetch(): typeof fetch {
  return function hangingFetch(input: RequestInfo | URL): Promise<Response> {
    const request = input instanceof Request ? input : new Request(input);
    return new Promise((_, reject) => {
      const signal = request.signal;
      if (signal.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort", () => reject(signal.reason ?? new DOMException("Aborted", "AbortError")), { once: true });
    });
  };
}

describe("HttpClient", () => {
  it("aborts requests after timeout", async () => {
    vi.useFakeTimers();
    try {
      const client = new HttpClient({ baseUrl: "https://api.tool.test", timeoutMs: 50, fetch: createHangingFetch() });
      const requestPromise = client.client.request({ method: "GET", url: "/tools", throwOnError: true });
      const resultPromise = requestPromise.then(
        () => ({ ok: true as const }),
        (error) => ({ ok: false as const, error }),
      );
      await vi.advanceTimersByTimeAsync(60);
      const result = await resultPromise;
      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.error).toBeInstanceOf(ApiError);
      expect((result.ok ? undefined : result.error)?.message).toContain("Request timed out");
    } finally {
      vi.useRealTimers();
    }
  });
});
