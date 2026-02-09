import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { ButtonInput, ButtonInputProps, ButtonInputOutputValueResolver } from "./button-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to properly render ButtonInput factory function
function ButtonInputWrapper({
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
  props?         : ButtonInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{ButtonInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

describe("ButtonInput Component", () => {
  const defaultProps = {
    id             : "test-button",
    title          : "Test Button",
    mode           : "input" as const,
    value          : 0,
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: ButtonInputProps = {
        label      : "Click Me",
        variant    : "default",
        size       : "default",
        description: "Button description",
        width      : "200px",
      };

      const result = ButtonInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const minimalProps = {};
      const result = ButtonInputProps.parse(minimalProps);
      expect(result).toEqual({});
    });

    it("validates variant enum values", () => {
      const validVariants = ["default", "destructive", "outline", "secondary", "ghost", "link"];
      validVariants.forEach((variant) => {
        const result = ButtonInputProps.parse({ variant });
        expect(result.variant).toBe(variant);
      });
    });

    it("rejects invalid variant values", () => {
      expect(() => {
        ButtonInputProps.parse({ variant: "invalid" });
      }).toThrow();
    });

    it("validates size enum values", () => {
      const validSizes = ["default", "sm", "lg", "icon"];
      validSizes.forEach((size) => {
        const result = ButtonInputProps.parse({ size });
        expect(result.size).toBe(size);
      });
    });

    it("rejects invalid size values", () => {
      expect(() => {
        ButtonInputProps.parse({ size: "invalid" });
      }).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates number output values", () => {
      const resolver = ButtonInputOutputValueResolver();
      expect(resolver.parse(0)).toBe(0);
      expect(resolver.parse(123)).toBe(123);
      expect(resolver.parse(Date.now())).toBeTypeOf("number");
    });

    it("rejects non-number values", () => {
      const resolver = ButtonInputOutputValueResolver();
      expect(() => resolver.parse("123")).toThrow();
      expect(() => resolver.parse(null)).toThrow();
      expect(() => resolver.parse(undefined)).toThrow();
      expect(() => resolver.parse({})).toThrow();
    });
  });

  describe("DOM Rendering", () => {
    it("renders button element with correct attributes", () => {
      render(<ButtonInputWrapper {...defaultProps} />);

      const button = screen.getByRole("button");
      expect(button).toBeTruthy();
      expect(button.id).toBe("test-button");
    });

    it("renders with title as button text by default", () => {
      render(<ButtonInputWrapper {...defaultProps} title="My Button" />);

      const button = screen.getByRole("button");
      expect(button.textContent).toBe("My Button");
    });

    it("renders with custom label when provided", () => {
      const props: ButtonInputProps = {
        label: "Custom Label",
      };

      render(<ButtonInputWrapper {...defaultProps} props={props} />);

      const button = screen.getByRole("button");
      expect(button.textContent).toBe("Custom Label");
    });

    it("renders description when provided", () => {
      const props: ButtonInputProps = {
        description: "Click to perform action",
      };

      render(<ButtonInputWrapper {...defaultProps} props={props} />);

      expect(screen.getByText("Click to perform action")).toBeTruthy();
    });

    it("renders title as HTML", () => {
      render(<ButtonInputWrapper {...defaultProps} title="<strong>Bold</strong>" />);

      const strongs = screen.getAllByText("Bold");
      expect(strongs.length).toBeGreaterThan(0);
      expect(strongs[0].tagName).toBe("STRONG");
    });

    it("renders label element", () => {
      render(<ButtonInputWrapper {...defaultProps} />);

      const labels = screen.getAllByText("Test Button");
      const labelElement = labels.find(el => el.closest("label"));
      expect(labelElement).toBeTruthy();
    });
  });

  describe("User Interaction", () => {
    it("calls onChange with timestamp when button is clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const beforeClick = Date.now();

      render(<ButtonInputWrapper {...defaultProps} onChange={onChange} />);

      const button = screen.getByRole("button");
      await user.click(button);

      const afterClick = Date.now();

      expect(onChange).toHaveBeenCalledTimes(1);
      const [id, value] = onChange.mock.calls[0];
      expect(id).toBe("test-button");
      expect(value).toBeGreaterThanOrEqual(beforeClick);
      expect(value).toBeLessThanOrEqual(afterClick);
    });

    it("each click generates a new timestamp", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<ButtonInputWrapper {...defaultProps} onChange={onChange} />);

      const button = screen.getByRole("button");

      await user.click(button);
      const firstValue = onChange.mock.calls[0][1];

      // Small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await user.click(button);
      const secondValue = onChange.mock.calls[1][1];

      expect(secondValue).toBeGreaterThan(firstValue);
    });

    it("handles multiple rapid clicks", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<ButtonInputWrapper {...defaultProps} onChange={onChange} />);

      const button = screen.getByRole("button");

      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(onChange).toHaveBeenCalledTimes(3);

      // All values should be numbers and increasing
      const values = onChange.mock.calls.map(call => call[1]);
      values.forEach(val => expect(val).toBeTypeOf("number"));
      expect(values[1]).toBeGreaterThanOrEqual(values[0]);
      expect(values[2]).toBeGreaterThanOrEqual(values[1]);
    });
  });

  describe("Value Synchronization", () => {
    it("updates internal state when value prop changes", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      const { rerender } = render(<ButtonInputWrapper {...defaultProps} value={100} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe(100);

      rerender(<ButtonInputWrapper {...defaultProps} value={200} collectValueRef={collectValueRef} />);

      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe(200);
      });
    });

    it("does not call onChange when value prop updates from parent", async () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      const { rerender } = render(<ButtonInputWrapper {...defaultProps} value={100} onChange={onChange} collectValueRef={collectValueRef} />);

      onChange.mockClear();

      rerender(<ButtonInputWrapper {...defaultProps} value={200} onChange={onChange} collectValueRef={collectValueRef} />);

      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe(200);
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("collectValueRef Interface", () => {
    it("exposes getValue through collectValueRef", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      render(<ButtonInputWrapper {...defaultProps} value={123} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current).toBeDefined();
      expect(collectValueRef.current?.getValue).toBeInstanceOf(Function);
      expect(collectValueRef.current?.getValue()).toBe(123);
    });

    it("getValue returns current value after button click", async () => {
      const user = userEvent.setup();
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      render(<ButtonInputWrapper {...defaultProps} value={0} collectValueRef={collectValueRef} />);

      const button = screen.getByRole("button");
      const beforeClick = Date.now();
      await user.click(button);
      const afterClick = Date.now();

      const collectedValue = collectValueRef.current?.getValue();
      expect(collectedValue).toBeTypeOf("number");
      expect(collectedValue).toBeGreaterThanOrEqual(beforeClick);
      expect(collectedValue).toBeLessThanOrEqual(afterClick);
    });

    it("getValue returns correct value after parent update", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      const { rerender } = render(<ButtonInputWrapper {...defaultProps} value={100} collectValueRef={collectValueRef} />);

      rerender(<ButtonInputWrapper {...defaultProps} value={500} collectValueRef={collectValueRef} />);

      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe(500);
      });
    });
  });

  describe("Output Mode", () => {
    it("renders as disabled in output mode", () => {
      render(<ButtonInputWrapper {...defaultProps} mode="output" value={0} />);

      const button = screen.getByRole("button") as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it("does not call onChange in output mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<ButtonInputWrapper {...defaultProps} mode="output" value={0} onChange={onChange} />);

      const button = screen.getByRole("button");

      // Try to click (should not work because disabled)
      await user.click(button);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("collectValueRef still works in output mode", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      render(<ButtonInputWrapper {...defaultProps} mode="output" value={999} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe(999);
    });
  });

  describe("Variant Styles", () => {
    const variants = ["default", "destructive", "outline", "secondary", "ghost", "link"] as const;

    variants.forEach((variant) => {
      it(`renders with ${variant} variant`, () => {
        const props: ButtonInputProps = { variant };

        render(<ButtonInputWrapper {...defaultProps} props={props} />);

        const button = screen.getByRole("button");
        expect(button).toBeTruthy();
      });
    });
  });

  describe("Size Variants", () => {
    const sizes = ["default", "sm", "lg", "icon"] as const;

    sizes.forEach((size) => {
      it(`renders with ${size} size`, () => {
        const props: ButtonInputProps = { size };

        render(<ButtonInputWrapper {...defaultProps} props={props} />);

        const button = screen.getByRole("button");
        expect(button).toBeTruthy();
      });
    });
  });

  describe("Width Prop", () => {
    it("applies width style when specified", () => {
      const props: ButtonInputProps = {
        width: "300px",
      };

      render(<ButtonInputWrapper {...defaultProps} props={props} />);

      const container = screen.getByRole("button").closest(".group") as HTMLElement;
      expect(container?.style.width).toBe("300px");
      expect(container?.className).toContain("flex-shrink-0");
    });

    it("does not apply width style when not specified", () => {
      render(<ButtonInputWrapper {...defaultProps} />);

      const container = screen.getByRole("button").closest(".group") as HTMLElement;
      expect(container?.style.width).toBeFalsy();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "zero", value: 0 },
      { name: "positive integer", value: 12345 },
      { name: "negative integer", value: -999 },
      { name: "large number", value: 1234567890123 },
      { name: "timestamp", value: Date.now() },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

        render(<ButtonInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);

        expect(collectValueRef.current).toBeDefined();
        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders with different values", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      const rerenderCases = [100, 200, 0, -50, 999999, 42];

      const { rerender } = render(
        <ButtonInputWrapper {...defaultProps} value={rerenderCases[0]} collectValueRef={collectValueRef} />
      );

      expect(collectValueRef.current?.getValue()).toBe(rerenderCases[0]);

      for (let i = 1; i < rerenderCases.length; i++) {
        rerender(
          <ButtonInputWrapper {...defaultProps} value={rerenderCases[i]} collectValueRef={collectValueRef} />
        );

        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toBe(rerenderCases[i]);
        });
      }
    });

    it("onChange and collectValueRef return same value after button click", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      render(
        <ButtonInputWrapper
          {...defaultProps}
          value={0}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const button = screen.getByRole("button");

      // Click multiple times
      for (let i = 0; i < 3; i++) {
        onChange.mockClear();
        await user.click(button);

        // Small delay to ensure timestamp changes
        await new Promise(resolve => setTimeout(resolve, 10));

        const onChangeValue = onChange.mock.calls[0][1];
        const collectedValue = collectValueRef.current?.getValue();

        // Both should be the same value
        expect(collectedValue).toBe(onChangeValue);
        expect(collectedValue).toBeTypeOf("number");
      }
    });

    it("in output mode, button click does not trigger onChange but collectValueRef still works", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      const testCases = [
        { initialValue: 100 },
        { initialValue: 200 },
        { initialValue: 0 },
      ];

      for (const { initialValue } of testCases) {
        onChange.mockClear();

        const { unmount } = render(
          <ButtonInputWrapper
            {...defaultProps}
            mode="output"
            value={initialValue}
            onChange={onChange}
            collectValueRef={collectValueRef}
          />
        );

        const button = screen.getByRole("button") as HTMLButtonElement;

        // Verify button is disabled
        expect(button.disabled).toBe(true);

        // Verify collectValueRef can collect the value
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        // Try to click (should not work because disabled)
        await user.click(button);

        // Verify onChange was NOT called
        expect(onChange).not.toHaveBeenCalled();

        // Verify value remains unchanged
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        unmount();
      }
    });
  });

  describe("Edge Cases", () => {
    it("handles zero value", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      render(<ButtonInputWrapper {...defaultProps} value={0} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe(0);
    });

    it("handles negative values", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      render(<ButtonInputWrapper {...defaultProps} value={-999} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe(-999);
    });

    it("handles very large timestamp values", () => {
      const largeTimestamp = Date.now() + 1000000000;
      const collectValueRef = createRef<WidgetValueCollectorInf<number> | undefined>() as RefObject<WidgetValueCollectorInf<number> | undefined>;

      render(<ButtonInputWrapper {...defaultProps} value={largeTimestamp} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe(largeTimestamp);
    });

    it("handles undefined props gracefully", () => {
      render(<ButtonInputWrapper {...defaultProps} props={undefined} />);

      expect(screen.getByRole("button")).toBeTruthy();
    });

    it("button display does not depend on value changes", async () => {
      const { rerender } = render(<ButtonInputWrapper {...defaultProps} value={100} />);

      const button1 = screen.getByRole("button");
      const text1 = button1.textContent;

      rerender(<ButtonInputWrapper {...defaultProps} value={999} />);

      const button2 = screen.getByRole("button");
      const text2 = button2.textContent;

      // Button text should remain the same even when value changes
      expect(text1).toBe(text2);
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "label",
        props : { label: "Execute Action" },
        verify: () => {
          const button = screen.getByText("Execute Action");
          expect(button).toBeTruthy();
        },
      },
      {
        name  : "description",
        props : { description: "Click to start process" },
        verify: () => {
          const description = screen.getByText("Click to start process");
          expect(description).toBeTruthy();
        },
      },
      {
        name  : "variant=destructive",
        props : { variant: "destructive" as const },
        verify: () => {
          const button = screen.getByRole("button");
          expect(button).toBeTruthy();
        },
      },
      {
        name  : "variant=outline",
        props : { variant: "outline" as const },
        verify: () => {
          const button = screen.getByRole("button");
          expect(button).toBeTruthy();
        },
      },
      {
        name  : "size=sm",
        props : { size: "sm" as const },
        verify: () => {
          const button = screen.getByRole("button");
          expect(button).toBeTruthy();
        },
      },
      {
        name  : "size=lg",
        props : { size: "lg" as const },
        verify: () => {
          const button = screen.getByRole("button");
          expect(button).toBeTruthy();
        },
      },
      {
        name  : "width",
        props : { width: "250px" },
        verify: () => {
          const container = screen.getByRole("button").closest(".group") as HTMLElement;
          expect(container.style.width).toBe("250px");
          expect(container.className).toContain("flex-shrink-0");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<ButtonInputWrapper {...defaultProps} value={0} props={props} />);
        verify();
      });
    });
  });
});
