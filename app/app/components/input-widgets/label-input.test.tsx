import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createRef, useEffect, type RefObject } from "react";
import { LabelInput, LabelInputProps, LabelInputOutputValue, LabelInputOutputValueResolver, LabelInputScriptValue } from "./label-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Inner component that calls the factory function within the context
function LabelInputInner({
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
  value          : LabelInputOutputValue;
  onChange       : (id: string, newValue: LabelInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;
  props?         : LabelInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{LabelInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

// Wrapper component to properly render LabelInput factory function
function LabelInputWrapper({
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
  value          : LabelInputOutputValue;
  onChange       : (id: string, newValue: LabelInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;
  props?         : LabelInputProps;
}) {
  return (
    <LabelInputInner
      id={id}
      title={title}
      mode={mode}
      value={value}
      onChange={onChange}
      collectValueRef={collectValueRef}
      props={props}
    />
  );
}

describe("LabelInput Component", () => {
  const defaultProps = {
    id             : "test-label",
    title          : "Test Label",
    mode           : "output" as const,
    value          : "<div>Default content</div>",
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: LabelInputProps = {
        content   : "<div>Test content</div>",
        align     : "center",
        tone      : "muted",
        autoHeight: true,
        maxHeight : "200px",
        width     : "300px",
      };

      const result = LabelInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const minimalProps = {};
      const result = LabelInputProps.parse(minimalProps);
      expect(result).toEqual({});
    });

    it("validates align enum values", () => {
      const validAligns = ["left", "center", "right"];
      validAligns.forEach((align) => {
        const result = LabelInputProps.parse({ align });
        expect(result.align).toBe(align);
      });
    });

    it("rejects invalid align values", () => {
      expect(() => {
        LabelInputProps.parse({ align: "invalid" });
      }).toThrow();
    });

    it("validates tone enum values", () => {
      const validTones = ["default", "muted"];
      validTones.forEach((tone) => {
        const result = LabelInputProps.parse({ tone });
        expect(result.tone).toBe(tone);
      });
    });

    it("rejects invalid tone values", () => {
      expect(() => {
        LabelInputProps.parse({ tone: "invalid" });
      }).toThrow();
    });

    it("accepts boolean for autoHeight", () => {
      const result1 = LabelInputProps.parse({ autoHeight: true });
      expect(result1.autoHeight).toBe(true);

      const result2 = LabelInputProps.parse({ autoHeight: false });
      expect(result2.autoHeight).toBe(false);
    });

    it("accepts both autoHeight and autoHight (typo compatibility)", () => {
      const result1 = LabelInputProps.parse({ autoHeight: true });
      expect(result1.autoHeight).toBe(true);

      const result2 = LabelInputProps.parse({ autoHight: false });
      expect(result2.autoHight).toBe(false);
    });
  });

  describe("Output Value Schema", () => {
    it("validates string output values", () => {
      const resolver = LabelInputOutputValueResolver();
      expect(resolver.parse("simple text")).toBe("simple text");
      expect(resolver.parse("")).toBe("");
      expect(resolver.parse("<div>HTML content</div>")).toBe("<div>HTML content</div>");
    });

    it("validates LabelInputScriptValue object", () => {
      const resolver = LabelInputOutputValueResolver();
      const scriptValue: LabelInputScriptValue = {
        innerHtml: "<div>Content</div>",
        afterHook: (container: HTMLElement) => { console.log("test"); },
      };

      const result = resolver.parse(scriptValue) as LabelInputScriptValue;
      expect(result.innerHtml).toEqual(scriptValue.innerHtml);
      expect(typeof result.afterHook).toBe("function");
    });

    it("validates minimal LabelInputScriptValue object", () => {
      const resolver = LabelInputOutputValueResolver();
      const minimalValue: LabelInputScriptValue = {
        innerHtml: "<div>Content</div>",
      };

      const result = resolver.parse(minimalValue);
      expect(result).toEqual(minimalValue);
    });

    it("rejects invalid values", () => {
      const resolver = LabelInputOutputValueResolver();
      expect(() => resolver.parse(123)).toThrow();
      expect(() => resolver.parse(null)).toThrow();
      expect(() => resolver.parse(undefined)).toThrow();
      expect(() => resolver.parse(true)).toThrow();
    });

    it("accepts object without innerHtml (innerHtml is optional)", () => {
      const resolver = LabelInputOutputValueResolver();
      // innerHtml is optional in LabelInputScriptValue, so object without it is valid
      const result = resolver.parse({});
      expect(result).toEqual({});
    });
  });

  describe("DOM Rendering", () => {
    it("renders label container with content", () => {
      render(<LabelInputWrapper {...defaultProps} value="<div>Test Content</div>" />);

      expect(screen.getByText("Test Content")).toBeTruthy();
    });

    it("renders title when provided", () => {
      const { container } = render(<LabelInputWrapper {...defaultProps} title="Label Title" />);
      const titleNode = screen.getByText("Label Title");
      // The title wrapper should only exist when the title is provided.
      expect(container.querySelector(".flex.justify-between")).toContain(titleNode);
    });

    it("does not render title wrapper when title is empty", () => {
      const { container } = render(<LabelInputWrapper {...defaultProps} title="" />);
      // Empty title should skip rendering the title wrapper.
      expect(container.querySelector(".flex.justify-between")).toBeNull();
    });

    it("renders with HTML content", () => {
      render(<LabelInputWrapper {...defaultProps} value="<strong>Bold</strong> and <em>italic</em>" />);

      const strong = screen.getByText("Bold");
      const em = screen.getByText("italic");
      expect(strong.tagName).toBe("STRONG");
      expect(em.tagName).toBe("EM");
    });

    it("renders with correct DOM structure", () => {
      const { container } = render(<LabelInputWrapper {...defaultProps} />);

      const groupDiv = container.querySelector(".group");
      expect(groupDiv).toBeTruthy();

      const contentDiv = groupDiv?.querySelector(".rounded-md.border");
      expect(contentDiv).toBeTruthy();
    });
  });

  describe("Value Collection with collectValueRef (data-* attributes)", () => {
    it("collects data-* attributes from elements with id", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;
      const htmlWithDataAttrs = "<div id=\"elem1\" data-value=\"123\" data-name=\"test\">Content</div>";

      render(<LabelInputWrapper {...defaultProps} value={htmlWithDataAttrs} collectValueRef={collectValueRef} />);

      const collected = collectValueRef.current?.getValue();
      // Format: { data: { elementId: { "data-xxx": "value" } } }
      expect(collected).toEqual({ data: { elem1: { "data-value": "123", "data-name": "test" } } });
    });

    it("skips elements without id", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;
      const htmlWithoutId = "<div data-value=\"123\">No ID</div>";

      render(<LabelInputWrapper {...defaultProps} value={htmlWithoutId} collectValueRef={collectValueRef} />);

      const collected = collectValueRef.current?.getValue();
      expect(collected).toEqual({ data: {} });
    });

    it("collects from multiple elements with ids", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;
      const htmlWithMultiple = "<div id=\"a\" data-x=\"1\"></div><div id=\"b\" data-y=\"2\"></div>";

      render(<LabelInputWrapper {...defaultProps} value={htmlWithMultiple} collectValueRef={collectValueRef} />);

      const collected = collectValueRef.current?.getValue();
      expect(collected).toEqual({ data: { a: { "data-x": "1" }, b: { "data-y": "2" } } });
    });

    it("returns empty data when no data-* attributes exist", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;
      const htmlNoData = "<div id=\"elem\">No data attrs</div>";

      render(<LabelInputWrapper {...defaultProps} value={htmlNoData} collectValueRef={collectValueRef} />);

      const collected = collectValueRef.current?.getValue();
      expect(collected).toEqual({ data: {} });
    });

    it("returns empty data for plain string content", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;

      render(<LabelInputWrapper {...defaultProps} value="Simple text" collectValueRef={collectValueRef} />);

      const collected = collectValueRef.current?.getValue();
      expect(collected).toEqual({ data: {} });
    });
  });

  describe("Value Synchronization", () => {
    it("updates displayed content when value prop changes", async () => {
      const { rerender } = render(<LabelInputWrapper {...defaultProps} value="<div>Initial</div>" />);

      expect(screen.getByText("Initial")).toBeTruthy();

      rerender(<LabelInputWrapper {...defaultProps} value="<div>Updated</div>" />);

      await waitFor(() => {
        expect(screen.getByText("Updated")).toBeTruthy();
      });
    });

    it("updates from string to script value object", async () => {
      const { rerender } = render(<LabelInputWrapper {...defaultProps} value="<div>String value</div>" />);

      expect(screen.getByText("String value")).toBeTruthy();

      const scriptValue: LabelInputScriptValue = {
        innerHtml: "<div>Script value</div>",
        afterHook: () => {},
      };

      rerender(<LabelInputWrapper {...defaultProps} value={scriptValue} />);

      await waitFor(() => {
        expect(screen.getByText("Script value")).toBeTruthy();
      });
    });

    it("does not call onChange on mount or value prop updates", async () => {
      const onChange = vi.fn();

      const { rerender } = render(<LabelInputWrapper {...defaultProps} value="<div>Initial</div>" onChange={onChange} />);

      expect(onChange).not.toHaveBeenCalled();

      rerender(<LabelInputWrapper {...defaultProps} value="<div>Updated</div>" onChange={onChange} />);

      await waitFor(() => {
        expect(screen.getByText("Updated")).toBeTruthy();
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Output Mode", () => {
    it("renders in output mode with correct styling", () => {
      const { container } = render(<LabelInputWrapper {...defaultProps} mode="output" />);

      const contentDiv = container.querySelector(".bg-muted\\/50");
      expect(contentDiv).toBeTruthy();
    });

    it("collectValueRef returns data structure in output mode", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;
      const testValue = "<div>Output content</div>";

      render(<LabelInputWrapper {...defaultProps} mode="output" value={testValue} collectValueRef={collectValueRef} />);

      // getValue returns { data: {} } structure, not the original value
      expect(collectValueRef.current?.getValue()).toEqual({ data: {} });
    });

    it("collectValueRef collects data attributes from content", () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;
      const testValue = "<div id=\"test-elem\" data-status=\"active\">Output content</div>";

      render(<LabelInputWrapper {...defaultProps} mode="output" value={testValue} collectValueRef={collectValueRef} />);

      // getValue returns collected data-* attributes
      expect(collectValueRef.current?.getValue()).toEqual({
        data: { "test-elem": { "data-status": "active" } },
      });
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "content",
        props : { content: "<div>Props content</div>" },
        value : undefined as any, // content prop only used as fallback when value is undefined
        verify: () => {
          expect(screen.getByText("Props content")).toBeTruthy();
        },
      },
      {
        name  : "align=center",
        props : { align: "center" as const },
        verify: () => {
          const content = screen.getByText(/Default content/i).parentElement;
          expect(content?.className).toContain("text-center");
        },
      },
      {
        name  : "align=right",
        props : { align: "right" as const },
        verify: () => {
          const content = screen.getByText(/Default content/i).parentElement;
          expect(content?.className).toContain("text-right");
        },
      },
      {
        name  : "align=left",
        props : { align: "left" as const },
        verify: () => {
          const content = screen.getByText(/Default content/i).parentElement;
          expect(content?.className).toContain("text-left");
        },
      },
      {
        name  : "tone=muted",
        props : { tone: "muted" as const },
        verify: () => {
          const content = screen.getByText(/Default content/i).parentElement;
          expect(content?.className).toContain("text-muted-foreground");
        },
      },
      {
        name  : "tone=default",
        props : { tone: "default" as const },
        verify: () => {
          const content = screen.getByText(/Default content/i).parentElement;
          expect(content?.className).not.toContain("text-muted-foreground");
        },
      },
      {
        name  : "autoHeight=true",
        props : { autoHeight: true },
        verify: () => {
          const container = screen.getByText(/Default content/i).closest(".rounded-md");
          expect(container?.className).toContain("min-h-10");
          expect(container?.className).toContain("h-auto");
        },
      },
      {
        name  : "autoHeight=false",
        props : { autoHeight: false },
        verify: () => {
          const container = screen.getByText(/Default content/i).closest(".rounded-md");
          expect(container?.className).toContain("h-10");
          expect(container?.className).not.toContain("h-auto");
        },
      },
      {
        name  : "maxHeight",
        props : { maxHeight: "150px" },
        verify: () => {
          const container = screen.getByText(/Default content/i).closest(".rounded-md") as HTMLElement;
          expect(container?.style.maxHeight).toBe("150px");
          expect(container?.className).toContain("overflow-auto");
        },
      },
      {
        name  : "width",
        props : { width: "400px" },
        verify: () => {
          const groupContainer = screen.getByText(/Default content/i).closest(".group") as HTMLElement;
          expect(groupContainer?.style.width).toBe("400px");
          expect(groupContainer?.className).toContain("flex-shrink-0");
        },
      },
    ];

    propsCases.forEach((testCase) => {
      it(`correctly applies ${testCase.name} prop`, () => {
        const testProps = { ...defaultProps, props: testCase.props };
        if ("value" in testCase) {
          testProps.value = testCase.value;
        }
        render(<LabelInputWrapper {...testProps} />);
        testCase.verify();
      });
    });
  });

  describe("AfterHook Execution", () => {
    it("renders content without afterHook", () => {
      const scriptValue: LabelInputScriptValue = {
        innerHtml: "<div>Content without hook</div>",
      };

      render(<LabelInputWrapper {...defaultProps} value={scriptValue} />);

      expect(screen.getByText("Content without hook")).toBeTruthy();
    });

    it("executes afterHook after HTML is rendered", async () => {
      const afterHookFn = vi.fn((container: HTMLElement) => {
        const target = container.querySelector("#hook-target");
        if (target) target.textContent = "Modified by afterHook";
      });

      const scriptValue: LabelInputScriptValue = {
        innerHtml: "<div id=\"hook-target\">Initial</div>",
        afterHook: afterHookFn,
      };

      render(<LabelInputWrapper {...defaultProps} value={scriptValue} />);

      await waitFor(() => {
        expect(afterHookFn).toHaveBeenCalled();
        expect(screen.getByText("Modified by afterHook")).toBeTruthy();
      });
    });

    it("afterHook receives container element as parameter", async () => {
      let capturedContainer: HTMLElement | null = null;

      const afterHookFn = vi.fn((container: HTMLElement) => {
        capturedContainer = container;
      });

      const scriptValue: LabelInputScriptValue = {
        innerHtml: "<div id=\"param-test\">Test</div>",
        afterHook: afterHookFn,
      };

      render(<LabelInputWrapper {...defaultProps} value={scriptValue} />);

      await waitFor(() => {
        expect(capturedContainer).toBeTruthy();
        expect(capturedContainer?.querySelector("#param-test")).toBeTruthy();
      });
    });

    it("afterHook is called on each render", async () => {
      const afterHookFn = vi.fn();

      const scriptValue: LabelInputScriptValue = {
        innerHtml: "<div>Hook test</div>",
        afterHook: afterHookFn,
      };

      const { rerender } = render(<LabelInputWrapper {...defaultProps} value={scriptValue} />);

      await waitFor(() => {
        expect(afterHookFn).toHaveBeenCalled();
      });

      const initialCallCount = afterHookFn.mock.calls.length;

      // Rerender with same value should call afterHook again
      rerender(<LabelInputWrapper {...defaultProps} value={scriptValue} />);

      await waitFor(() => {
        expect(afterHookFn.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("afterHook is called with new container when value changes", async () => {
      const afterHook1 = vi.fn();
      const afterHook2 = vi.fn();

      const scriptValue1: LabelInputScriptValue = {
        innerHtml: "<div>Script 1</div>",
        afterHook: afterHook1,
      };

      const scriptValue2: LabelInputScriptValue = {
        innerHtml: "<div>Script 2</div>",
        afterHook: afterHook2,
      };

      const { rerender } = render(<LabelInputWrapper {...defaultProps} value={scriptValue1} />);

      await waitFor(() => {
        expect(screen.getByText("Script 1")).toBeTruthy();
        expect(afterHook1).toHaveBeenCalled();
      });

      rerender(<LabelInputWrapper {...defaultProps} value={scriptValue2} />);

      await waitFor(() => {
        expect(screen.getByText("Script 2")).toBeTruthy();
        expect(afterHook2).toHaveBeenCalled();
      });
    });
  });

  describe("Fallback Behavior", () => {
    it("renders empty content when value is empty string", () => {
      const { container } = render(<LabelInputWrapper {...defaultProps} value="" props={{ content: "<div>Fallback content</div>" }} />);

      const contentDiv = container.querySelector(".rounded-md .text-sm");
      expect(contentDiv?.textContent).toBe("");
    });

    it("uses content prop as fallback when value is undefined", () => {
      render(
        <LabelInputWrapper
          {...defaultProps}
          value={undefined as any}
          props={{ content: "<div>Fallback from props</div>" }}
        />
      );

      expect(screen.getByText("Fallback from props")).toBeTruthy();
    });

    it("prefers value over content prop when both exist", () => {
      render(
        <LabelInputWrapper
          {...defaultProps}
          value="<div>Value content</div>"
          props={{ content: "<div>Props content</div>" }}
        />
      );

      expect(screen.getByText("Value content")).toBeTruthy();
      expect(screen.queryByText("Props content")).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty HTML content", () => {
      const { container } = render(<LabelInputWrapper {...defaultProps} value="" />);
      const contentBlock = container.querySelector(".rounded-md .text-sm");
      expect(contentBlock?.textContent).toBe("");
    });

    it("handles very long HTML content and renders correctly", () => {
      const longContent = "<div>" + "Long text ".repeat(1000) + "</div>";

      const { container } = render(<LabelInputWrapper {...defaultProps} value={longContent} />);

      // Verify long content is rendered (check that text is present)
      const contentBlock = container.querySelector(".rounded-md .text-sm");
      expect(contentBlock?.textContent).toContain("Long text");
    });

    it("collectValueRef returns data structure for long content", () => {
      const longContent = "<div id=\"long\" data-test=\"value\">" + "Long text ".repeat(100) + "</div>";
      const collectValueRef = createRef<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>() as RefObject<WidgetValueCollectorInf<LabelInputScriptValue> | undefined>;

      render(<LabelInputWrapper {...defaultProps} value={longContent} collectValueRef={collectValueRef} />);

      // getValue returns { data: {...} } structure
      expect(collectValueRef.current?.getValue()).toEqual({ data: { long: { "data-test": "value" } } });
    });

    it("handles nested HTML structures", () => {
      const nestedHtml = `
        <div>
          <ul>
            <li><strong>Item 1</strong></li>
            <li><em>Item 2</em></li>
          </ul>
        </div>
      `;

      render(<LabelInputWrapper {...defaultProps} value={nestedHtml} />);

      expect(screen.getByText("Item 1")).toBeTruthy();
      expect(screen.getByText("Item 2")).toBeTruthy();
    });

    it("renders readable text content for HTML value", () => {
      const { container } = render(<LabelInputWrapper {...defaultProps} value="<div><strong>Bold</strong> and <em>italic</em></div>" />);
      const contentBlock = container.querySelector(".rounded-md .text-sm");
      // HTML tags should not appear in textContent.
      expect(contentBlock?.textContent).toBe("Bold and italic");
    });

    it("handles script value without afterHook", () => {
      const scriptValue: LabelInputScriptValue = {
        innerHtml: "<div>No hook execution</div>",
      };

      render(<LabelInputWrapper {...defaultProps} value={scriptValue} />);

      expect(screen.getByText("No hook execution")).toBeTruthy();
    });
  });
});
