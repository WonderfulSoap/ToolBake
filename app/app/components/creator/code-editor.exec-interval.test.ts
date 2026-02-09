import { describe, expect, it } from "vitest";
import { parseExecIntervalMs } from "./code-editor";

describe("parseExecIntervalMs", () => {
  it("should return null for empty values", () => {
    expect(parseExecIntervalMs(undefined)).toBeNull();
    expect(parseExecIntervalMs("")).toBeNull();
    expect(parseExecIntervalMs("   ")).toBeNull();
  });

  it("should return null for invalid numbers", () => {
    expect(parseExecIntervalMs("abc")).toBeNull();
    expect(parseExecIntervalMs("Infinity")).toBeNull();
  });

  it("should enforce minimum interval of 100ms", () => {
    expect(parseExecIntervalMs("99")).toBeNull();
    expect(parseExecIntervalMs("100")).toBe(100);
  });

  it("should parse numeric strings", () => {
    expect(parseExecIntervalMs("3000")).toBe(3000);
    expect(parseExecIntervalMs("  250  ")).toBe(250);
  });
});
