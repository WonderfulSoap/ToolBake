import type { ErrorCodeErrorCodeConst, SwaggerBaseFailResponse } from "~/data/generated-http-client/types.gen";

export type ApiErrorCode = ErrorCodeErrorCodeConst;

export interface ApiErrorContext {
  code?      : ApiErrorCode;
  requestId? : string;
  status?    : string;
  statusCode?: number;
  payload?   : unknown;
  response?  : Response;
  request?   : Request;
  cause?     : unknown;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function isSwaggerFailResponse(payload: unknown): payload is SwaggerBaseFailResponse {
  if (!isObjectLike(payload)) return false;
  return typeof payload.error_code === "string" && typeof payload.message === "string";
}

export class ApiError extends Error {
  public readonly code?      : ApiErrorCode;
  public readonly requestId? : string;
  public readonly status?    : string;
  public readonly statusCode?: number;
  public readonly payload?   : unknown;
  public readonly response?  : Response;
  public readonly request?   : Request;

  constructor(message: string, context: ApiErrorContext = {}) {
    super(message);
    this.name = "ApiError";
    this.code = context.code;
    this.requestId = context.requestId;
    this.status = context.status;
    this.statusCode = context.statusCode;
    this.payload = context.payload;
    this.response = context.response;
    this.request = context.request;
    if (context.cause !== undefined) (this as { cause?: unknown }).cause = context.cause;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
