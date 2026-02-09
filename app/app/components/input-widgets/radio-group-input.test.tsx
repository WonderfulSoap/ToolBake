import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { RadioGroupInput, RadioGroupInputProps, RadioGroupInputOutputValue, RadioGroupInputOutputValueResolver } from "./radio-group-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to properly render RadioGroupInput factory function
function RadioGroupInputWrapper({
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
  value          : string | undefined;
  onChange       : (id: string, newValue: string | undefined) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;
  props?         : RadioGroupInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{RadioGroupInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

// Default options for testing
const defaultOptions = [
  { value: "opt1", label: "Option 1" },
  { value: "opt2", label: "Option 2" },
  { value: "opt3", label: "Option 3" },
];

describe("RadioGroupInput Component", () => {
  const defaultProps = {
    id             : "test-radio",
    title          : "Test Radio Group",
    mode           : "input" as const,
    value          : undefined as string | undefined,
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>,
    props          : { options: defaultOptions },
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: RadioGroupInputProps = {
        options: [
          { value: "a", label: "A", description: "Option A" },
          { value: "b", label: "B" },
        ],
        defaultValue: "a",
        orientation : "horizontal",
        width       : "300px",
      };

      const result = RadioGroupInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with only required options field", () => {
      const minimalProps = {
        options: [{ value: "x", label: "X" }],
      };
      const result = RadioGroupInputProps.parse(minimalProps);
      expect(result.options).toEqual(minimalProps.options);
      expect(result.defaultValue).toBeUndefined();
      expect(result.orientation).toBeUndefined();
      expect(result.width).toBeUndefined();
    });

    it("validates orientation enum values", () => {
      const validOrientations = ["horizontal", "vertical"];
      validOrientations.forEach((orientation) => {
        const result = RadioGroupInputProps.parse({
          options: defaultOptions,
          orientation,
        });
        expect(result.orientation).toBe(orientation);
      });
    });

    it("rejects invalid orientation values", () => {
      expect(() => {
        RadioGroupInputProps.parse({
          options    : defaultOptions,
          orientation: "diagonal",
        });
      }).toThrow();
    });

    it("rejects empty options array", () => {
      expect(() => {
        RadioGroupInputProps.parse({ options: [] });
      }).not.toThrow(); // Empty array is allowed by schema
    });

    it("rejects options without required fields", () => {
      expect(() => {
        RadioGroupInputProps.parse({
          options: [{ value: "a" }], // missing label
        });
      }).toThrow();

      expect(() => {
        RadioGroupInputProps.parse({
          options: [{ label: "A" }], // missing value
        });
      }).toThrow();
    });

    it("accepts options with optional description", () => {
      const result = RadioGroupInputProps.parse({
        options: [
          { value: "a", label: "A", description: "Description for A" },
          { value: "b", label: "B" }, // no description
        ],
      });
      expect(result.options[0].description).toBe("Description for A");
      expect(result.options[1].description).toBeUndefined();
    });
  });

  describe("Output Value Schema", () => {
    it("validates string output values", () => {
      expect(RadioGroupInputOutputValue.parse("option1")).toBe("option1");
      expect(RadioGroupInputOutputValue.parse("")).toBe("");
      expect(RadioGroupInputOutputValue.parse(undefined)).toBeUndefined();
    });

    it("rejects non-string values", () => {
      expect(() => RadioGroupInputOutputValue.parse(123)).toThrow();
      expect(() => RadioGroupInputOutputValue.parse(null)).toThrow();
      expect(() => RadioGroupInputOutputValue.parse({})).toThrow();
    });

    describe("RadioGroupInputOutputValueResolver", () => {
      it("returns enum schema when widget has options", () => {
        const widget = {
          props: {
            options: [
              { value: "fast", label: "Fast" },
              { value: "slow", label: "Slow" },
            ],
          },
        };
        const resolver = RadioGroupInputOutputValueResolver(widget);
        expect(resolver.parse("fast")).toBe("fast");
        expect(resolver.parse("slow")).toBe("slow");
        expect(() => resolver.parse("invalid")).toThrow();
      });

      it("returns default schema when widget has no props", () => {
        const resolver = RadioGroupInputOutputValueResolver();
        expect(resolver.parse("any")).toBe("any");
        expect(resolver.parse(undefined)).toBeUndefined();
      });

      it("returns default schema when options is empty", () => {
        const widget = { props: { options: [] } };
        const resolver = RadioGroupInputOutputValueResolver(widget);
        expect(resolver.parse("any")).toBe("any");
      });
    });
  });

  describe("DOM Rendering", () => {
    it("renders radiogroup with correct role", () => {
      render(<RadioGroupInputWrapper {...defaultProps} />);
      expect(screen.getByRole("radiogroup")).toBeTruthy();
    });

    it("renders all options as radio buttons", () => {
      render(<RadioGroupInputWrapper {...defaultProps} />);
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
    });

    it("renders option labels correctly", () => {
      render(<RadioGroupInputWrapper {...defaultProps} />);
      expect(screen.getByText("Option 1")).toBeTruthy();
      expect(screen.getByText("Option 2")).toBeTruthy();
      expect(screen.getByText("Option 3")).toBeTruthy();
    });

    it("renders option descriptions when provided", () => {
      const propsWithDescriptions = {
        options: [
          { value: "a", label: "A", description: "Description A" },
          { value: "b", label: "B", description: "Description B" },
        ],
      };
      render(<RadioGroupInputWrapper {...defaultProps} props={propsWithDescriptions} />);
      expect(screen.getByText("Description A")).toBeTruthy();
      expect(screen.getByText("Description B")).toBeTruthy();
    });

    it("renders title correctly", () => {
      render(<RadioGroupInputWrapper {...defaultProps} />);
      expect(screen.getByText("Test Radio Group")).toBeTruthy();
    });

    it("renders title as HTML", () => {
      render(<RadioGroupInputWrapper {...defaultProps} title="<strong>Bold Title</strong>" />);
      const strong = screen.getByText("Bold Title");
      expect(strong.tagName).toBe("STRONG");
    });

    it("marks selected option with aria-checked", () => {
      render(<RadioGroupInputWrapper {...defaultProps} value="opt2" />);
      const radios = screen.getAllByRole("radio");
      expect(radios[0].getAttribute("aria-checked")).toBe("false");
      expect(radios[1].getAttribute("aria-checked")).toBe("true");
      expect(radios[2].getAttribute("aria-checked")).toBe("false");
    });
  });

  describe("User Interaction", () => {
    it("calls onChange when user clicks an option", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<RadioGroupInputWrapper {...defaultProps} onChange={onChange} />);

      const option2 = screen.getByText("Option 2").closest("button")!;
      await user.click(option2);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("test-radio", "opt2");
    });

    it("updates visual selection on click", async () => {
      const user = userEvent.setup();

      render(<RadioGroupInputWrapper {...defaultProps} />);

      const radios = screen.getAllByRole("radio");
      expect(radios[1].getAttribute("aria-checked")).toBe("false");

      const option2 = screen.getByText("Option 2").closest("button")!;
      await user.click(option2);

      expect(radios[1].getAttribute("aria-checked")).toBe("true");
    });

    it("allows switching between options", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<RadioGroupInputWrapper {...defaultProps} onChange={onChange} />);

      // Click option 1
      await user.click(screen.getByText("Option 1").closest("button")!);
      expect(onChange).toHaveBeenLastCalledWith("test-radio", "opt1");

      // Click option 3
      await user.click(screen.getByText("Option 3").closest("button")!);
      expect(onChange).toHaveBeenLastCalledWith("test-radio", "opt3");

      // Click option 2
      await user.click(screen.getByText("Option 2").closest("button")!);
      expect(onChange).toHaveBeenLastCalledWith("test-radio", "opt2");

      expect(onChange).toHaveBeenCalledTimes(3);
    });

    it("clicking already selected option still triggers onChange", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<RadioGroupInputWrapper {...defaultProps} value="opt1" onChange={onChange} />);

      await user.click(screen.getByText("Option 1").closest("button")!);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("test-radio", "opt1");
    });
  });

  describe("Value Synchronization", () => {
    it("updates internal state when value prop changes", async () => {
      const { rerender } = render(<RadioGroupInputWrapper {...defaultProps} value="opt1" />);

      let radios = screen.getAllByRole("radio");
      expect(radios[0].getAttribute("aria-checked")).toBe("true");

      rerender(<RadioGroupInputWrapper {...defaultProps} value="opt3" />);

      await waitFor(() => {
        radios = screen.getAllByRole("radio");
        expect(radios[2].getAttribute("aria-checked")).toBe("true");
        expect(radios[0].getAttribute("aria-checked")).toBe("false");
      });
    });

    it("does not call onChange when value prop updates from parent", async () => {
      const onChange = vi.fn();

      const { rerender } = render(<RadioGroupInputWrapper {...defaultProps} value="opt1" onChange={onChange} />);

      onChange.mockClear();

      rerender(<RadioGroupInputWrapper {...defaultProps} value="opt2" onChange={onChange} />);

      await waitFor(() => {
        const radios = screen.getAllByRole("radio");
        expect(radios[1].getAttribute("aria-checked")).toBe("true");
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("handles rapid value changes from parent", async () => {
      const { rerender } = render(<RadioGroupInputWrapper {...defaultProps} value="opt1" />);

      rerender(<RadioGroupInputWrapper {...defaultProps} value="opt2" />);
      rerender(<RadioGroupInputWrapper {...defaultProps} value="opt3" />);

      await waitFor(() => {
        const radios = screen.getAllByRole("radio");
        expect(radios[2].getAttribute("aria-checked")).toBe("true");
      });
    });

    it("handles undefined value", () => {
      render(<RadioGroupInputWrapper {...defaultProps} value={undefined} />);

      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        expect(radio.getAttribute("aria-checked")).toBe("false");
      });
    });
  });

  describe("collectValueRef Interface", () => {
    it("exposes getValue through collectValueRef", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      render(<RadioGroupInputWrapper {...defaultProps} value="opt2" collectValueRef={collectValueRef} />);

      expect(collectValueRef.current).toBeDefined();
      expect(collectValueRef.current?.getValue).toBeInstanceOf(Function);
      expect(collectValueRef.current?.getValue()).toBe("opt2");
    });

    it("getValue returns undefined when no selection", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      render(<RadioGroupInputWrapper {...defaultProps} value={undefined} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBeUndefined();
    });

    it("getValue returns current value after user selection", async () => {
      const user = userEvent.setup();
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      render(<RadioGroupInputWrapper {...defaultProps} value={undefined} collectValueRef={collectValueRef} />);

      await user.click(screen.getByText("Option 2").closest("button")!);

      expect(collectValueRef.current?.getValue()).toBe("opt2");
    });

    it("getValue returns correct value after parent update", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      const { rerender } = render(<RadioGroupInputWrapper {...defaultProps} value="opt1" collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe("opt1");

      rerender(<RadioGroupInputWrapper {...defaultProps} value="opt3" collectValueRef={collectValueRef} />);

      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe("opt3");
      });
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "undefined value", value: undefined },
      { name: "first option", value: "opt1" },
      { name: "middle option", value: "opt2" },
      { name: "last option", value: "opt3" },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

        render(<RadioGroupInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);

        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders with different values", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      const rerenderCases = ["opt1", "opt2", undefined, "opt3", "opt1"];

      const { rerender } = render(
        <RadioGroupInputWrapper {...defaultProps} value={rerenderCases[0]} collectValueRef={collectValueRef} />
      );

      expect(collectValueRef.current?.getValue()).toBe(rerenderCases[0]);

      for (let i = 1; i < rerenderCases.length; i++) {
        rerender(
          <RadioGroupInputWrapper {...defaultProps} value={rerenderCases[i]} collectValueRef={collectValueRef} />
        );

        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toBe(rerenderCases[i]);
        });
      }
    });

    it("onChange and collectValueRef return same value after user selection", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      const selectionCases = [
        { clickLabel: "Option 1", expected: "opt1" },
        { clickLabel: "Option 3", expected: "opt3" },
        { clickLabel: "Option 2", expected: "opt2" },
      ];

      render(
        <RadioGroupInputWrapper
          {...defaultProps}
          value={undefined}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      for (const { clickLabel, expected } of selectionCases) {
        onChange.mockClear();

        await user.click(screen.getByText(clickLabel).closest("button")!);

        // Verify onChange was called with correct value
        expect(onChange).toHaveBeenCalledWith("test-radio", expected);

        // Verify collectValueRef returns the same value
        expect(collectValueRef.current?.getValue()).toBe(expected);
      }
    });
  });

  describe("Output Mode", () => {
    it("renders with aria-readonly in output mode", () => {
      render(<RadioGroupInputWrapper {...defaultProps} mode="output" value="opt1" />);

      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup.getAttribute("aria-readonly")).toBe("true");
    });

    it("does not call onChange in output mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<RadioGroupInputWrapper {...defaultProps} mode="output" value="opt1" onChange={onChange} />);

      await user.click(screen.getByText("Option 2").closest("button")!);

      expect(onChange).not.toHaveBeenCalled();
    });

    it("displays selected value in output mode", () => {
      render(<RadioGroupInputWrapper {...defaultProps} mode="output" value="opt2" />);

      const radios = screen.getAllByRole("radio");
      expect(radios[1].getAttribute("aria-checked")).toBe("true");
    });

    it("collectValueRef still works in output mode", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      render(<RadioGroupInputWrapper {...defaultProps} mode="output" value="opt2" collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe("opt2");
    });

    it("value remains unchanged after click attempt in output mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      const testCases = [
        { initialValue: "opt1", clickLabel: "Option 2" },
        { initialValue: "opt2", clickLabel: "Option 3" },
        { initialValue: "opt3", clickLabel: "Option 1" },
      ];

      for (const { initialValue, clickLabel } of testCases) {
        onChange.mockClear();

        const { unmount } = render(
          <RadioGroupInputWrapper
            {...defaultProps}
            mode="output"
            value={initialValue}
            onChange={onChange}
            collectValueRef={collectValueRef}
          />
        );

        // Verify initial value
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        // Try to click different option
        await user.click(screen.getByText(clickLabel).closest("button")!);

        // Verify onChange was NOT called
        expect(onChange).not.toHaveBeenCalled();

        // Verify value remains unchanged
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        unmount();
      }
    });

    it("applies opacity style in output mode", () => {
      render(<RadioGroupInputWrapper {...defaultProps} mode="output" value="opt1" />);

      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        expect(radio.className).toContain("opacity-80");
      });
    });
  });

  describe("Orientation", () => {
    it("renders vertical layout by default", () => {
      render(<RadioGroupInputWrapper {...defaultProps} />);

      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup.className).toContain("flex-col");
    });

    it("renders horizontal layout when specified", () => {
      const propsWithHorizontal = {
        ...defaultProps.props,
        orientation: "horizontal" as const,
      };

      render(<RadioGroupInputWrapper {...defaultProps} props={propsWithHorizontal} />);

      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup.className).toContain("flex-wrap");
      expect(radiogroup.className).not.toContain("flex-col");
    });

    it("renders vertical layout when specified", () => {
      const propsWithVertical = {
        ...defaultProps.props,
        orientation: "vertical" as const,
      };

      render(<RadioGroupInputWrapper {...defaultProps} props={propsWithVertical} />);

      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup.className).toContain("flex-col");
    });
  });

  describe("Width Prop", () => {
    it("applies width style when specified", () => {
      const propsWithWidth = {
        ...defaultProps.props,
        width: "400px",
      };

      render(<RadioGroupInputWrapper {...defaultProps} props={propsWithWidth} />);

      const container = screen.getByRole("radiogroup").closest(".group") as HTMLElement;
      expect(container?.style.width).toBe("400px");
      expect(container?.className).toContain("flex-shrink-0");
    });

    it("does not apply width style when not specified", () => {
      render(<RadioGroupInputWrapper {...defaultProps} />);

      const container = screen.getByRole("radiogroup").closest(".group") as HTMLElement;
      expect(container?.style.width).toBeFalsy();
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name : "options with descriptions",
        props: {
          options: [
            { value: "a", label: "Alpha", description: "First letter" },
            { value: "b", label: "Beta", description: "Second letter" },
          ],
        },
        verify: () => {
          expect(screen.getByText("Alpha")).toBeTruthy();
          expect(screen.getByText("Beta")).toBeTruthy();
          expect(screen.getByText("First letter")).toBeTruthy();
          expect(screen.getByText("Second letter")).toBeTruthy();
        },
      },
      {
        name  : "orientation=horizontal",
        props : { options: defaultOptions, orientation: "horizontal" as const },
        verify: () => {
          const radiogroup = screen.getByRole("radiogroup");
          expect(radiogroup.className).toContain("flex-wrap");
        },
      },
      {
        name  : "orientation=vertical",
        props : { options: defaultOptions, orientation: "vertical" as const },
        verify: () => {
          const radiogroup = screen.getByRole("radiogroup");
          expect(radiogroup.className).toContain("flex-col");
        },
      },
      {
        name  : "width",
        props : { options: defaultOptions, width: "350px" },
        verify: () => {
          const container = screen.getByRole("radiogroup").closest(".group") as HTMLElement;
          expect(container.style.width).toBe("350px");
          expect(container.className).toContain("flex-shrink-0");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<RadioGroupInputWrapper {...defaultProps} props={props} />);
        verify();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles options with special characters in labels", () => {
      const specialOptions = {
        options: [
          { value: "html", label: "<strong>HTML</strong>" },
          { value: "unicode", label: "Option 🎉" },
        ],
      };

      render(<RadioGroupInputWrapper {...defaultProps} props={specialOptions} />);

      // SafeHtml renders HTML correctly
      expect(screen.getByText("HTML").tagName).toBe("STRONG");
      expect(screen.getByText("Option 🎉")).toBeTruthy();
    });

    it("handles options with special characters in values", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const specialOptions = {
        options: [
          { value: "value-with-dash", label: "Dash" },
          { value: "value_with_underscore", label: "Underscore" },
          { value: "value.with.dots", label: "Dots" },
        ],
      };

      render(<RadioGroupInputWrapper {...defaultProps} props={specialOptions} onChange={onChange} />);

      await user.click(screen.getByText("Dots").closest("button")!);

      expect(onChange).toHaveBeenCalledWith("test-radio", "value.with.dots");
    });

    it("handles single option", () => {
      const singleOption = {
        options: [{ value: "only", label: "Only Option" }],
      };

      render(<RadioGroupInputWrapper {...defaultProps} props={singleOption} />);

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(1);
    });

    it("handles many options", () => {
      const manyOptions = {
        options: Array.from({ length: 10 }, (_, i) => ({
          value: `opt${i}`,
          label: `Option ${i}`,
        })),
      };

      render(<RadioGroupInputWrapper {...defaultProps} props={manyOptions} />);

      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(10);
    });

    it("handles value not in options", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string | undefined> | undefined>() as RefObject<WidgetValueCollectorInf<string | undefined> | undefined>;

      render(<RadioGroupInputWrapper {...defaultProps} value="nonexistent" collectValueRef={collectValueRef} />);

      // No option should be selected
      const radios = screen.getAllByRole("radio");
      radios.forEach((radio) => {
        expect(radio.getAttribute("aria-checked")).toBe("false");
      });

      // But getValue should still return the value
      expect(collectValueRef.current?.getValue()).toBe("nonexistent");
    });

    it("handles undefined props gracefully", () => {
      // options is required, so we expect an error when props is undefined
      expect(() => {
        render(<RadioGroupInputWrapper {...defaultProps} props={undefined} />);
      }).toThrow();
    });
  });

  describe("Visual Feedback", () => {
    it("applies active styles to selected option", () => {
      render(<RadioGroupInputWrapper {...defaultProps} value="opt2" />);

      const radios = screen.getAllByRole("radio");

      // Selected option should have primary border/bg
      expect(radios[1].className).toContain("border-primary");
      expect(radios[1].className).toContain("bg-primary/5");

      // Unselected options should not have primary styles
      expect(radios[0].className).toContain("border-border");
      expect(radios[2].className).toContain("border-border");
    });

    it("updates visual styles when selection changes", async () => {
      const user = userEvent.setup();

      render(<RadioGroupInputWrapper {...defaultProps} value="opt1" />);

      let radios = screen.getAllByRole("radio");
      // Check aria-checked instead of class, as hover class contains border-primary too
      expect(radios[0].getAttribute("aria-checked")).toBe("true");
      expect(radios[0].className).toContain("bg-primary/5");

      await user.click(screen.getByText("Option 3").closest("button")!);

      radios = screen.getAllByRole("radio");
      expect(radios[0].getAttribute("aria-checked")).toBe("false");
      expect(radios[0].className).not.toContain("bg-primary/5");
      expect(radios[2].getAttribute("aria-checked")).toBe("true");
      expect(radios[2].className).toContain("bg-primary/5");
    });
  });
});
