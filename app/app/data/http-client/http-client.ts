import { createClient, type Client } from "~/data/generated-http-client/client";
import { ApiError, isSwaggerFailResponse } from "./api-error";


const SERVER_API_TIMEOUT = 10000;
export interface HttpClientOptions {
  baseUrl?  : string;
  timeoutMs?: number;
  fetch?    : typeof fetch;
}

class TimeoutError extends Error {
  constructor(message = "HTTPClient Error: Request timed out.") {
    super(message);
    this.name = "TimeoutError";
  }
}

function createTimeoutFetch(timeoutMs: number, baseFetch?: typeof fetch): typeof fetch {
  const rawFetch = baseFetch ?? globalThis.fetch;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return rawFetch;
  return async function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const request = input instanceof Request ? input : new Request(input, init);
    const controller = new AbortController();
    const signal = mergeAbortSignals(request.signal, controller.signal);
    const timeoutId = globalThis.setTimeout(() => controller.abort(new TimeoutError()), timeoutMs);
    try {
      const wrapped = request.signal === signal ? request : new Request(request, { signal });
      return await rawFetch(wrapped);
    } finally {
      globalThis.clearTimeout(timeoutId);
      releaseMergedSignal(signal);
    }
  };
}

type MergedAbortSignal = AbortSignal & { __release?: () => void; };
function mergeAbortSignals(parent: AbortSignal | null | undefined, child: AbortSignal): AbortSignal {
  if (!parent) return child;
  if ((AbortSignal as any).any) return (AbortSignal as any).any([parent, child]);
  const controller = new AbortController();
  const releases = [linkAbort(parent, controller), linkAbort(child, controller)];
  (controller.signal as MergedAbortSignal).__release = function release() { for (const fn of releases) fn(); };
  return controller.signal;
}

function linkAbort(source: AbortSignal, controller: AbortController): () => void {
  if (source.aborted) {
    controller.abort(source.reason);
    return function noop() {};
  }
  function onAbort() { controller.abort(source.reason); }
  source.addEventListener("abort", onAbort, { once: true });
  return function release() { source.removeEventListener("abort", onAbort); };
}

function releaseMergedSignal(signal: AbortSignal) { (signal as MergedAbortSignal).__release?.(); }

export class HttpClient {
  public readonly client: Client;
  constructor(options: HttpClientOptions = {}) {
    const timeoutMs = options.timeoutMs ?? SERVER_API_TIMEOUT;
    this.client = createClient({ baseUrl: options.baseUrl ?? "", fetch: createTimeoutFetch(timeoutMs, options.fetch) });
    this.client.interceptors.error.use((error, response, request) => this.transformError(error, response, request));
  }

  formatBearerToken(token: string): string {
    return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
  }

  private transformError(error: unknown, response?: Response, request?: Request): ApiError {
    if (error instanceof ApiError) return error;
    if (error instanceof TimeoutError) return new ApiError(error.message, { payload: error, response, request, cause: error });
    if (isSwaggerFailResponse(error)) {
      const message = error.message?.trim() || "Request failed.";
      return new ApiError(message, { code: error.error_code, requestId: error.request_id, status: error.status, statusCode: response?.status, payload: error, response, request, cause: error });
    }
    if (error instanceof Error) {
      const message = error.message?.trim() || "Request failed.";
      return new ApiError(message, { payload: error, response, request, cause: error });
    }
    if (typeof error === "string" && error.trim()) return new ApiError(error.trim(), { response, request });
    return new ApiError("Request failed.", { payload: error, response, request });
  }
}

export const backendHost = import.meta.env.VITE_BACKEND_HOST?.trim();

export const httpClient = new HttpClient({ baseUrl: backendHost });
export { ApiError } from "./api-error";
export type { ApiErrorCode } from "./api-error";
