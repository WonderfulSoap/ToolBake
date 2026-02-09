import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createRef, useEffect, type RefObject } from "react";
import { SliderInput, SliderInputProps, SliderInputOutputValueResolver } from "./slider-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to properly render SliderInput factory function
function SliderInputWrapper({
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
  value          : number;
  onChange       : (id: string, newValue: number) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<number> | undefined>;
  props?         : SliderInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{SliderInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

describe("SliderInput Component", () => {
  const defaultProps = {
    id             : "test-slider",
    title          : "Test Slider",
    mode           : "input" as const,
    value          : 50,
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: SliderInputProps = {
        defaultValue: 60,
        min         : 0,
        max         : 100,
        step        : 5,
        valueSuffix : "%",
        width       : "300px",
      };

      const result = SliderInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const minimalProps = {};
      const result = SliderInputProps.parse(minimalProps);
      expect(result).toEqual({});
    });

    it("accepts numeric values for min/max/step", () => {
      const props = { min: -100, max: 200, step: 0.5 };
      const result = SliderInputProps.parse(props);
      expect(result.min).toBe(-100);
      expect(result.max).toBe(200);
      expect(result.step).toBe(0.5);
    });

    it("accepts string for valueSuffix", () => {
      const result = SliderInputProps.parse({ valueSuffix: "px" });
      expect(result.valueSuffix).toBe("px");
    });

    it("rejects invalid types", () => {
      expect(() => SliderInputProps.parse({ min: "not a number" })).toThrow();
      expect(() => SliderInputProps.parse({ max: "not a number" })).toThrow();
      expect(() => SliderInputProps.parse({ step: "not a number" })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates number output values", () => {
      const resolver = SliderInputOutputValueResolver();
      expect(resolver.parse(0)).toBe(0);
      expect(resolver.parse(50)).toBe(50);
      expect(resolver.parse(100)).toBe(100);
      expect(resolver.parse(-10)).toBe(-10);
      expect(resolver.parse(3.14)).toBe(3.14);
    });

    it("rejects non-number values", () => {
      const resolver = SliderInputOutputValueResolver();
      expect(() => resolver.parse("50")).toThrow();
      expect(() => resolver.parse(null)).toThrow();
      expect(() => resolver.parse(undefined)).toThrow();
      expect(() => resolver.parse({})).toThrow();
    });
  });

  describe("DOM Rendering", () => {
    it("renders slider element", () => {
      render(<SliderInputWrapper {...defaultProps} />);
      const slider = screen.getByRole("slider");
      expect(slider).toBeTruthy();
    });

    it("renders with correct aria attributes", () => {
      render(<SliderInputWrapper {...defaultProps} value={50} props={{ min: 0, max: 100 }} />);
      const slider = screen.getByRole("slider");
      expect(slider.getAttribute("aria-valuemin")).toBe("0");
      expect(slider.getAttribute("aria-valuemax")).toBe("100");
      expect(slider.getAttribute("aria-valuenow")).toBe("50");
    });

    it("renders title", () => {
      render(<SliderInputWrapper {...defaultProps} title="Volume" />);
      expect(screen.getByText("Volume")).toBeTruthy();
    });

    it("renders title as HTML via SafeHtml", () => {
      render(<SliderInputWrapper {...defaultProps} title="<strong>Bold Title</strong>" />);
      const strong = screen.getByText("Bold Title");
      expect(strong.tagName).toBe("STRONG");
    });

    it("displays value with suffix", () => {
      render(<SliderInputWrapper {...defaultProps} value={75} props={{ valueSuffix: "%" }} />);
      expect(screen.getByText("75%")).toBeTruthy();
    });

    it("displays value without suffix when not specified", () => {
      render(<SliderInputWrapper {...defaultProps} value={42} />);
      expect(screen.getByText("42")).toBeTruthy();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "zero", value: 0 },
      { name: "positive integer", value: 50 },
      { name: "max value", value: 100 },
      { name: "negative value", value: -25 },
      { name: "decimal value", value: 33.33 },
      { name: "large value", value: 999999 },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;
        render(<SliderInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);
        expect(collectValueRef.current).toBeDefined();
        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders with different values", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;
      const rerenderCases = [10, 25, 50, 75, 100, 0];

      const { rerender } = render(
        <SliderInputWrapper {...defaultProps} value={rerenderCases[0]} collectValueRef={collectValueRef} />
      );

      expect(collectValueRef.current?.getValue()).toBe(rerenderCases[0]);

      for (let i = 1; i < rerenderCases.length; i++) {
        rerender(
          <SliderInputWrapper {...defaultProps} value={rerenderCases[i]} collectValueRef={collectValueRef} />
        );
        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toBe(rerenderCases[i]);
        });
      }
    });
  });

  describe("User Interaction", () => {
    it("calls onChange when slider value changes", () => {
      const onChange = vi.fn();
      render(<SliderInputWrapper {...defaultProps} value={50} onChange={onChange} props={{ min: 0, max: 100 }} />);

      const slider = screen.getByRole("slider");

      // Simulate slider value change using keyboard
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith("test-slider", expect.any(Number));
    });

    it("updates displayed value on interaction", () => {
      const onChange = vi.fn();
      render(<SliderInputWrapper {...defaultProps} value={50} onChange={onChange} props={{ min: 0, max: 100, step: 1 }} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      // Value should increase by step (1)
      expect(onChange).toHaveBeenCalledWith("test-slider", 51);
    });

    it("respects step value", () => {
      const onChange = vi.fn();
      render(<SliderInputWrapper {...defaultProps} value={50} onChange={onChange} props={{ min: 0, max: 100, step: 5 }} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      expect(onChange).toHaveBeenCalledWith("test-slider", 55);
    });

    it("respects min value boundary", () => {
      const onChange = vi.fn();
      render(<SliderInputWrapper {...defaultProps} value={0} onChange={onChange} props={{ min: 0, max: 100 }} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowLeft" });

      // Should not go below min
      expect(onChange).not.toHaveBeenCalled();
    });

    it("respects max value boundary", () => {
      const onChange = vi.fn();
      render(<SliderInputWrapper {...defaultProps} value={100} onChange={onChange} props={{ min: 0, max: 100 }} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      // Should not go above max
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Value Synchronization", () => {
    it("updates internal state when value prop changes", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;
      const { rerender } = render(<SliderInputWrapper {...defaultProps} value={30} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe(30);

      rerender(<SliderInputWrapper {...defaultProps} value={70} collectValueRef={collectValueRef} />);

      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe(70);
      });
    });

    it("does not call onChange when value prop updates from parent", async () => {
      const onChange = vi.fn();
      const { rerender } = render(<SliderInputWrapper {...defaultProps} value={30} onChange={onChange} />);

      onChange.mockClear();
      rerender(<SliderInputWrapper {...defaultProps} value={70} onChange={onChange} />);

      await waitFor(() => {
        const slider = screen.getByRole("slider");
        expect(slider.getAttribute("aria-valuenow")).toBe("70");
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("handles rapid value changes from parent", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;
      const { rerender } = render(<SliderInputWrapper {...defaultProps} value={10} collectValueRef={collectValueRef} />);

      rerender(<SliderInputWrapper {...defaultProps} value={20} collectValueRef={collectValueRef} />);
      rerender(<SliderInputWrapper {...defaultProps} value={30} collectValueRef={collectValueRef} />);
      rerender(<SliderInputWrapper {...defaultProps} value={40} collectValueRef={collectValueRef} />);

      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe(40);
      });
    });
  });

  describe("Output Mode", () => {
    it("renders with aria-readonly in output mode", () => {
      render(<SliderInputWrapper {...defaultProps} mode="output" value={50} />);
      const slider = screen.getByRole("slider");
      // aria-readonly is on the Slider container, not the thumb element with role="slider"
      const sliderContainer = slider.closest("[aria-readonly]");
      expect(sliderContainer?.getAttribute("aria-readonly")).toBe("true");
    });

    it("has pointer-events-none class in output mode", () => {
      render(<SliderInputWrapper {...defaultProps} mode="output" value={50} />);
      const slider = screen.getByRole("slider");
      const sliderContainer = slider.closest(".h-10");
      expect(sliderContainer?.className).toContain("pointer-events-none");
    });

    it("does not call onChange in output mode", () => {
      const onChange = vi.fn();
      render(<SliderInputWrapper {...defaultProps} mode="output" value={50} onChange={onChange} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("collectValueRef still works in output mode", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      const testCases = [
        { value: 25, suffix: "%" },
        { value: 75, suffix: "px" },
        { value: 0, suffix: "" },
      ];

      for (const { value, suffix } of testCases) {
        const { unmount } = render(
          <SliderInputWrapper
            {...defaultProps}
            mode="output"
            value={value}
            collectValueRef={collectValueRef}
            props={{ valueSuffix: suffix }}
          />
        );

        expect(collectValueRef.current?.getValue()).toBe(value);
        unmount();
      }
    });

    it("displays correct value in output mode", () => {
      render(<SliderInputWrapper {...defaultProps} mode="output" value={88} props={{ valueSuffix: "%" }} />);
      expect(screen.getByText("88%")).toBeTruthy();
    });
  });

  describe("Width Prop", () => {
    it("applies width style when specified", () => {
      render(<SliderInputWrapper {...defaultProps} props={{ width: "300px" }} />);
      const container = screen.getByRole("slider").closest(".group") as HTMLElement;
      expect(container?.style.width).toBe("300px");
      expect(container?.className).toContain("flex-shrink-0");
    });

    it("does not apply width style when not specified", () => {
      render(<SliderInputWrapper {...defaultProps} />);
      const container = screen.getByRole("slider").closest(".group") as HTMLElement;
      expect(container?.style.width).toBeFalsy();
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "min",
        props : { min: 10 },
        verify: () => {
          const slider = screen.getByRole("slider");
          expect(slider.getAttribute("aria-valuemin")).toBe("10");
        },
      },
      {
        name  : "max",
        props : { max: 200 },
        verify: () => {
          const slider = screen.getByRole("slider");
          expect(slider.getAttribute("aria-valuemax")).toBe("200");
        },
      },
      {
        name  : "valueSuffix",
        props : { valueSuffix: " units" },
        value : 42,
        verify: () => {
          expect(screen.getByText("42 units")).toBeTruthy();
        },
      },
      {
        name  : "width",
        props : { width: "250px" },
        verify: () => {
          const container = screen.getByRole("slider").closest(".group") as HTMLElement;
          expect(container.style.width).toBe("250px");
          expect(container.className).toContain("flex-shrink-0");
        },
      },
    ];

    propsCases.forEach(({ name, props, value, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<SliderInputWrapper {...defaultProps} value={value ?? 50} props={props} />);
        verify();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles zero value", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;
      render(<SliderInputWrapper {...defaultProps} value={0} collectValueRef={collectValueRef} />);
      expect(collectValueRef.current?.getValue()).toBe(0);
      expect(screen.getByText("0")).toBeTruthy();
    });

    it("handles negative values", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;
      render(<SliderInputWrapper {...defaultProps} value={-50} collectValueRef={collectValueRef} props={{ min: -100, max: 100 }} />);
      expect(collectValueRef.current?.getValue()).toBe(-50);
    });

    it("handles decimal step values", () => {
      const onChange = vi.fn();
      render(<SliderInputWrapper {...defaultProps} value={0.5} onChange={onChange} props={{ min: 0, max: 1, step: 0.1 }} />);

      const slider = screen.getByRole("slider");
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      expect(onChange).toHaveBeenCalledWith("test-slider", expect.closeTo(0.6, 1));
    });

    it("handles undefined props gracefully", () => {
      render(<SliderInputWrapper {...defaultProps} props={undefined} />);
      expect(screen.getByRole("slider")).toBeTruthy();
    });

    it("uses default values when props not specified", () => {
      render(<SliderInputWrapper {...defaultProps} value={50} />);
      const slider = screen.getByRole("slider");
      // Default: min=0, max=100
      expect(slider.getAttribute("aria-valuemin")).toBe("0");
      expect(slider.getAttribute("aria-valuemax")).toBe("100");
    });
  });

  describe("onChange and collectValueRef Consistency", () => {
    it("onChange and collectValueRef return same value after slider interaction", async () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      render(
        <SliderInputWrapper
          {...defaultProps}
          value={50}
          onChange={onChange}
          collectValueRef={collectValueRef}
          props={{ min: 0, max: 100, step: 1 }}
        />
      );

      const slider = screen.getByRole("slider");

      // Simulate multiple interactions
      fireEvent.keyDown(slider, { key: "ArrowRight" });

      await waitFor(() => {
        const onChangeValue = onChange.mock.calls[onChange.mock.calls.length - 1]?.[1];
        expect(collectValueRef.current?.getValue()).toBe(onChangeValue);
      });
    });
  });
});
