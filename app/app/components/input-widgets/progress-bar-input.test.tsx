import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import {
  ProgressBarInput,
  ProgressBarInputProps,
  ProgressBarInputOutputValue,
  ProgressBarInputOutputValueResolver,
} from "./progress-bar-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to render the ProgressBarInput factory function.
function ProgressBarInputWrapper({
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
  value          : ProgressBarInputOutputValue;
  onChange       : (id: string, newValue: ProgressBarInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<ProgressBarInputOutputValue> | undefined | null>;
  props?         : ProgressBarInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{ProgressBarInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

// Create a collectValueRef instance with the shared widget value collector type.
function createCollectorRef() {
  return createRef<WidgetValueCollectorInf<ProgressBarInputOutputValue> | undefined | null>() as RefObject<
    WidgetValueCollectorInf<ProgressBarInputOutputValue> | undefined | null
  >;
}

describe("ProgressBarInput Component", () => {
  const defaultProps = {
    id             : "progress-bar",
    title          : "Build Progress",
    mode           : "input" as const,
    value          : {},
    onChange       : vi.fn(),
    collectValueRef: createCollectorRef(),
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: ProgressBarInputProps = {
        label       : "Progress",
        hint        : "Stage 1",
        color       : "#22c55e",
        defaultValue: 40,
        defaultTotal: 100,
        width       : "220px",
      };

      const result = ProgressBarInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = ProgressBarInputProps.parse({});
      expect(result).toEqual({});
    });

    it("rejects invalid numeric values", () => {
      expect(() => ProgressBarInputProps.parse({ defaultValue: "1" })).toThrow();
      expect(() => ProgressBarInputProps.parse({ defaultTotal: "2" })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates correct output values", () => {
      const resolver = ProgressBarInputOutputValueResolver();
      const validValue: ProgressBarInputOutputValue = {
        current: 12,
        total  : 30,
        percent: 40,
        label  : "Deploy",
        hint   : "CI",
      };

      expect(resolver.parse(validValue)).toEqual(validValue);
    });

    it("rejects invalid output values", () => {
      const resolver = ProgressBarInputOutputValueResolver();
      expect(() => resolver.parse({ current: "12" })).toThrow();
      expect(() => resolver.parse({ total: "30" })).toThrow();
      expect(() => resolver.parse({ percent: "40" })).toThrow();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const valueCases = [
      {
        name    : "empty value with defaults",
        value   : {},
        props   : { defaultValue: 10, defaultTotal: 50, label: "Sync", hint: "Job" },
        expected: { current: 10, total: 50, label: "Sync", hint: "Job" },
      },
      {
        name    : "partial value overrides defaults",
        value   : { current: 25 },
        props   : { defaultValue: 10, defaultTotal: 50, label: "Sync", hint: "Job" },
        expected: { current: 25, total: 50, label: "Sync", hint: "Job" },
      },
      {
        name    : "value uses custom labels",
        value   : { current: 5, total: 10, label: "Custom", hint: "Manual" },
        props   : { defaultValue: 1, defaultTotal: 2 },
        expected: { current: 5, total: 10, label: "Custom", hint: "Manual" },
      },
    ];

    valueCases.forEach(({ name, value, props, expected }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createCollectorRef();
        render(
          <ProgressBarInputWrapper
            {...defaultProps}
            value={value}
            props={props}
            collectValueRef={collectValueRef}
          />
        );

        expect(collectValueRef.current?.getValue()).toEqual(expected);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createCollectorRef();
      const { rerender } = render(
        <ProgressBarInputWrapper
          {...defaultProps}
          value={{ current: 1 }}
          props={{ defaultValue: 1, defaultTotal: 4 }}
          collectValueRef={collectValueRef}
        />
      );

      const nextValues: ProgressBarInputOutputValue[] = [
        { current: 2, total: 4 },
        { current: 3, total: 4, percent: 80 },
        { current: 4, total: 4, label: "Done" },
      ];

      for (const nextValue of nextValues) {
        rerender(
          <ProgressBarInputWrapper
            {...defaultProps}
            value={nextValue}
            props={{ defaultValue: 1, defaultTotal: 4 }}
            collectValueRef={collectValueRef}
          />
        );

        await waitFor(() => {
          const collected = collectValueRef.current?.getValue();
          expect(collected?.current).toBe(nextValue.current);
        });
      }
    });
  });

  describe("User Interaction and Value Sync", () => {
    it("does not call onChange when clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createCollectorRef();

      render(
        <ProgressBarInputWrapper
          {...defaultProps}
          onChange={onChange}
          collectValueRef={collectValueRef}
          value={{ current: 2, total: 5 }}
        />
      );

      const progressbar = screen.getByRole("progressbar");
      await user.click(progressbar);

      expect(onChange).not.toHaveBeenCalled();
      expect(collectValueRef.current?.getValue()).toEqual({ current: 2, total: 5 });
    });
  });

  describe("Output Mode", () => {
    it("sets aria-readonly and keeps value stable", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createCollectorRef();

      render(
        <ProgressBarInputWrapper
          {...defaultProps}
          mode="output"
          value={{ current: 7, total: 10, percent: 70 }}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const progressbar = screen.getByRole("progressbar");
      expect(progressbar.getAttribute("aria-readonly")).toBe("true");
      expect(collectValueRef.current?.getValue()).toEqual({ current: 7, total: 10, percent: 70 });

      await user.click(progressbar);
      expect(onChange).not.toHaveBeenCalled();
      expect(collectValueRef.current?.getValue()).toEqual({ current: 7, total: 10, percent: 70 });
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name : "label and hint",
        props: { label: "Sync progress", hint: "Server job" },
        verify() {
          expect(screen.getByText("Sync progress")).toBeTruthy();
          expect(screen.getByText("Server job")).toBeTruthy();
        },
      },
      {
        name : "width",
        props: { width: "240px" },
        verify() {
          const progressbar = screen.getByRole("progressbar");
          const container = progressbar.closest(".group") as HTMLElement | null;
          expect(container?.style.width).toBe("240px");
        },
      },
      {
        name : "color",
        props: { color: "rgb(34, 197, 94)" },
        verify() {
          const progressbar = screen.getByRole("progressbar");
          const bar = progressbar.querySelector("div") as HTMLElement | null;
          expect(bar?.style.backgroundColor).toBe("rgb(34, 197, 94)");
        },
      },
      {
        name : "default current and total",
        props: { defaultValue: 2, defaultTotal: 5 },
        verify() {
          expect(screen.getByText("2/5")).toBeTruthy();
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, () => {
        render(
          <ProgressBarInputWrapper
            {...defaultProps}
            props={props}
            value={{}}
          />
        );
        verify();
      });
    });
  });
});
