import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { ToggleInput, ToggleInputProps, ToggleInputOutputValueResolver } from "./toggle-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to render the ToggleInput factory function.
function ToggleInputWrapper({
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
  value?         : boolean;
  onChange       : (id: string, newValue: boolean) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<boolean> | undefined>;
  props?         : ToggleInputProps;
}) {
  useEffect(() => {
    if (value === undefined) return;
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{ToggleInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

describe("ToggleInput Component", () => {
  const defaultProps = {
    id             : "test-toggle",
    title          : "Realtime Sync",
    mode           : "input" as const,
    value          : false,
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<boolean> | undefined>() as RefObject<WidgetValueCollectorInf<boolean> | undefined>,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: ToggleInputProps = {
        defaultValue: true,
        onLabel     : "Active",
        description : "Enable live handler execution",
        width       : "240px",
      };

      const result = ToggleInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = ToggleInputProps.parse({});
      expect(result).toEqual({});
    });

    it("accepts boolean values for defaultValue", () => {
      const resultTrue = ToggleInputProps.parse({ defaultValue: true });
      const resultFalse = ToggleInputProps.parse({ defaultValue: false });
      expect(resultTrue.defaultValue).toBe(true);
      expect(resultFalse.defaultValue).toBe(false);
    });

    it("rejects invalid prop types", () => {
      expect(() => ToggleInputProps.parse({ defaultValue: "true" })).toThrow();
      expect(() => ToggleInputProps.parse({ onLabel: 123 })).toThrow();
      expect(() => ToggleInputProps.parse({ description: 456 })).toThrow();
      expect(() => ToggleInputProps.parse({ width: 789 })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates boolean output values", () => {
      const resolver = ToggleInputOutputValueResolver();
      expect(resolver.parse(true)).toBe(true);
      expect(resolver.parse(false)).toBe(false);
    });

    it("rejects non-boolean values", () => {
      const resolver = ToggleInputOutputValueResolver();
      expect(() => resolver.parse("true")).toThrow();
      expect(() => resolver.parse(1)).toThrow();
      expect(() => resolver.parse(null)).toThrow();
      expect(() => resolver.parse(undefined)).toThrow();
    });
  });

  describe("DOM Rendering", () => {
    it("renders label, description, and switch", () => {
      render(<ToggleInputWrapper {...defaultProps} props={{ description: "Helper text" }} />);
      expect(screen.getByText("Realtime Sync")).toBeTruthy();
      expect(screen.getByText("Helper text")).toBeTruthy();
      expect(screen.getByRole("switch")).toBeTruthy();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const cases = [
      { name: "checked", value: true },
      { name: "unchecked", value: false },
    ];

    cases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<boolean> | undefined>() as RefObject<WidgetValueCollectorInf<boolean> | undefined>;
        render(<ToggleInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);
        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after rerenders", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<boolean> | undefined>() as RefObject<WidgetValueCollectorInf<boolean> | undefined>;
      const { rerender } = render(<ToggleInputWrapper {...defaultProps} value={false} collectValueRef={collectValueRef} />);

      rerender(<ToggleInputWrapper {...defaultProps} value={true} collectValueRef={collectValueRef} />);
      await waitFor(() => { expect(collectValueRef.current?.getValue()).toBe(true); });

      rerender(<ToggleInputWrapper {...defaultProps} value={false} collectValueRef={collectValueRef} />);
      await waitFor(() => { expect(collectValueRef.current?.getValue()).toBe(false); });
    });
  });

  describe("User Interaction and Sync", () => {
    it("fires onChange and keeps collectValueRef in sync", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<boolean> | undefined>() as RefObject<WidgetValueCollectorInf<boolean> | undefined>;

      render(<ToggleInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);
      const switchEl = screen.getByRole("switch");

      await user.click(switchEl);
      expect(onChange).toHaveBeenCalledWith("test-toggle", true);
      await waitFor(() => { expect(collectValueRef.current?.getValue()).toBe(true); });

      await user.click(switchEl);
      expect(onChange).toHaveBeenLastCalledWith("test-toggle", false);
      await waitFor(() => { expect(collectValueRef.current?.getValue()).toBe(false); });


      await user.click(switchEl);
      expect(onChange).toHaveBeenLastCalledWith("test-toggle", true);
      await waitFor(() => { expect(collectValueRef.current?.getValue()).toBe(true); });
    });
  });

  describe("Output Mode Behavior", () => {
    it("prevents user changes but keeps collectValueRef working", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<boolean> | undefined>() as RefObject<WidgetValueCollectorInf<boolean> | undefined>;

      render(
        <ToggleInputWrapper
          {...defaultProps}
          mode="output"
          value={true}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const switchEl = screen.getByRole("switch");
      expect(switchEl.getAttribute("aria-readonly")).toBe("true");
      expect(switchEl.className.includes("pointer-events-none")).toBe(true);
      expect(collectValueRef.current?.getValue()).toBe(true);

      await user.click(switchEl);
      expect(onChange).not.toHaveBeenCalled();
      expect(collectValueRef.current?.getValue()).toBe(true);
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name : "defaultValue",
        props: { defaultValue: true },
        value: true,
        verify() {
          const switchEl = screen.getByRole("switch");
          expect(switchEl.getAttribute("aria-checked")).toBe("true");
        },
      },
      {
        name : "onLabel",
        props: { onLabel: "Active" },
        value: false,
        verify() {
          expect(screen.getByText("Active")).toBeTruthy();
        },
      },
      {
        name : "description",
        props: { description: "Toggle description" },
        value: false,
        verify() {
          expect(screen.getByText("Toggle description")).toBeTruthy();
        },
      },
      {
        name : "width",
        props: { width: "320px" },
        value: false,
        verify() {
          const container = screen.getByText("Realtime Sync").closest(".group") as HTMLElement;
          expect(container.style.width).toBe("320px");
        },
      },
    ];

    propsCases.forEach(({ name, props, value, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(<ToggleInputWrapper {...defaultProps} value={value} props={props} />);
        verify();
      });
    });
  });
});
