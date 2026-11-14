import deepmerge from "deepmerge";
import { describe, expect, it } from "vitest";

describe("Patched deepmerge", () => {
  it("blocks prototype poisoning from either operand, including null-prototype objects", () => {
    const payload = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    const nullPrototype = Object.assign(Object.create(null), payload);
    for (const [target, source] of [[payload, {}], [{}, payload], [nullPrototype, payload], [{ nested: payload }, {}], [{}, { nested: payload }]]) {
      const result = deepmerge<Record<string, unknown>>(target, source);
      expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
      expect(result).not.toHaveProperty("polluted");
      expect(Object.hasOwn(result, "__proto__")).toBe(false);
      if (result.nested) {
        expect(Object.getPrototypeOf(result.nested)).toBe(Object.prototype);
        expect(result.nested).not.toHaveProperty("polluted");
      }
    }
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("preserves nested defaults, arrays, symbols, dates, and custom array merging", () => {
    const symbol = Symbol("option");
    const date = new Date("2026-01-01T00:00:00Z");
    const defaults = { paths: ["default"], settings: { browser: true }, date, [symbol]: "symbol" };
    const source = { paths: ["custom"], settings: { custom: true } };
    const result = deepmerge(defaults, source);
    expect(result).toEqual({ paths: ["default", "custom"], settings: { browser: true, custom: true }, date, [symbol]: "symbol" });
    expect(result.settings).not.toBe(defaults.settings);
    expect(result.date).toBe(date);
    expect(deepmerge(defaults, source, { arrayMerge: (_target, replacement) => replacement }).paths).toEqual(["custom"]);
    expect(deepmerge.all([{ one: 1 }, { two: 2 }])).toEqual({ one: 1, two: 2 });
  });
});
