import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { createRef, useEffect, type RefObject } from "react";
import {
  DividerInput,
  DividerInputProps,
  DividerInputOutputValue,
  DividerInputOutputValueResolver,
} from "./divider-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to properly render DividerInput factory function
function DividerInputWrapper({
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
  value          : null;
  onChange       : (id: string, newValue: null) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<null> | undefined | null>;
  props?         : DividerInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{DividerInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

describe("DividerInput Component", () => {
  const defaultProps = {
    id             : "test-divider",
    title          : "Test Divider",
    mode           : "output" as const,
    value          : null as null,
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<null> | undefined | null>() as RefObject<
      WidgetValueCollectorInf<null> | undefined | null
    >,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: DividerInputProps = {
        label    : "Section Title",
        variant  : "dashed",
        hidden   : false,
        gap      : 8,
        gapBefore: 4,
        gapAfter : 4,
        width    : "100%",
      };

      const result = DividerInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const minimalProps = {};
      const result = DividerInputProps.parse(minimalProps);
      expect(result).toEqual({});
    });

    it("validates variant enum values", () => {
      const validVariants = ["solid", "dashed"];
      validVariants.forEach((variant) => {
        const result = DividerInputProps.parse({ variant });
        expect(result.variant).toBe(variant);
      });
    });

    it("rejects invalid variant values", () => {
      expect(() => {
        DividerInputProps.parse({ variant: "dotted" });
      }).toThrow();
    });

    it("accepts boolean for hidden", () => {
      const result1 = DividerInputProps.parse({ hidden: true });
      expect(result1.hidden).toBe(true);

      const result2 = DividerInputProps.parse({ hidden: false });
      expect(result2.hidden).toBe(false);
    });

    it("accepts number for gap properties", () => {
      const result = DividerInputProps.parse({
        gap      : 10,
        gapBefore: 5,
        gapAfter : 15,
      });
      expect(result.gap).toBe(10);
      expect(result.gapBefore).toBe(5);
      expect(result.gapAfter).toBe(15);
    });

    it("accepts string for width", () => {
      const result = DividerInputProps.parse({ width: "200px" });
      expect(result.width).toBe("200px");
    });
  });

  describe("Output Value Schema", () => {
    it("validates null output value", () => {
      const resolver = DividerInputOutputValueResolver();
      expect(resolver.parse(null)).toBe(null);
    });

    it("rejects non-null values", () => {
      const resolver = DividerInputOutputValueResolver();
      expect(() => resolver.parse("")).toThrow();
      expect(() => resolver.parse(0)).toThrow();
      expect(() => resolver.parse(undefined)).toThrow();
      expect(() => resolver.parse({})).toThrow();
      expect(() => resolver.parse(false)).toThrow();
    });

    it("validates DividerInputOutputValue directly", () => {
      expect(DividerInputOutputValue.parse(null)).toBe(null);
    });
  });

  describe("DOM Rendering", () => {
    it("renders divider element with correct structure", () => {
      render(<DividerInputWrapper {...defaultProps} />);

      const divider = screen.getByLabelText("Test Divider");
      expect(divider).toBeTruthy();
      expect(divider.className).toContain("h-10");
    });

    it("renders solid variant by default", () => {
      render(<DividerInputWrapper {...defaultProps} />);

      const divider = screen.getByLabelText("Test Divider");
      const line = divider.querySelector(".border-t");
      expect(line?.className).toContain("border-solid");
      expect(line?.className).not.toContain("border-dashed");
    });

    it("renders dashed variant when specified", () => {
      const props: DividerInputProps = { variant: "dashed" };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      const line = divider.querySelector(".border-t");
      expect(line?.className).toContain("border-dashed");
    });

    it("renders without label by default", () => {
      render(<DividerInputWrapper {...defaultProps} />);

      const divider = screen.getByLabelText("Test Divider");
      const lines = divider.querySelectorAll(".border-t");
      // Without label: single full-width line
      expect(lines).toHaveLength(1);
      expect(lines[0].className).toContain("w-full");
    });

    it("renders with label when specified", () => {
      const props: DividerInputProps = { label: "Section Title" };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const labelElement = screen.getByText("Section Title");
      expect(labelElement).toBeTruthy();

      const divider = screen.getByLabelText("Test Divider");
      const lines = divider.querySelectorAll(".border-t");
      // With label: two lines (left and right of label)
      expect(lines).toHaveLength(2);
      expect(lines[0].className).toContain("flex-1");
      expect(lines[1].className).toContain("flex-1");
    });

    it("renders label as HTML", () => {
      const props: DividerInputProps = { label: "<strong>Bold Label</strong>" };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const strong = screen.getByText("Bold Label");
      expect(strong.tagName).toBe("STRONG");
    });

    it("does not render label when it is only whitespace", () => {
      const props: DividerInputProps = { label: "   " };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      const lines = divider.querySelectorAll(".border-t");
      // Only whitespace label should be treated as no label
      expect(lines).toHaveLength(1);
      expect(lines[0].className).toContain("w-full");
    });

    it("applies hidden state correctly", () => {
      const props: DividerInputProps = { hidden: true };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      expect(divider.className).toContain("invisible");
      expect(divider.getAttribute("aria-hidden")).toBe("true");
    });

    it("does not apply hidden state when hidden is false", () => {
      const props: DividerInputProps = { hidden: false };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      expect(divider.className).not.toContain("invisible");
      expect(divider.getAttribute("aria-hidden")).toBe(null);
    });
  });

  describe("collectValueRef Interface", () => {
    it("exposes getValue through collectValueRef", () => {
      const collectValueRef = createRef<
        WidgetValueCollectorInf<null> | undefined | null
      >() as RefObject<WidgetValueCollectorInf<null> | undefined | null>;

      render(<DividerInputWrapper {...defaultProps} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current).toBeDefined();
      expect(collectValueRef.current?.getValue).toBeInstanceOf(Function);
      expect(collectValueRef.current?.getValue()).toBe(null);
    });

    it("getValue always returns null", () => {
      const collectValueRef = createRef<
        WidgetValueCollectorInf<null> | undefined | null
      >() as RefObject<WidgetValueCollectorInf<null> | undefined | null>;

      render(<DividerInputWrapper {...defaultProps} collectValueRef={collectValueRef} />);

      // Divider always returns null regardless of props
      expect(collectValueRef.current?.getValue()).toBe(null);
    });

    it("getValue returns null even with different props", () => {
      const collectValueRef = createRef<
        WidgetValueCollectorInf<null> | undefined | null
      >() as RefObject<WidgetValueCollectorInf<null> | undefined | null>;

      const props: DividerInputProps = {
        label  : "Test",
        variant: "dashed",
        hidden : true,
      };

      render(<DividerInputWrapper {...defaultProps} props={props} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current?.getValue()).toBe(null);
    });
  });

  describe("Value Collection with collectValueRef", () => {
    it("collects null value consistently", () => {
      const collectValueRef = createRef<
        WidgetValueCollectorInf<null> | undefined | null
      >() as RefObject<WidgetValueCollectorInf<null> | undefined | null>;

      render(<DividerInputWrapper {...defaultProps} collectValueRef={collectValueRef} />);

      expect(collectValueRef.current).toBeDefined();
      expect(collectValueRef.current?.getValue()).toBe(null);
    });

    it("collects null value after rerender", () => {
      const collectValueRef = createRef<
        WidgetValueCollectorInf<null> | undefined | null
      >() as RefObject<WidgetValueCollectorInf<null> | undefined | null>;

      const { rerender } = render(
        <DividerInputWrapper {...defaultProps} collectValueRef={collectValueRef} />
      );

      expect(collectValueRef.current?.getValue()).toBe(null);

      // Rerender with different props
      rerender(
        <DividerInputWrapper
          {...defaultProps}
          props={{ label: "Changed Label", variant: "dashed" }}
          collectValueRef={collectValueRef}
        />
      );

      // Value should still be null
      expect(collectValueRef.current?.getValue()).toBe(null);
    });

    it("collects null value in both input and output modes", () => {
      const collectValueRef1 = createRef<
        WidgetValueCollectorInf<null> | undefined | null
      >() as RefObject<WidgetValueCollectorInf<null> | undefined | null>;

      const collectValueRef2 = createRef<
        WidgetValueCollectorInf<null> | undefined | null
      >() as RefObject<WidgetValueCollectorInf<null> | undefined | null>;

      const { unmount: unmount1 } = render(
        <DividerInputWrapper {...defaultProps} mode="input" collectValueRef={collectValueRef1} />
      );

      expect(collectValueRef1.current?.getValue()).toBe(null);

      unmount1();

      render(
        <DividerInputWrapper {...defaultProps} mode="output" collectValueRef={collectValueRef2} />
      );

      expect(collectValueRef2.current?.getValue()).toBe(null);
    });
  });

  describe("Mode Rendering", () => {
    it("renders in input mode", () => {
      render(<DividerInputWrapper {...defaultProps} mode="input" />);

      const divider = screen.getByLabelText("Test Divider");
      expect(divider).toBeTruthy();
      expect(divider.className).not.toContain("opacity-90");
    });

    it("renders in output mode with opacity", () => {
      render(<DividerInputWrapper {...defaultProps} mode="output" />);

      const divider = screen.getByLabelText("Test Divider");
      expect(divider).toBeTruthy();
      expect(divider.className).toContain("opacity-90");
    });

    it("onChange is never called (no user interaction)", () => {
      const onChange = vi.fn();

      render(<DividerInputWrapper {...defaultProps} onChange={onChange} />);

      // Divider has no interactive elements, onChange should never be called
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Width Prop", () => {
    it("applies width style when specified", () => {
      const props: DividerInputProps = { width: "300px" };

      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const container = screen.getByLabelText("Test Divider").closest(".group") as HTMLElement;
      expect(container?.style.width).toBe("300px");
      expect(container?.className).toContain("flex-shrink-0");
    });

    it("does not apply width style when not specified", () => {
      render(<DividerInputWrapper {...defaultProps} />);

      const container = screen.getByLabelText("Test Divider").closest(".group") as HTMLElement;
      expect(container?.style.width).toBeFalsy();
    });

    it("supports various width formats", () => {
      const widthCases = ["50%", "200px", "10rem", "50vw"];

      widthCases.forEach((width) => {
        const { unmount } = render(
          <DividerInputWrapper {...defaultProps} props={{ width }} />
        );

        const container = screen.getByLabelText("Test Divider").closest(".group") as HTMLElement;
        expect(container?.style.width).toBe(width);

        unmount();
      });
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name  : "label",
        props : { label: "Section Title" },
        verify: () => {
          const label = screen.getByText("Section Title");
          expect(label).toBeTruthy();
          // Verify two lines when label is present
          const divider = screen.getByLabelText("Test Divider");
          const lines = divider.querySelectorAll(".border-t.flex-1");
          expect(lines).toHaveLength(2);
        },
      },
      {
        name  : "label with HTML",
        props : { label: "<em>Italic Label</em>" },
        verify: () => {
          const em = screen.getByText("Italic Label");
          expect(em.tagName).toBe("EM");
        },
      },
      {
        name  : "variant=solid",
        props : { variant: "solid" as const },
        verify: () => {
          const divider = screen.getByLabelText("Test Divider");
          const line = divider.querySelector(".border-t");
          expect(line?.className).toContain("border-solid");
          expect(line?.className).not.toContain("border-dashed");
        },
      },
      {
        name  : "variant=dashed",
        props : { variant: "dashed" as const },
        verify: () => {
          const divider = screen.getByLabelText("Test Divider");
          const line = divider.querySelector(".border-t");
          expect(line?.className).toContain("border-dashed");
        },
      },
      {
        name  : "hidden=true",
        props : { hidden: true },
        verify: () => {
          const divider = screen.getByLabelText("Test Divider");
          expect(divider.className).toContain("invisible");
          expect(divider.getAttribute("aria-hidden")).toBe("true");
        },
      },
      {
        name  : "hidden=false",
        props : { hidden: false },
        verify: () => {
          const divider = screen.getByLabelText("Test Divider");
          expect(divider.className).not.toContain("invisible");
          expect(divider.getAttribute("aria-hidden")).toBe(null);
        },
      },
      {
        name  : "width",
        props : { width: "250px" },
        verify: () => {
          const container = screen.getByLabelText("Test Divider").closest(".group") as HTMLElement;
          expect(container.style.width).toBe("250px");
          expect(container.className).toContain("flex-shrink-0");
        },
      },
      {
        name : "combined props",
        props: {
          label  : "Advanced Options",
          variant: "dashed" as const,
          hidden : false,
          width  : "100%",
        },
        verify: () => {
          const label = screen.getByText("Advanced Options");
          expect(label).toBeTruthy();

          const divider = screen.getByLabelText("Test Divider");
          const line = divider.querySelector(".border-t");
          expect(line?.className).toContain("border-dashed");
          expect(divider.className).not.toContain("invisible");

          const container = divider.closest(".group") as HTMLElement;
          expect(container.style.width).toBe("100%");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<DividerInputWrapper {...defaultProps} props={props} />);
        verify();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined props gracefully", () => {
      render(<DividerInputWrapper {...defaultProps} props={undefined} />);

      expect(screen.getByLabelText("Test Divider")).toBeTruthy();
    });

    it("handles empty label string", () => {
      const props: DividerInputProps = { label: "" };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      const lines = divider.querySelectorAll(".border-t");
      // Empty label should be treated as no label
      expect(lines).toHaveLength(1);
    });

    it("handles label with only HTML tags (no text)", () => {
      const props: DividerInputProps = { label: "<div></div>" };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      const lines = divider.querySelectorAll(".border-t");
      // HTML tags without text should be treated as no label
      expect(lines).toHaveLength(1);
    });

    it("handles label with only whitespace HTML", () => {
      const props: DividerInputProps = { label: "<span>   </span>" };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      const lines = divider.querySelectorAll(".border-t");
      // Whitespace in HTML should be treated as no label
      expect(lines).toHaveLength(1);
    });

    it("renders correctly with all default values", () => {
      const props: DividerInputProps = {};
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      expect(divider).toBeTruthy();

      // Check defaults: solid variant, not hidden, no label
      const line = divider.querySelector(".border-t");
      expect(line?.className).toContain("border-solid");
      expect(divider.className).not.toContain("invisible");
      expect(divider.querySelectorAll(".border-t")).toHaveLength(1);
    });

    it("handles very long label text", () => {
      const longLabel = "A".repeat(100);
      const props: DividerInputProps = { label: longLabel };

      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const labelElement = screen.getByText(longLabel);
      expect(labelElement).toBeTruthy();
      
      // whitespace-nowrap is on the parent span container
      const container = labelElement.closest("span.whitespace-nowrap");
      expect(container).toBeTruthy();
    });

    it("handles special characters in label", () => {
      const props: DividerInputProps = { label: "Section & Settings > Advanced" };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const label = screen.getByText("Section & Settings > Advanced");
      expect(label).toBeTruthy();
    });

    it("handles unicode characters in label", () => {
      const props: DividerInputProps = { label: "Divider 🎨 Section" };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const label = screen.getByText("Divider 🎨 Section");
      expect(label).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("has correct aria-label", () => {
      render(<DividerInputWrapper {...defaultProps} title="Custom Divider Title" />);

      const divider = screen.getByLabelText("Custom Divider Title");
      expect(divider).toBeTruthy();
    });

    it("sets aria-hidden when hidden prop is true", () => {
      const props: DividerInputProps = { hidden: true };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      expect(divider.getAttribute("aria-hidden")).toBe("true");
    });

    it("does not set aria-hidden when hidden prop is false", () => {
      const props: DividerInputProps = { hidden: false };
      render(<DividerInputWrapper {...defaultProps} props={props} />);

      const divider = screen.getByLabelText("Test Divider");
      expect(divider.getAttribute("aria-hidden")).toBe(null);
    });
  });
});
