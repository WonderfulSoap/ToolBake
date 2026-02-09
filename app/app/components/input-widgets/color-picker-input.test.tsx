import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { ColorPickerInput, ColorPickerInputProps, ColorPickerInputOutputValueResolver, type ColorPickerInputOutputValue } from "./color-picker-input";
import type { WidgetValueCollectorInf } from "./input-types";
import type { ColorResult } from "@uiw/color-convert";

let nextColorResult: ColorResult = { hex: "#FF0000", hexa: "#FF0000FF" } as ColorResult;

// Mock Sketch picker to provide deterministic click-driven color updates.
vi.mock("@uiw/react-color-sketch", () => ({
  __esModule: true,
  default   : ({ onChange, color }: { onChange?: (result: ColorResult) => void; color?: string }) => (
    <button type="button" data-testid="mock-sketch" onClick={() => onChange?.(nextColorResult)}>
      {String(color ?? "")}
    </button>
  ),
}));

// Wrapper component to render ColorPickerInput factory function in tests.
function ColorPickerInputWrapper({
  id,
  title,
  mode,
  value,
  onChange,
  collectValueRef,
  props,
}: {
  id             : string;
  title          : string;
  mode           : "input" | "output";
  value          : ColorPickerInputOutputValue;
  onChange       : (id: string, newValue: ColorPickerInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>;
  props?         : ColorPickerInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{ColorPickerInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

function setNextColor(hex: string, hexa?: string) {
  nextColorResult = { hex, hexa: hexa ?? hex } as ColorResult;
}

function normalizeHex(value?: string | null) {
  return value ? value.toUpperCase() : "";
}

describe("ColorPickerInput Component", () => {
  const defaultProps = {
    id             : "test-color-picker",
    title          : "Test Color Picker",
    mode           : "input" as const,
    value          : "#6366F1" as ColorPickerInputOutputValue,
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>,
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: ColorPickerInputProps = {
        defaultValue   : "#AABBCC",
        width          : "260px",
        panelWidth     : 320,
        disableAlpha   : true,
        editableDisable: false,
        presetColors   : ["#F97316", { color: "#A855F7", title: "Violet" }],
      };
      const result = ColorPickerInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = ColorPickerInputProps.parse({});
      expect(result).toEqual({});
    });

    it("accepts presetColors as false", () => {
      const result = ColorPickerInputProps.parse({ presetColors: false });
      expect(result.presetColors).toBe(false);
    });

    it("rejects invalid props", () => {
      expect(() => ColorPickerInputProps.parse({ defaultValue: "red" })).toThrow();
      expect(() => ColorPickerInputProps.parse({ panelWidth: 1000 })).toThrow();
      expect(() => ColorPickerInputProps.parse({ presetColors: ["#GGGGGG"] })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates correct hex color values", () => {
      const resolver = ColorPickerInputOutputValueResolver();
      expect(resolver.parse("#ABC")).toBe("#ABC");
      expect(resolver.parse("#abcd")).toBe("#abcd");
      expect(resolver.parse("#AABBCC")).toBe("#AABBCC");
      expect(resolver.parse("#AABBCCDD")).toBe("#AABBCCDD");
    });

    it("rejects invalid hex values", () => {
      const resolver = ColorPickerInputOutputValueResolver();
      expect(() => resolver.parse("red")).toThrow();
      expect(() => resolver.parse("#12345")).toThrow();
      expect(() => resolver.parse("#ZZZZZZ")).toThrow();
      expect(() => resolver.parse(123)).toThrow();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "short hex", value: "#abc" as ColorPickerInputOutputValue },
      { name: "short hex with alpha", value: "#abcd" as ColorPickerInputOutputValue },
      { name: "standard hex", value: "#aabbcc" as ColorPickerInputOutputValue },
      { name: "hex with alpha", value: "#aabbccdd" as ColorPickerInputOutputValue },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>;
        render(<ColorPickerInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);
        expect(collectValueRef.current?.getValue()).toBe(normalizeHex(value));
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>;
      const values = ["#112233", "#445566", "#778899"] as ColorPickerInputOutputValue[];

      const { rerender } = render(
        <ColorPickerInputWrapper {...defaultProps} value={values[0]} collectValueRef={collectValueRef} />
      );

      for (let i = 1; i < values.length; i++) {
        rerender(<ColorPickerInputWrapper {...defaultProps} value={values[i]} collectValueRef={collectValueRef} />);
        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toBe(normalizeHex(values[i]));
        });
      }
    });
  });

  describe("User Interaction", () => {
    it("calls onChange and updates collectValueRef on interaction", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>;

      setNextColor("#aabbcc");
      render(<ColorPickerInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);

      await user.click(screen.getByTestId("mock-sketch"));

      expect(onChange).toHaveBeenCalledWith("test-color-picker", "#AABBCC");
      expect(collectValueRef.current?.getValue()).toBe("#AABBCC");
    });
  });

  describe("Output Mode", () => {
    it("prevents onChange but keeps collectValueRef working", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>;

      setNextColor("#FF9900");
      render(
        <ColorPickerInputWrapper
          {...defaultProps}
          mode="output"
          value="#123456"
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      await user.click(screen.getByTestId("mock-sketch"));

      expect(onChange).not.toHaveBeenCalled();
      expect(collectValueRef.current?.getValue()).toBe("#123456");
    });
  });
});
