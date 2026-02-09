import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { TextInput, TextInputProps, TextInputDefaultValue, TextInputOutputValueResolver } from "./text-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to properly render TextInput factory function
function TextInputWrapper({
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
  value          : string;
  onChange       : (id: string, newValue: string) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<string> | undefined>;
  props?         : TextInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{TextInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

describe("TextInput Component", () => {
  const defaultProps = {
    id             : "test-input",
    title          : "Test Input",
    mode           : "input" as const,
    value          : "",
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: TextInputProps = {
        placeholder    : "Enter text",
        defaultValue   : "default",
        prefixLabel    : "Label",
        prefixLabelSize: "100px",
        size           : "normal",
        delayTrigger   : false,
        width          : "300px",
      };

      const result = TextInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const minimalProps = {};
      const result = TextInputProps.parse(minimalProps);
      expect(result).toEqual({});
    });

    it("validates size enum values", () => {
      const validSizes = ["normal", "mini"];
      validSizes.forEach((size) => {
        const result = TextInputProps.parse({ size });
        expect(result.size).toBe(size);
      });
    });

    it("rejects invalid size values", () => {
      expect(() => {
        TextInputProps.parse({ size: "invalid" });
      }).toThrow();
    });

    it("accepts boolean for delayTrigger", () => {
      const result1 = TextInputProps.parse({ delayTrigger: true });
      expect(result1.delayTrigger).toBe(true);

      const result2 = TextInputProps.parse({ delayTrigger: false });
      expect(result2.delayTrigger).toBe(false);
    });
  });

  describe("Output Value Schema", () => {
    it("validates string output values", () => {
      const resolver = TextInputOutputValueResolver();
      expect(resolver.parse("test")).toBe("test");
      expect(resolver.parse("")).toBe("");
      expect(resolver.parse("123")).toBe("123");
    });

    it("rejects non-string values", () => {
      const resolver = TextInputOutputValueResolver();
      expect(() => resolver.parse(123)).toThrow();
      expect(() => resolver.parse(null)).toThrow();
      expect(() => resolver.parse(undefined)).toThrow();
      expect(() => resolver.parse({})).toThrow();
    });
  });

  describe("Default Value", () => {
    it("exports correct default value", () => {
      expect(TextInputDefaultValue).toBe("");
    });
  });

  describe("DOM Rendering", () => {
    it("renders input element with correct attributes", () => {
      render(<TextInputWrapper {...defaultProps} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.id).toBe("tool-input-test-input");
      expect(input.type).toBe("text");
    });

    it("renders with initial value", () => {
      render(<TextInputWrapper {...defaultProps} value="initial value" />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("initial value");
    });

    it("renders with placeholder", () => {
      const props: TextInputProps = {
        placeholder: "Enter text here",
      };

      render(<TextInputWrapper {...defaultProps} props={props} />);

      expect(screen.getByPlaceholderText("Enter text here")).toBeTruthy();
    });

    it("renders with prefix label", () => {
      const props: TextInputProps = {
        prefixLabel: "Name",
      };

      render(<TextInputWrapper {...defaultProps} props={props} />);

      expect(screen.getByText("Name")).toBeTruthy();
    });

    it("renders title as HTML", () => {
      render(<TextInputWrapper {...defaultProps} title="<strong>Bold Title</strong>" />);

      const strong = screen.getByText("Bold Title");
      expect(strong.tagName).toBe("STRONG");
    });

    it("renders label element", () => {
      render(<TextInputWrapper {...defaultProps} />);

      // Label is wrapped in SafeHtml which renders as span
      const labelContainer = screen.getByText("Test Input").closest("label");
      expect(labelContainer).toBeTruthy();
      expect(labelContainer?.getAttribute("for")).toBe("tool-input-test-input");
    });
  });

  describe("User Interaction", () => {
    it("calls onChange when user types", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextInputWrapper {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "hello");

      // onChange is called for each character
      expect(onChange).toHaveBeenCalledTimes(5);
      expect(onChange).toHaveBeenNthCalledWith(1, "test-input", "h");
      expect(onChange).toHaveBeenNthCalledWith(2, "test-input", "he");
      expect(onChange).toHaveBeenNthCalledWith(3, "test-input", "hel");
      expect(onChange).toHaveBeenNthCalledWith(4, "test-input", "hell");
      expect(onChange).toHaveBeenNthCalledWith(5, "test-input", "hello");
    });

    it("updates displayed value immediately on user input", async () => {
      const user = userEvent.setup();

      render(<TextInputWrapper {...defaultProps} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      await user.type(input, "test");

      expect(input.value).toBe("test");
    });

    it("handles backspace correctly", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextInputWrapper {...defaultProps} value="hello" onChange={onChange} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      await user.clear(input);
      await user.type(input, "hi");

      expect(input.value).toBe("hi");
      expect(onChange).toHaveBeenCalledWith("test-input", "hi");
    });

    it("handles paste event", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextInputWrapper {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      await user.click(input);
      await user.paste("pasted text");

      expect(input.value).toBe("pasted text");
      expect(onChange).toHaveBeenCalledWith("test-input", "pasted text");
    });

    it("handles special characters input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextInputWrapper {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "<script>");

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[1]).toBe("<script>");
    });
  });

  describe("Value Synchronization", () => {
    it("updates internal state when value prop changes", async () => {
      const { rerender } = render(<TextInputWrapper {...defaultProps} value="initial" />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("initial");

      // Parent passes new value
      rerender(<TextInputWrapper {...defaultProps} value="updated from parent" />);

      await waitFor(() => {
        expect(input.value).toBe("updated from parent");
      });
    });

    it("does not call onChange when value prop updates from parent", async () => {
      const onChange = vi.fn();

      const { rerender } = render(<TextInputWrapper {...defaultProps} value="initial" onChange={onChange} />);

      onChange.mockClear();

      rerender(<TextInputWrapper {...defaultProps} value="updated" onChange={onChange} />);

      await waitFor(() => {
        const input = screen.getByRole("textbox") as HTMLInputElement;
        expect(input.value).toBe("updated");
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it("handles rapid value changes from parent", async () => {
      const { rerender } = render(<TextInputWrapper {...defaultProps} value="value1" />);

      rerender(<TextInputWrapper {...defaultProps} value="value2" />);
      rerender(<TextInputWrapper {...defaultProps} value="value3" />);

      await waitFor(() => {
        const input = screen.getByRole("textbox") as HTMLInputElement;
        expect(input.value).toBe("value3");
      });
    });
  });

  describe("collectValueRef Interface", () => {
    it("exposes getValue through collectValueRef", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      render(<TextInputWrapper {...defaultProps} value="test value" collectValueRef={collectValueRef} />);

      expect(collectValueRef.current).toBeDefined();
      expect(collectValueRef.current?.getValue).toBeInstanceOf(Function);
      expect(collectValueRef.current?.getValue()).toBe("test value");
    });

    it("getValue returns current DOM value", async () => {
      const user = userEvent.setup();
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      render(<TextInputWrapper {...defaultProps} value="initial" collectValueRef={collectValueRef} />);

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "dom updated");

      expect(collectValueRef.current?.getValue()).toBe("dom updated");
    });

    it("getValue returns correct value after parent update", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      const { rerender } = render(<TextInputWrapper {...defaultProps} value="initial" collectValueRef={collectValueRef} />);

      rerender(<TextInputWrapper {...defaultProps} value="parent updated" collectValueRef={collectValueRef} />);

      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe("parent updated");
      });
    });
  });

  describe("Output Mode", () => {
    it("renders as read-only in output mode", () => {
      render(<TextInputWrapper {...defaultProps} mode="output" value="readonly value" />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.readOnly).toBe(true);
      expect(input.getAttribute("aria-readonly")).toBe("true");
    });

    it("does not call onChange in output mode", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextInputWrapper {...defaultProps} mode="output" value="readonly" onChange={onChange} />);

      const input = screen.getByRole("textbox");

      // Try to type (should not work because readonly)
      await user.type(input, "test");

      expect(onChange).not.toHaveBeenCalled();
    });

    it("displays value in output mode", () => {
      render(<TextInputWrapper {...defaultProps} mode="output" value="output value" />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("output value");
    });
  });

  describe("Size Variants", () => {
    it("renders normal size by default", () => {
      render(<TextInputWrapper {...defaultProps} />);

      const input = screen.getByRole("textbox");
      expect(input.className).toContain("h-10");
    });

    it("renders mini size when specified", () => {
      const props: TextInputProps = {
        size: "mini",
      };

      render(<TextInputWrapper {...defaultProps} props={props} />);

      const input = screen.getByRole("textbox");
      expect(input.className).toContain("h-8");
    });

    it("hides copy button in mini size", () => {
      const props: TextInputProps = {
        size: "mini",
      };

      render(<TextInputWrapper {...defaultProps} value="value" props={props} />);

      const buttons = screen.queryAllByRole("button");
      expect(buttons).toHaveLength(0);
    });

    it("shows copy button in normal size", () => {
      render(<TextInputWrapper {...defaultProps} value="value" />);

      const copyButton = screen.getByRole("button");
      expect(copyButton).toBeTruthy();
    });
  });

  describe("Width Prop", () => {
    it("applies width style when specified", () => {
      const props: TextInputProps = {
        width: "300px",
      };

      render(<TextInputWrapper {...defaultProps} props={props} />);

      const container = screen.getByRole("textbox").closest(".group") as HTMLElement;
      expect(container?.style.width).toBe("300px");
      expect(container?.className).toContain("flex-shrink-0");
    });

    it("does not apply width style when not specified", () => {
      render(<TextInputWrapper {...defaultProps} />);

      const container = screen.getByRole("textbox").closest(".group") as HTMLElement;
      expect(container?.style.width).toBeFalsy();
    });
  });

  describe("Prefix Label Styling", () => {
    it("applies prefixLabelSize when specified", () => {
      const props: TextInputProps = {
        prefixLabel    : "Label",
        prefixLabelSize: "100px",
      };

      render(<TextInputWrapper {...defaultProps} props={props} />);

      const prefixLabel = screen.getByText("Label").parentElement as HTMLElement;
      expect(prefixLabel.style.minWidth).toBe("100px");
    });

    it("does not apply prefixLabelSize in mini mode", () => {
      const props: TextInputProps = {
        prefixLabel    : "Label",
        prefixLabelSize: "100px",
        size           : "mini",
      };

      render(<TextInputWrapper {...defaultProps} props={props} />);

      const prefixLabel = screen.getByText("Label");
      expect(prefixLabel.style.minWidth).toBeFalsy();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "empty string", value: "" },
      { name: "simple text", value: "hello world" },
      { name: "text with spaces", value: "  spaces around  " },
      { name: "numeric string", value: "12345" },
      { name: "special characters", value: "!@#$%^&*()" },
      { name: "unicode characters", value: "こんにちはせかい🌍" },
      { name: "HTML entities", value: "<div>test</div>" },
      { name: "very long string", value: "a".repeat(500) },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

        render(<TextInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);

        expect(collectValueRef.current).toBeDefined();
        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders with different values", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      const rerenderCases = [
        "initial value",
        "updated value 1",
        "",
        "value with caractères spéciaux 🎉",
        "12345",
        "final value",
      ];

      const { rerender } = render(
        <TextInputWrapper {...defaultProps} value={rerenderCases[0]} collectValueRef={collectValueRef} />
      );

      // Verify initial value
      expect(collectValueRef.current?.getValue()).toBe(rerenderCases[0]);

      // Rerender multiple times with different values
      for (let i = 1; i < rerenderCases.length; i++) {
        rerender(
          <TextInputWrapper {...defaultProps} value={rerenderCases[i]} collectValueRef={collectValueRef} />
        );

        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toBe(rerenderCases[i]);
        });
      }
    });

    it("onChange and collectValueRef return same value after DOM input changes", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      const inputCases = [
        { action: "type", value: "hello", expected: "hello" },
        { action: "clear-and-type", value: "world", expected: "world" },
        { action: "type", value: " 123", expected: "world 123" },
        { action: "clear-and-type", value: "naïve façade 🎉", expected: "naïve façade 🎉" },
      ];

      render(
        <TextInputWrapper
          {...defaultProps}
          value=""
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;

      for (const { action, value, expected } of inputCases) {
        onChange.mockClear();

        if (action === "clear-and-type") {
          await user.clear(input);
          await user.type(input, value);
        } else {
          await user.type(input, value);
        }

        // Get the last onChange call's value
        const lastOnChangeCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        const onChangeValue = lastOnChangeCall ? lastOnChangeCall[1] : undefined;

        // Verify onChange was called with correct value
        expect(onChangeValue).toBe(expected);

        // Verify collectValueRef returns the same value
        expect(collectValueRef.current?.getValue()).toBe(expected);

        // Verify DOM input value matches
        expect(input.value).toBe(expected);
      }
    });

    it("in output mode, user input does not trigger onChange but collectValueRef still works", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      const testCases = [
        { initialValue: "readonly value 1", attemptInput: "try to change" },
        { initialValue: "output text 2", attemptInput: "another attempt" },
        { initialValue: "test value 🎉", attemptInput: "should not work" },
      ];

      for (const { initialValue, attemptInput } of testCases) {
        onChange.mockClear();

        const { unmount } = render(
          <TextInputWrapper
            {...defaultProps}
            mode="output"
            value={initialValue}
            onChange={onChange}
            collectValueRef={collectValueRef}
          />
        );

        const input = screen.getByRole("textbox") as HTMLInputElement;

        // Verify input is readonly
        expect(input.readOnly).toBe(true);

        // Verify collectValueRef can collect the value
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        // Try to type (should not work because readonly)
        await user.type(input, attemptInput);

        // Verify onChange was NOT called
        expect(onChange).not.toHaveBeenCalled();

        // Verify value remains unchanged
        expect(input.value).toBe(initialValue);

        // Verify collectValueRef still returns the original value
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        unmount();
      }
    });
  });

  describe("Edge Cases", () => {
    it("handles empty value", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      render(<TextInputWrapper {...defaultProps} value="" collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe("");
    });

    it("handles very long strings", async () => {
      const longString = "a".repeat(1000);

      render(<TextInputWrapper {...defaultProps} value={longString} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe(longString);
    });

    it("handles unicode characters", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextInputWrapper {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "こんにちは🌍");

      const input2 = screen.getByRole("textbox") as HTMLInputElement;
      expect(input2.value).toBe("こんにちは🌍");
    });

    it("handles special characters in value", () => {
      const specialValue = "<script>alert('xss')</script>";
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      render(<TextInputWrapper {...defaultProps} value={specialValue} collectValueRef={collectValueRef} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe(specialValue);
      expect(collectValueRef.current?.getValue()).toBe(specialValue);
    });

    it("handles undefined props gracefully", () => {
      render(<TextInputWrapper {...defaultProps} props={undefined} />);

      expect(screen.getByRole("textbox")).toBeTruthy();
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "placeholder",
        props : { placeholder: "Enter your text here" },
        verify: () => {
          const input = screen.getByPlaceholderText("Enter your text here");
          expect(input).toBeTruthy();
        },
      },
      {
        name  : "prefixLabel",
        props : { prefixLabel: "Prefix:" },
        verify: () => {
          const label = screen.getByText("Prefix:");
          expect(label).toBeTruthy();
        },
      },
      {
        name  : "prefixLabelSize",
        props : { prefixLabel: "Label", prefixLabelSize: "120px" },
        verify: () => {
          const prefixElement = screen.getByText("Label").parentElement as HTMLElement;
          expect(prefixElement.style.minWidth).toBe("120px");
        },
      },
      {
        name  : "size=normal",
        props : { size: "normal" as const },
        verify: () => {
          const input = screen.getByRole("textbox");
          expect(input.className).toContain("h-10");
        },
      },
      {
        name  : "size=mini",
        props : { size: "mini" as const },
        verify: () => {
          const input = screen.getByRole("textbox");
          expect(input.className).toContain("h-8");
          // Mini size should not show copy button
          const buttons = screen.queryAllByRole("button");
          expect(buttons).toHaveLength(0);
        },
      },
      {
        name  : "width",
        props : { width: "250px" },
        verify: () => {
          const container = screen.getByRole("textbox").closest(".group") as HTMLElement;
          expect(container.style.width).toBe("250px");
          expect(container.className).toContain("flex-shrink-0");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<TextInputWrapper {...defaultProps} value="test" props={props} />);
        verify();
      });
    });
  });
});
