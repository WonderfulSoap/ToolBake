import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge class names with Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function logAndThrow(message: string): never {
  console.error(message);
  throw new Error(message);
}


const MAX_EXECUTION_RESULT_LOG_LENGTH = 128 * 1024;

function isPlainObjectValue(value: unknown): value is Record<string, unknown> {
  if (value === null) return false;
  if (Array.isArray(value)) return false;
  return typeof value === "object";
}

function truncateStringValue(value: string, limit: number) {
  if (value.length <= limit) return value;
  const suffix = `...[truncated ${value.length - limit} chars]`;
  return `${value.slice(0, limit)}${suffix}`;
}

function truncateValueRecursively(value: unknown, limit: number): unknown {
  if (typeof value === "string") return truncateStringValue(value, limit);
  if (Array.isArray(value)) return value.map((entry) => truncateValueRecursively(entry, limit));
  if (isPlainObjectValue(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) next[key] = truncateValueRecursively(entry, limit);
    return next;
  }
  return value;
}

export function truncateExecutionResultForLog(
  value: unknown,
  limit: number = MAX_EXECUTION_RESULT_LOG_LENGTH
) {
  if (!Number.isFinite(limit) || limit <= 0) return truncateValueRecursively(value, MAX_EXECUTION_RESULT_LOG_LENGTH);
  return truncateValueRecursively(value, limit);
}

/**
 * Builds a v3 source map that maps each generated line to the same original line.
 */
export function createLineMappedSourceMap(code: string, sourceName: string, sourceContent: string = code) {
  const lineCount = code.length === 0 ? 0 : code.split(/\r\n|\r|\n/).length;
  const mappings = lineCount === 0 ? "" : ["AAAA", ...Array.from({ length: lineCount - 1 }, () => "AACA")].join(";");
  return { version: 3, sources: [sourceName], sourcesContent: [sourceContent], names: [], mappings };
}
/** Convert base64url encoded string to ArrayBuffer for WebAuthn APIs. */
export function base64UrlToArrayBuffer(base64url: string): ArrayBuffer {
  // Replace base64url characters with base64 characters
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buffer;
}
