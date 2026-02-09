import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { TextareaInput, TextareaInputProps, TextareaInputOutputValueResolver } from "./textarea-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to properly render TextareaInput factory function
function TextareaInputWrapper({
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
  props?         : TextareaInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{TextareaInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

describe("TextareaInput Component", () => {
  const defaultProps = {
    id             : "test-textarea",
    title          : "Test Textarea",
    mode           : "input" as const,
    value          : "",
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: TextareaInputProps = {
        placeholder : "Enter text",
        defaultValue: "default value",
        rows        : 10,
        className   : "custom-class",
        width       : "500px",
        highlight   : "javascript",
      };

      const result = TextareaInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const minimalProps = {};
      const result = TextareaInputProps.parse(minimalProps);
      expect(result).toEqual({});
    });

    it("accepts numeric rows value", () => {
      const result = TextareaInputProps.parse({ rows: 5 });
      expect(result.rows).toBe(5);
    });

    it("accepts highlight language strings", () => {
      const languages = ["javascript", "python", "highlight:typescript", ""];
      languages.forEach((lang) => {
        const result = TextareaInputProps.parse({ highlight: lang });
        expect(result.highlight).toBe(lang);
      });
    });
  });

  describe("Output Value Schema", () => {
    it("validates string output values", () => {
      const resolver = TextareaInputOutputValueResolver();
      expect(resolver.parse("test")).toBe("test");
      expect(resolver.parse("")).toBe("");
      expect(resolver.parse("multiline\ntext")).toBe("multiline\ntext");
      expect(resolver.parse("const x = 123;")).toBe("const x = 123;");
    });

    it("rejects non-string values", () => {
      const resolver = TextareaInputOutputValueResolver();
      expect(() => resolver.parse(123)).toThrow();
      expect(() => resolver.parse(null)).toThrow();
      expect(() => resolver.parse(undefined)).toThrow();
      expect(() => resolver.parse({})).toThrow();
    });
  });

  describe("DOM Rendering", () => {
    it("renders textarea element with correct attributes", () => {
      render(<TextareaInputWrapper {...defaultProps} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();
      expect(textarea.tagName).toBe("TEXTAREA");
    });

    it("renders with initial value", () => {
      render(<TextareaInputWrapper {...defaultProps} value="initial value" />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("initial value");
    });

    it("renders with placeholder", () => {
      const props: TextareaInputProps = { placeholder: "Enter text here" };
      render(<TextareaInputWrapper {...defaultProps} props={props} />);

      expect(screen.getByPlaceholderText("Enter text here")).toBeTruthy();
    });

    it("renders with custom rows", () => {
      const props: TextareaInputProps = { rows: 12 };
      render(<TextareaInputWrapper {...defaultProps} props={props} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.rows).toBe(12);
    });

    it("renders with default rows=7 when not specified", () => {
      render(<TextareaInputWrapper {...defaultProps} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.rows).toBe(7);
    });

    it("renders title as HTML", () => {
      render(<TextareaInputWrapper {...defaultProps} title="<strong>Bold Title</strong>" />);

      const strong = screen.getByText("Bold Title");
      expect(strong.tagName).toBe("STRONG");
    });

    it("renders label element with correct htmlFor", () => {
      render(<TextareaInputWrapper {...defaultProps} />);

      const labelContainer = screen.getByText("Test Textarea").closest("label");
      expect(labelContainer).toBeTruthy();
      const textarea = screen.getByRole("textbox");
      expect(labelContainer?.getAttribute("for")).toBe(textarea.id);
    });

    it("renders copy button", () => {
      render(<TextareaInputWrapper {...defaultProps} value="text to copy" />);

      const copyButton = screen.getByRole("button", { name: /copy/i });
      expect(copyButton).toBeTruthy();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const testCases = [
      { name: "empty value", value: "" },
      { name: "normal text", value: "hello world" },
      { name: "multiline text", value: "line 1\nline 2\nline 3" },
      { name: "unicode characters", value: "你好世界 こんにちは世界 🌍🚀" },
      { name: "special chars", value: "<script>alert('xss')</script>" },
      { name: "code snippet", value: "const x = 123;\nfunction fn() { return x; }" },
      { name: "tabs and spaces", value: "\t\tindented\n    spaces" },
      { name: "very long text", value: "a".repeat(1000) },
    ];

    testCases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;
        render(<TextareaInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);

        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;
      const values = ["value1", "value2\nmultiline", "value3 with symbols!@#"];

      const { rerender } = render(<TextareaInputWrapper {...defaultProps} value={values[0]} collectValueRef={collectValueRef} />);

      for (let i = 1; i < values.length; i++) {
        rerender(<TextareaInputWrapper {...defaultProps} value={values[i]} collectValueRef={collectValueRef} />);
        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toBe(values[i]);
        });
      }
    });

    it("getValue returns DOM value when user has typed but onChange not yet processed", async () => {
      const user = userEvent.setup();
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      render(<TextareaInputWrapper {...defaultProps} collectValueRef={collectValueRef} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      await user.type(textarea, "typed text");

      // getValue should return the DOM value
      expect(collectValueRef.current?.getValue()).toBe("typed text");
      expect(textarea.value).toBe("typed text");
    });
  });

  describe("User Interaction", () => {
    it("calls onChange when user types", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextareaInputWrapper {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "hello");

      // onChange is called for each character
      expect(onChange).toHaveBeenCalledTimes(5);
      expect(onChange).toHaveBeenNthCalledWith(1, "test-textarea", "h");
      expect(onChange).toHaveBeenNthCalledWith(2, "test-textarea", "he");
      expect(onChange).toHaveBeenNthCalledWith(3, "test-textarea", "hel");
      expect(onChange).toHaveBeenNthCalledWith(4, "test-textarea", "hell");
      expect(onChange).toHaveBeenNthCalledWith(5, "test-textarea", "hello");
    });

    it("updates displayed value immediately on user input", async () => {
      const user = userEvent.setup();

      render(<TextareaInputWrapper {...defaultProps} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      await user.type(textarea, "test text");

      expect(textarea.value).toBe("test text");
    });

    it("handles multiline input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextareaInputWrapper {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      await user.type(textarea, "line 1{Enter}line 2");

      expect(textarea.value).toBe("line 1\nline 2");
      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[1]).toBe("line 1\nline 2");
    });

    it("handles clear and retype", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextareaInputWrapper {...defaultProps} value="initial" onChange={onChange} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      await user.clear(textarea);
      await user.type(textarea, "new text");

      expect(textarea.value).toBe("new text");
      expect(onChange).toHaveBeenCalledWith("test-textarea", "new text");
    });

    it("handles paste event", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextareaInputWrapper {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      await user.click(textarea);
      await user.paste("pasted\nmultiline\ntext");

      expect(textarea.value).toBe("pasted\nmultiline\ntext");
      expect(onChange).toHaveBeenCalledWith("test-textarea", "pasted\nmultiline\ntext");
    });

    it("handles special characters input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TextareaInputWrapper {...defaultProps} onChange={onChange} />);

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "<script>");

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[1]).toBe("<script>");
    });

    it("onChange and collectValueRef return same value after user input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      const inputCases = [
        { action: "type", value: "hello", expected: "hello" },
        { action: "clear-and-type", value: "world", expected: "world" },
        { action: "clear-and-type", value: "multi\nline", expected: "multi\nline" },
      ];

      render(<TextareaInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

      for (const { action, value, expected } of inputCases) {
        onChange.mockClear();

        if (action === "clear-and-type") {
          await user.clear(textarea);
          await user.type(textarea, value);
        } else {
          await user.type(textarea, value);
        }

        const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
        expect(lastCall[1]).toBe(expected);
        expect(collectValueRef.current?.getValue()).toBe(expected);
        expect(textarea.value).toBe(expected);
      }
    });
  });

  describe("Value Synchronization", () => {
    it("updates internal state when value prop changes", async () => {
      const { rerender } = render(<TextareaInputWrapper {...defaultProps} value="initial" />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("initial");

      // Parent passes new value
      rerender(<TextareaInputWrapper {...defaultProps} value="updated from parent" />);

      await waitFor(() => {
        expect(textarea.value).toBe("updated from parent");
      });
    });

    it("does not call onChange when value prop updates from parent", async () => {
      const onChange = vi.fn();
      const { rerender } = render(<TextareaInputWrapper {...defaultProps} value="initial" onChange={onChange} />);

      onChange.mockClear();

      // Parent updates value
      rerender(<TextareaInputWrapper {...defaultProps} value="new value" onChange={onChange} />);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
        expect(textarea.value).toBe("new value");
      });

      // onChange should not be called on parent update
      expect(onChange).not.toHaveBeenCalled();
    });

    it("syncs collectValueRef after external value change", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;
      const { rerender } = render(<TextareaInputWrapper {...defaultProps} value="v1" collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe("v1");

      rerender(<TextareaInputWrapper {...defaultProps} value="v2 changed" collectValueRef={collectValueRef} />);

      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toBe("v2 changed");
      });
    });
  });

  describe("Output Mode", () => {
    it("renders as readonly in output mode", () => {
      render(<TextareaInputWrapper {...defaultProps} mode="output" value="readonly text" />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.readOnly).toBe(true);
      expect(textarea.getAttribute("aria-readonly")).toBe("true");
    });

    it("in output mode, user input does not trigger onChange but collectValueRef works", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;

      const testCases = [
        { initialValue: "readonly1", attemptInput: "try to change" },
        { initialValue: "readonly2\nmultiline", attemptInput: "another try" },
      ];

      for (const { initialValue, attemptInput } of testCases) {
        onChange.mockClear();

        const { unmount } = render(
          <TextareaInputWrapper {...defaultProps} mode="output" value={initialValue} onChange={onChange} collectValueRef={collectValueRef} />
        );

        const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

        // Verify readonly state
        expect(textarea.readOnly).toBe(true);

        // Verify collectValueRef can collect value
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        // Attempt to type (will be blocked by readonly)
        await user.type(textarea, attemptInput);

        // onChange should not be called
        expect(onChange).not.toHaveBeenCalled();

        // Value should not change
        expect(collectValueRef.current?.getValue()).toBe(initialValue);
        expect(textarea.value).toBe(initialValue);

        unmount();
      }
    });

    it("displays value correctly in output mode", () => {
      const outputValue = "Output mode\nMultiline text";
      render(<TextareaInputWrapper {...defaultProps} mode="output" value={outputValue} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe(outputValue);
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "placeholder",
        props : { placeholder: "Enter your code here" },
        verify: () => {
          expect(screen.getByPlaceholderText("Enter your code here")).toBeTruthy();
        },
      },
      {
        name  : "rows",
        props : { rows: 15 },
        verify: () => {
          const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
          expect(textarea.rows).toBe(15);
        },
      },
      {
        name  : "width",
        props : { width: "600px" },
        verify: () => {
          const container = screen.getByRole("textbox").closest(".group") as HTMLElement;
          expect(container.style.width).toBe("600px");
        },
      },
      {
        name  : "className",
        props : { className: "custom-textarea-class" },
        verify: () => {
          const textarea = screen.getByRole("textbox");
          expect(textarea.className).toContain("custom-textarea-class");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<TextareaInputWrapper {...defaultProps} props={props} />);
        verify();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles empty string value", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;
      render(<TextareaInputWrapper {...defaultProps} value="" collectValueRef={collectValueRef} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("");
      expect(collectValueRef.current?.getValue()).toBe("");
    });

    it("handles very long text", () => {
      const longText = "a".repeat(5000);
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;
      render(<TextareaInputWrapper {...defaultProps} value={longText} collectValueRef={collectValueRef} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe(longText);
      expect(collectValueRef.current?.getValue()).toBe(longText);
    });

    it("handles text with mixed line endings (normalized by browser)", () => {
      // Browser normalizes \r\n and \r to \n in textarea
      const mixedText = "line1\r\nline2\nline3\rline4";
      const normalized = "line1\nline2\nline3\nline4";
      render(<TextareaInputWrapper {...defaultProps} value={mixedText} />);

      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe(normalized);
    });

    it("handles consecutive spaces and tabs", () => {
      const spacedText = "  multiple  spaces\t\ttabs";
      const collectValueRef = createRef<WidgetValueCollectorInf<string> | undefined>() as RefObject<WidgetValueCollectorInf<string> | undefined>;
      render(<TextareaInputWrapper {...defaultProps} value={spacedText} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe(spacedText);
    });
  });

  describe("Accessibility", () => {
    it("has correct ARIA attributes", () => {
      render(<TextareaInputWrapper {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeTruthy();
    });

    it("has correct ARIA readonly in output mode", () => {
      render(<TextareaInputWrapper {...defaultProps} mode="output" />);

      const textarea = screen.getByRole("textbox");
      expect(textarea.getAttribute("aria-readonly")).toBe("true");
    });

    it("label is associated with textarea via htmlFor", () => {
      render(<TextareaInputWrapper {...defaultProps} />);

      const textarea = screen.getByRole("textbox");
      const label = screen.getByText("Test Textarea").closest("label");

      expect(label?.getAttribute("for")).toBe(textarea.id);
    });
  });

  describe("Syntax Highlighting Props", () => {
    it("accepts highlight prop without throwing", () => {
      const props: TextareaInputProps = { highlight: "javascript" };
      expect(() => {
        render(<TextareaInputWrapper {...defaultProps} props={props} />);
      }).not.toThrow();
    });

    it("accepts highlight with prefix syntax", () => {
      const props: TextareaInputProps = { highlight: "highlight:typescript" };
      expect(() => {
        render(<TextareaInputWrapper {...defaultProps} props={props} />);
      }).not.toThrow();
    });

    it("handles empty highlight prop", () => {
      const props: TextareaInputProps = { highlight: "" };
      expect(() => {
        render(<TextareaInputWrapper {...defaultProps} props={props} />);
      }).not.toThrow();
    });

    // Note: Full syntax highlighting functionality requires async Shiki loading
    // which is tested in integration tests rather than unit tests
  });
});
