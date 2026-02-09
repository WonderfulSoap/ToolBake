import { describe, it, expect, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { NumberInput, NumberInputProps, NumberInputDefaultValue, NumberInputOutputValueResolver } from "./number-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to properly render NumberInput factory function
function NumberInputWrapper({
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
  props?         : NumberInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{NumberInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

type NumberInputCollectorRef = RefObject<WidgetValueCollectorInf<number> | undefined>;

// React createRef includes null in its type, align it to NumberInput's collector ref shape for tests.
function createNumberInputCollectorRef(): NumberInputCollectorRef {
  return createRef<WidgetValueCollectorInf<number>>() as NumberInputCollectorRef;
}

describe("NumberInput Component", () => {
  const defaultProps = {
    id             : "test-number-input",
    title          : "Test Number",
    mode           : "input" as const,
    value          : 0,
    onChange       : vi.fn(),
    collectValueRef: createNumberInputCollectorRef(),
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: NumberInputProps = {
        placeholder : "Enter number",
        defaultValue: 10,
        prefixLabel : "Count",
        min         : 0,
        max         : 100,
        step        : 5,
        size        : "normal",
        width       : "250px",
      };

      const result = NumberInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const minimalProps = {};
      const result = NumberInputProps.parse(minimalProps);
      expect(result).toEqual({});
    });

    it("validates size enum values", () => {
      const validSizes = ["normal", "mini"];
      validSizes.forEach((size) => {
        const result = NumberInputProps.parse({ size });
        expect(result.size).toBe(size);
      });
    });

    it("rejects invalid size values", () => {
      expect(() => {
        NumberInputProps.parse({ size: "invalid" });
      }).toThrow();
    });

    it("accepts numeric values for min, max, step", () => {
      const result = NumberInputProps.parse({ min: -10, max: 100, step: 0.5 });
      expect(result.min).toBe(-10);
      expect(result.max).toBe(100);
      expect(result.step).toBe(0.5);
    });
  });

  describe("Output Value Schema", () => {
    it("validates number output values", () => {
      const resolver = NumberInputOutputValueResolver();
      expect(resolver.parse(0)).toBe(0);
      expect(resolver.parse(123)).toBe(123);
      expect(resolver.parse(-456)).toBe(-456);
      expect(resolver.parse(3.14)).toBe(3.14);
    });

    it("rejects non-number values", () => {
      const resolver = NumberInputOutputValueResolver();
      expect(() => resolver.parse("123")).toThrow();
      expect(() => resolver.parse(null)).toThrow();
      expect(() => resolver.parse(undefined)).toThrow();
      expect(() => resolver.parse({})).toThrow();
      expect(() => resolver.parse(NaN)).toThrow();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "zero value", value: 0 },
      { name: "positive integer", value: 42 },
      { name: "negative integer", value: -100 },
      { name: "decimal value", value: 3.14159 },
      { name: "very large number", value: 999999 },
      { name: "very small number", value: -999999 },
      { name: "small decimal", value: 0.001 },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createNumberInputCollectorRef();
        render(
          <NumberInputWrapper
            {...defaultProps}
            value={value}
            collectValueRef={collectValueRef}
          />
        );

        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createNumberInputCollectorRef();
      const values = [0, 10, 25, 50, 100, -50];

      const { rerender } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={values[0]}
          collectValueRef={collectValueRef}
        />
      );

      for (let i = 1; i < values.length; i++) {
        rerender(
          <NumberInputWrapper
            {...defaultProps}
            value={values[i]}
            collectValueRef={collectValueRef}
          />
        );

        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toBe(values[i]);
        });
      }
    });

    it("collects value from input field when modified directly", async () => {
      const collectValueRef = createNumberInputCollectorRef();
      const { container } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={0}
          collectValueRef={collectValueRef}
        />
      );

      const input = container.querySelector("input[type='text']") as HTMLInputElement;
      expect(input).toBeTruthy();

      // Programmatically update via setValue to keep ref and UI in sync
      await act(async () => {
        collectValueRef.current?.setValue?.(123);
      });
      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe(123);
        expect(input.value).toBe("123");
      });
    });
  });

  describe("User Interaction and Value Sync", () => {
    it("onChange and collectValueRef return same value after user input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createNumberInputCollectorRef();

      const inputCases = [
        { initialValue: 0, value: "42", expected: 42 },
        { initialValue: 0, value: "100", expected: 100 },
        { initialValue: 50, value: "75", expected: 75 }, // append to existing
      ];

      for (const { initialValue, value, expected } of inputCases) {
        onChange.mockClear();
        
        const { container, unmount } = render(
          <NumberInputWrapper
            {...defaultProps}
            value={initialValue}
            onChange={onChange}
            collectValueRef={collectValueRef}
          />
        );

        const input = container.querySelector("input[type='text']") as HTMLInputElement;
        expect(input).toBeTruthy();

        await user.clear(input);
        await user.type(input, value);

        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall).toBeTruthy();
        expect(lastCall[1]).toBe(expected);
        expect(collectValueRef.current?.getValue()).toBe(expected);
        expect(Number(input.value)).toBe(expected);
        
        unmount();
      }
    });

    it("ignores non-numeric input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createNumberInputCollectorRef();

      const { container } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={42}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const input = container.querySelector("input[type='text']") as HTMLInputElement;
      
      // Get initial calls count
      const initialCallsCount = onChange.mock.calls.length;
      
      await user.type(input, "abc");

      // Should not trigger onChange for invalid input (no new calls)
      expect(onChange.mock.calls.length).toBe(initialCallsCount);
      expect(collectValueRef.current?.getValue()).toBe(42); // Retains last valid value
    });
  });

  describe("Output Mode", () => {
    it("in output mode, input is readonly", () => {
      const { container } = render(
        <NumberInputWrapper
          {...defaultProps}
          mode="output"
          value={42}
        />
      );

      const input = container.querySelector("input[type='text']") as HTMLInputElement;
      expect(input.readOnly).toBe(true);
      expect(input.getAttribute("aria-readonly")).toBe("true");
    });

    it("in output mode, user input does not trigger onChange but collectValueRef works", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createNumberInputCollectorRef();

      const testCases = [
        { initialValue: 100, attemptInput: "999" },
        { initialValue: 50, attemptInput: "123" },
      ];

      for (const { initialValue, attemptInput } of testCases) {
        onChange.mockClear();

        const { unmount, container } = render(
          <NumberInputWrapper
            {...defaultProps}
            mode="output"
            value={initialValue}
            onChange={onChange}
            collectValueRef={collectValueRef}
          />
        );

        const input = container.querySelector("input[type='text']") as HTMLInputElement;

        // Verify readonly state
        expect(input.readOnly).toBe(true);

        // Verify collectValueRef can collect value
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        // Attempt to type
        await user.type(input, attemptInput);

        // Verify onChange was not called
        expect(onChange).not.toHaveBeenCalled();

        // Verify value unchanged
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        unmount();
      }
    });

    it("in output mode, increment/decrement buttons are disabled", () => {
      render(
        <NumberInputWrapper
          {...defaultProps}
          mode="output"
          value={50}
          props={{ min: 0, max: 100 }}
        />
      );

      const buttons = screen.getAllByRole("button");
      const decreaseButton = buttons.find(btn => btn.getAttribute("aria-label")?.includes("Decrease"));
      const increaseButton = buttons.find(btn => btn.getAttribute("aria-label")?.includes("Increase"));

      expect(decreaseButton?.hasAttribute("disabled")).toBe(true);
      expect(increaseButton?.hasAttribute("disabled")).toBe(true);
    });
  });

  describe("Min/Max Bounds", () => {
    it("clamps input to min value", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      const { container } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={10}
          onChange={onChange}
          props={{ min: 5, max: 100 }}
        />
      );

      const input = container.querySelector("input[type='text']") as HTMLInputElement;
      await user.clear(input);
      await user.type(input, "2");

      // Each character triggers onChange with clamping
      // When typing "2", it becomes value 2, which gets clamped to min 5
      const calls = onChange.mock.calls;
      const hasClampedValue = calls.some(call => call[1] === 5);
      expect(hasClampedValue).toBe(true);
    });

    it("clamps input to max value", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      const { container } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={10}
          onChange={onChange}
          props={{ min: 5, max: 100 }}
        />
      );

      const input = container.querySelector("input[type='text']") as HTMLInputElement;
      await user.clear(input);
      await user.type(input, "200");

      // When typing "200", intermediate values like 2, 20, 200 are all > max
      // All should be clamped to 100
      const calls = onChange.mock.calls;
      const allClamped = calls.every(call => call[1] <= 100);
      expect(allClamped).toBe(true);
      
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[1]).toBe(100); // Final value clamped to max
    });

    it("allows value within bounds", () => {
      const onChange = vi.fn();
      const collectValueRef = createNumberInputCollectorRef();

      const { rerender } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={25}
          onChange={onChange}
          collectValueRef={collectValueRef}
          props={{ min: 5, max: 100 }}
        />
      );

      // Verify initial value within bounds is accepted
      expect(collectValueRef.current?.getValue()).toBe(25);
      expect(collectValueRef.current?.getValue()).toBeGreaterThanOrEqual(5);
      expect(collectValueRef.current?.getValue()).toBeLessThanOrEqual(100);

      // Test another value within bounds
      rerender(
        <NumberInputWrapper
          {...defaultProps}
          value={75}
          onChange={onChange}
          collectValueRef={collectValueRef}
          props={{ min: 5, max: 100 }}
        />
      );

      expect(collectValueRef.current?.getValue()).toBe(75);
    });
  });

  describe("Increment/Decrement Buttons", () => {
    it("increases value by step when increase button clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <NumberInputWrapper
          {...defaultProps}
          value={10}
          onChange={onChange}
          props={{ step: 5 }}
        />
      );

      const increaseButton = screen.getByLabelText(/Increase/i);
      await user.click(increaseButton);

      expect(onChange).toHaveBeenCalledWith("test-number-input", 15);
    });

    it("decreases value by step when decrease button clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <NumberInputWrapper
          {...defaultProps}
          value={10}
          onChange={onChange}
          props={{ step: 3 }}
        />
      );

      const decreaseButton = screen.getByLabelText(/Decrease/i);
      await user.click(decreaseButton);

      expect(onChange).toHaveBeenCalledWith("test-number-input", 7);
    });

    it("respects min when decreasing", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <NumberInputWrapper
          {...defaultProps}
          value={5}
          onChange={onChange}
          props={{ min: 0, step: 10 }}
        />
      );

      const decreaseButton = screen.getByLabelText(/Decrease/i);
      await user.click(decreaseButton);

      expect(onChange).toHaveBeenCalledWith("test-number-input", 0); // Clamped to min
    });

    it("respects max when increasing", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <NumberInputWrapper
          {...defaultProps}
          value={95}
          onChange={onChange}
          props={{ max: 100, step: 10 }}
        />
      );

      const increaseButton = screen.getByLabelText(/Increase/i);
      await user.click(increaseButton);

      expect(onChange).toHaveBeenCalledWith("test-number-input", 100); // Clamped to max
    });

    it("disables decrease button when at min", () => {
      render(
        <NumberInputWrapper
          {...defaultProps}
          value={0}
          props={{ min: 0, max: 100 }}
        />
      );

      const decreaseButton = screen.getByLabelText(/Decrease/i);
      expect(decreaseButton.hasAttribute("disabled")).toBe(true);
    });

    it("disables increase button when at max", () => {
      render(
        <NumberInputWrapper
          {...defaultProps}
          value={100}
          props={{ min: 0, max: 100 }}
        />
      );

      const increaseButton = screen.getByLabelText(/Increase/i);
      expect(increaseButton.hasAttribute("disabled")).toBe(true);
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "placeholder",
        props : { placeholder: "Enter count" },
        verify: (container: HTMLElement) => {
          const input = container.querySelector("input[type='text']") as HTMLInputElement;
          expect(input.placeholder).toBe("Enter count");
        },
      },
      {
        name  : "prefixLabel",
        props : { prefixLabel: "Items" },
        verify: () => {
          expect(screen.getByText("Items")).toBeTruthy();
        },
      },
      {
        name  : "size=mini",
        props : { size: "mini" as const },
        verify: (container: HTMLElement) => {
          const input = container.querySelector("input[type='text']") as HTMLInputElement;
          expect(input.className).toContain("h-8");
        },
      },
      {
        name  : "size=normal",
        props : { size: "normal" as const },
        verify: (container: HTMLElement) => {
          const input = container.querySelector("input[type='text']") as HTMLInputElement;
          expect(input.className).toContain("h-10");
        },
      },
      {
        name  : "width",
        props : { width: "300px" },
        verify: (container: HTMLElement) => {
          const wrapper = container.querySelector(".group") as HTMLElement;
          expect(wrapper.style.width).toBe("300px");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        const { container } = render(
          <NumberInputWrapper
            {...defaultProps}
            props={props as NumberInputProps}
          />
        );
        verify(container);
      });
    });
  });

  describe("Mini Size Mode", () => {
    it("does not show copy and increment buttons in mini mode", () => {
      render(
        <NumberInputWrapper
          {...defaultProps}
          props={{ size: "mini" }}
        />
      );

      // In mini mode, buttons should not exist
      expect(screen.queryByLabelText(/Increase/i)).toBeNull();
      expect(screen.queryByLabelText(/Decrease/i)).toBeNull();
      expect(screen.queryByLabelText(/Copy/i)).toBeNull();
    });

    it("shows all controls in normal mode", () => {
      render(
        <NumberInputWrapper
          {...defaultProps}
          props={{ size: "normal" }}
        />
      );

      // In normal mode, buttons should exist
      expect(screen.getByLabelText(/Increase/i)).toBeTruthy();
      expect(screen.getByLabelText(/Decrease/i)).toBeTruthy();
      expect(screen.getByLabelText(/Copy/i)).toBeTruthy();
    });
  });

  describe("DOM Rendering", () => {
    it("renders with title as label", () => {
      render(
        <NumberInputWrapper
          {...defaultProps}
          title="Batch Size"
        />
      );

      expect(screen.getByText("Batch Size")).toBeTruthy();
    });

    it("renders with HTML in title", () => {
      render(
        <NumberInputWrapper
          {...defaultProps}
          title="<strong>Count</strong>"
        />
      );

      const strongElement = screen.getByText("Count");
      expect(strongElement.tagName).toBe("STRONG");
    });

    it("renders with correct input type", () => {
      const { container } = render(
        <NumberInputWrapper {...defaultProps} />
      );

      const input = container.querySelector("input[type='text']");
      expect(input).toBeTruthy();
      expect(input?.getAttribute("inputmode")).toBe("decimal");
    });

    it("sets correct aria attributes", () => {
      const { container } = render(
        <NumberInputWrapper
          {...defaultProps}
          mode="output"
        />
      );

      const input = container.querySelector("input[type='text']") as HTMLInputElement;
      expect(input.getAttribute("aria-readonly")).toBe("true");
    });
  });

  describe("Default Value", () => {
    it("exports correct default value", () => {
      expect(NumberInputDefaultValue).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("handles decimal input values", () => {
      const collectValueRef = createNumberInputCollectorRef();

      render(
        <NumberInputWrapper
          {...defaultProps}
          value={3.14159}
          collectValueRef={collectValueRef}
        />
      );

      // Verify decimal value is stored correctly
      expect(collectValueRef.current?.getValue()).toBeCloseTo(3.14159, 5);

      // Test with negative decimal
      const { unmount } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={-2.71828}
          collectValueRef={collectValueRef}
        />
      );

      expect(collectValueRef.current?.getValue()).toBeCloseTo(-2.71828, 5);
      unmount();
    });

    it("handles decimal step values", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <NumberInputWrapper
          {...defaultProps}
          value={1.0}
          onChange={onChange}
          props={{ step: 0.1 }}
        />
      );

      const increaseButton = screen.getByLabelText(/Increase/i);
      await user.click(increaseButton);

      expect(onChange).toHaveBeenCalledWith("test-number-input", 1.1);
    });

    it("handles negative min/max values", () => {
      const onChange = vi.fn();
      const collectValueRef = createNumberInputCollectorRef();

      const { rerender } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={-10}
          onChange={onChange}
          collectValueRef={collectValueRef}
          props={{ min: -100, max: -1 }}
        />
      );

      // Verify value within negative bounds is accepted
      expect(collectValueRef.current?.getValue()).toBe(-10);
      expect(collectValueRef.current?.getValue()).toBeGreaterThanOrEqual(-100);
      expect(collectValueRef.current?.getValue()).toBeLessThanOrEqual(-1);

      // Test value at boundaries
      rerender(
        <NumberInputWrapper
          {...defaultProps}
          value={-1}
          onChange={onChange}
          collectValueRef={collectValueRef}
          props={{ min: -100, max: -1 }}
        />
      );
      expect(collectValueRef.current?.getValue()).toBe(-1);

      rerender(
        <NumberInputWrapper
          {...defaultProps}
          value={-100}
          onChange={onChange}
          collectValueRef={collectValueRef}
          props={{ min: -100, max: -1 }}
        />
      );
      expect(collectValueRef.current?.getValue()).toBe(-100);
    });

    it("handles no min/max constraints", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      const { container } = render(
        <NumberInputWrapper
          {...defaultProps}
          value={0}
          onChange={onChange}
        />
      );

      const input = container.querySelector("input[type='text']") as HTMLInputElement;
      await user.clear(input);
      await user.type(input, "9999999");

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[1]).toBe(9999999);
    });
  });
});
