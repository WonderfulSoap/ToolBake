import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { ColorInput, ColorInputProps, ColorInputOutputValueResolver, type ColorInputOutputValue } from "./color-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to properly render ColorInput factory function
function ColorInputWrapper({
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
  value          : ColorInputOutputValue;
  onChange       : (id: string, newValue: ColorInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;
  props?         : ColorInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{ColorInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

// Normalize hex casing to keep assertions stable across DOM implementations.
function normalizeHexValue(value?: string | null) {
  return value?.toLowerCase() ?? "";
}

describe("ColorInput Component", () => {
  const defaultProps = {
    id             : "test-color",
    title          : "Test Color",
    mode           : "input" as const,
    value          : "#6366f1",
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: ColorInputProps = {
        showHex: true,
        width  : "200px",
      };
      const result = ColorInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = ColorInputProps.parse({});
      expect(result).toEqual({});
    });

    it("accepts boolean for showHex", () => {
      expect(ColorInputProps.parse({ showHex: true }).showHex).toBe(true);
      expect(ColorInputProps.parse({ showHex: false }).showHex).toBe(false);
    });

    it("accepts string for width", () => {
      expect(ColorInputProps.parse({ width: "100px" }).width).toBe("100px");
      expect(ColorInputProps.parse({ width: "50%" }).width).toBe("50%");
    });
  });

  describe("Output Value Schema", () => {
    it("validates correct hex color values", () => {
      const resolver = ColorInputOutputValueResolver();
      expect(resolver.parse("#FFF")).toBe("#FFF");
      expect(resolver.parse("#fff")).toBe("#fff");
      expect(resolver.parse("#FFFFFF")).toBe("#FFFFFF");
      expect(resolver.parse("#ffffff")).toBe("#ffffff");
      expect(resolver.parse("#6366F1")).toBe("#6366F1");
      expect(resolver.parse("#0EA5E9")).toBe("#0EA5E9");
    });

    it("rejects invalid hex color values", () => {
      const resolver = ColorInputOutputValueResolver();
      expect(() => resolver.parse("red")).toThrow();
      expect(() => resolver.parse("rgb(255,0,0)")).toThrow();
      expect(() => resolver.parse("#GGGGGG")).toThrow();
      expect(() => resolver.parse("#12345")).toThrow();
      expect(() => resolver.parse("")).toThrow();
      expect(() => resolver.parse(123)).toThrow();
      expect(() => resolver.parse(null)).toThrow();
    });

    it("validates 3-digit and 6-digit hex formats", () => {
      const resolver = ColorInputOutputValueResolver();
      // 3-digit
      expect(resolver.parse("#ABC")).toBe("#ABC");
      expect(resolver.parse("#abc")).toBe("#abc");
      // 6-digit
      expect(resolver.parse("#AABBCC")).toBe("#AABBCC");
      expect(resolver.parse("#aabbcc")).toBe("#aabbcc");
    });
  });

  describe("DOM Rendering", () => {
    it("renders color input element", () => {
      render(<ColorInputWrapper {...defaultProps} />);
      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      expect(colorInput).toBeTruthy();
      expect(colorInput.type).toBe("color");
    });

    it("renders with initial color value", () => {
      render(<ColorInputWrapper {...defaultProps} value="#ff0000" />);
      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      expect(normalizeHexValue(colorInput.value)).toBe("#ff0000");
    });

    it("renders title as HTML", () => {
      render(<ColorInputWrapper {...defaultProps} title="<strong>Bold Color</strong>" />);
      const strong = screen.getByText("Bold Color");
      expect(strong.tagName).toBe("STRONG");
    });

    it("renders label element with correct htmlFor", () => {
      render(<ColorInputWrapper {...defaultProps} />);
      const label = screen.getByText("Test Color").closest("label");
      expect(label).toBeTruthy();
      expect(label?.getAttribute("for")).toBe("test-color-picker");
    });

    it("renders copy button", () => {
      render(<ColorInputWrapper {...defaultProps} />);
      const copyButton = screen.getByRole("button");
      expect(copyButton).toBeTruthy();
    });

    it("displays uppercase hex value", () => {
      render(<ColorInputWrapper {...defaultProps} value="#aabbcc" />);
      // Should display uppercase
      expect(screen.getAllByText("#AABBCC").length).toBeGreaterThan(0);
    });
  });

  describe("User Interaction", () => {
    it("calls onChange when user selects a color", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<ColorInputWrapper {...defaultProps} onChange={onChange} />);

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      await user.click(colorInput);

      fireEvent.change(colorInput, { target: { value: "#ff5500" } });

      expect(onChange).toHaveBeenCalledWith("test-color", "#ff5500");
    });

    it("updates displayed value on color change", () => {
      const { rerender } = render(<ColorInputWrapper {...defaultProps} value="#ff0000" />);

      expect(screen.getAllByText("#FF0000").length).toBeGreaterThan(0);

      rerender(<ColorInputWrapper {...defaultProps} value="#00ff00" />);

      expect(screen.getAllByText("#00FF00").length).toBeGreaterThan(0);
    });
  });

  describe("Value Synchronization", () => {
    it("updates internal state when value prop changes", () => {
      const { rerender } = render(<ColorInputWrapper {...defaultProps} value="#ff0000" />);

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      expect(normalizeHexValue(colorInput.value)).toBe("#ff0000");

      rerender(<ColorInputWrapper {...defaultProps} value="#00ff00" />);

      expect(normalizeHexValue(colorInput.value)).toBe("#00ff00");
    });

    it("does not call onChange when value prop updates from parent", () => {
      const onChange = vi.fn();

      const { rerender } = render(<ColorInputWrapper {...defaultProps} value="#ff0000" onChange={onChange} />);
      onChange.mockClear();

      rerender(<ColorInputWrapper {...defaultProps} value="#00ff00" onChange={onChange} />);

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      expect(normalizeHexValue(colorInput.value)).toBe("#00ff00");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("handles rapid value changes from parent", () => {
      const { rerender } = render(<ColorInputWrapper {...defaultProps} value="#ff0000" />);

      rerender(<ColorInputWrapper {...defaultProps} value="#00ff00" />);
      rerender(<ColorInputWrapper {...defaultProps} value="#0000ff" />);

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      expect(normalizeHexValue(colorInput.value)).toBe("#0000ff");
    });
  });

  describe("collectValueRef Interface", () => {
    it("exposes getValue through collectValueRef", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

      render(<ColorInputWrapper {...defaultProps} value="#6366f1" collectValueRef={collectValueRef} />);

      expect(collectValueRef.current).toBeDefined();
      expect(collectValueRef.current?.getValue).toBeInstanceOf(Function);
      expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe("#6366f1");
    });

    it("getValue returns current DOM value after interaction", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

      render(<ColorInputWrapper {...defaultProps} value="#ff0000" collectValueRef={collectValueRef} />);

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;

      fireEvent.change(colorInput, { target: { value: "#00ff00" } });

      expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe("#00ff00");
    });

    it("getValue returns correct value after parent update", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

      const { rerender } = render(<ColorInputWrapper {...defaultProps} value="#ff0000" collectValueRef={collectValueRef} />);

      rerender(<ColorInputWrapper {...defaultProps} value="#0ea5e9" collectValueRef={collectValueRef} />);

      expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe("#0ea5e9");
    });
  });

  describe("Value Collection with collectValueRef", () => {
    // Note: input[type="color"] normalizes hex to lowercase 6-digit format
    const testCases = [
      { name: "red color", value: "#ff0000" },
      { name: "green color", value: "#00ff00" },
      { name: "blue color", value: "#0000ff" },
      { name: "lowercase hex", value: "#aabbcc" },
      { name: "default color", value: "#6366f1" },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

        render(<ColorInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);

        expect(collectValueRef.current).toBeDefined();
        expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe(normalizeHexValue(value));
      });
    });

    it("collects correct value after multiple rerenders", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

      const rerenderCases = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"];

      const { rerender } = render(
        <ColorInputWrapper {...defaultProps} value={rerenderCases[0]} collectValueRef={collectValueRef} />
      );

      expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe(normalizeHexValue(rerenderCases[0]));

      for (let i = 1; i < rerenderCases.length; i++) {
        rerender(
          <ColorInputWrapper {...defaultProps} value={rerenderCases[i]} collectValueRef={collectValueRef} />
        );

        expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe(normalizeHexValue(rerenderCases[i]));
      }
    });

    it("onChange and collectValueRef return same value after color change", async () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      render(
        <ColorInputWrapper
          {...defaultProps}
          value="#ff0000"
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;

      fireEvent.change(colorInput, { target: { value: "#00ff00" } });

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(normalizeHexValue(lastCall[1])).toBe("#00ff00");
      expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe("#00ff00");
    });
  });

  describe("Output Mode", () => {
    it("renders as disabled in output mode", () => {
      render(<ColorInputWrapper {...defaultProps} mode="output" value="#ff0000" />);

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      expect(colorInput.disabled).toBe(true);
    });

    it("does not call onChange in output mode", async () => {
      const onChange = vi.fn();

      render(<ColorInputWrapper {...defaultProps} mode="output" value="#ff0000" onChange={onChange} />);

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;

      fireEvent.change(colorInput, { target: { value: "#00ff00" } });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("displays value correctly in output mode", () => {
      render(<ColorInputWrapper {...defaultProps} mode="output" value="#0ea5e9" />);

      expect(screen.getAllByText("#0EA5E9").length).toBeGreaterThan(0);
    });

    it("collectValueRef works in output mode", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

      render(<ColorInputWrapper {...defaultProps} mode="output" value="#6366f1" collectValueRef={collectValueRef} />);

      expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe("#6366f1");
    });

    const outputTestCases = [
      { initialValue: "#ff0000" },
      { initialValue: "#00ff00" },
      { initialValue: "#aabbcc" },
    ];

    outputTestCases.forEach(({ initialValue }) => {
      it(`in output mode with value ${initialValue}, collectValueRef works but onChange is not called`, async () => {
        const onChange = vi.fn();
        const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

        render(
          <ColorInputWrapper
            {...defaultProps}
            mode="output"
            value={initialValue}
            onChange={onChange}
            collectValueRef={collectValueRef}
          />
        );

        const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;

        // Verify disabled state
        expect(colorInput.disabled).toBe(true);

        // Verify collectValueRef works
        expect(normalizeHexValue(collectValueRef.current?.getValue())).toBe(normalizeHexValue(initialValue));

        // Try to change (should not work)
        fireEvent.change(colorInput, { target: { value: "#ffffff" } });

        // Verify onChange was NOT called
        expect(onChange).not.toHaveBeenCalled();
      });
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "showHex=true",
        props : { showHex: true },
        verify: () => {
          // When showHex is true, hex value should be displayed in the header
          const hexDisplays = screen.getAllByText("#6366F1");
          expect(hexDisplays.length).toBeGreaterThanOrEqual(2); // One in header, one in main display
        },
      },
      {
        name  : "showHex=false",
        props : { showHex: false },
        verify: () => {
          // When showHex is false, only the main display should show the hex
          const hexDisplays = screen.getAllByText("#6366F1");
          expect(hexDisplays.length).toBe(1); // Only main display
        },
      },
      {
        name  : "width",
        props : { width: "300px" },
        verify: () => {
          const container = document.getElementById("test-color-picker")?.closest(".group") as HTMLElement;
          expect(container.style.width).toBe("300px");
          expect(container.className).toContain("flex-shrink-0");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<ColorInputWrapper {...defaultProps} value="#6366f1" props={props} />);
        verify();
      });
    });
  });

  describe("Width Prop", () => {
    it("applies width style when specified", () => {
      const props: ColorInputProps = { width: "250px" };

      render(<ColorInputWrapper {...defaultProps} props={props} />);

      const container = document.getElementById("test-color-picker")?.closest(".group") as HTMLElement;
      expect(container?.style.width).toBe("250px");
      expect(container?.className).toContain("flex-shrink-0");
    });

    it("does not apply width style when not specified", () => {
      render(<ColorInputWrapper {...defaultProps} />);

      const container = document.getElementById("test-color-picker")?.closest(".group") as HTMLElement;
      expect(container?.style.width).toBeFalsy();
    });
  });

  describe("Edge Cases", () => {
    it("handles invalid color value by falling back to default", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

      // Invalid color should fall back to default display but keep original value
      render(<ColorInputWrapper {...defaultProps} value={"invalid" as ColorInputOutputValue} collectValueRef={collectValueRef} />);

      // The component should still render
      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      expect(colorInput).toBeTruthy();
    });

    it("handles undefined value by using default color", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>;

      render(<ColorInputWrapper {...defaultProps} value={undefined as unknown as ColorInputOutputValue} collectValueRef={collectValueRef} />);

      const colorInput = document.getElementById("test-color-picker") as HTMLInputElement;
      expect(colorInput).toBeTruthy();
      // Should use default color #6366F1
      expect(normalizeHexValue(colorInput.value)).toBe("#6366f1");
    });

    it("handles undefined props gracefully", () => {
      render(<ColorInputWrapper {...defaultProps} props={undefined} />);

      const colorInput = document.getElementById("test-color-picker");
      expect(colorInput).toBeTruthy();
    });

    it("converts lowercase to uppercase for display", () => {
      render(<ColorInputWrapper {...defaultProps} value="#aabbcc" />);

      // Display should be uppercase
      expect(screen.getAllByText("#AABBCC").length).toBeGreaterThan(0);
    });
  });
});
