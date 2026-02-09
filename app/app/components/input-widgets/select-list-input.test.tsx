import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import { SelectListInput, SelectListInputOutputValueResolver, SelectListInputProps } from "./select-list-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to render the SelectListInput factory function.
function SelectListInputWrapper({
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
  props?         : SelectListInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{SelectListInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

// Create a typed collector ref for consistent test usage.
function createCollectorRef<T>() {
  return createRef<WidgetValueCollectorInf<T> | undefined>() as RefObject<WidgetValueCollectorInf<T> | undefined>;
}

// Open the select dropdown for interaction tests.
async function openSelect(user: ReturnType<typeof userEvent.setup>) {
  const trigger = screen.getByRole("combobox");
  await user.click(trigger);
}

describe("SelectListInput Component", () => {
  const options = [
    { value: "recent", label: "Recent" },
    { value: "archived", label: "Archived" },
    { value: "shared", label: "Shared" },
  ];

  const defaultProps = {
    id             : "test-select",
    title          : "Dataset",
    mode           : "input" as const,
    value          : undefined,
    onChange       : vi.fn(),
    collectValueRef: createCollectorRef<string | undefined>(),
    props          : { options, placeholder: "Pick dataset" },
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: SelectListInputProps = {
        options,
        defaultValue: "recent",
        placeholder : "Pick dataset",
        width       : "240px",
      };

      const result = SelectListInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = SelectListInputProps.parse({});
      expect(result).toEqual({});
    });

    it("rejects invalid prop types", () => {
      expect(() => SelectListInputProps.parse({ options: "bad" })).toThrow();
      expect(() => SelectListInputProps.parse({ placeholder: 123 })).toThrow();
      expect(() => SelectListInputProps.parse({ defaultValue: 456 })).toThrow();
      expect(() => SelectListInputProps.parse({ width: 789 })).toThrow();
      expect(() => SelectListInputProps.parse({ options: [{ label: 1, value: "a" }] })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates output values against options enum when provided", () => {
      const resolver = SelectListInputOutputValueResolver({ props: { options } });
      expect(resolver.parse("recent")).toBe("recent");
      expect(resolver.parse("archived")).toBe("archived");
      expect(() => resolver.parse("missing")).toThrow();
    });

    it("falls back to optional string when no options exist", () => {
      const resolver = SelectListInputOutputValueResolver();
      expect(resolver.parse("custom")).toBe("custom");
      expect(resolver.parse(undefined)).toBe(undefined);
      expect(() => resolver.parse(123)).toThrow();
    });
  });

  describe("DOM Rendering", () => {
    it("renders label and select trigger", () => {
      render(<SelectListInputWrapper {...defaultProps} />);
      expect(screen.getByText("Dataset")).toBeTruthy();
      expect(screen.getByRole("combobox")).toBeTruthy();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const cases = [
      { name: "empty value", value: undefined },
      { name: "normal text", value: "recent" },
      { name: "special chars", value: "<tag>" },
      { name: "unicode", value: "hello-世界" },
      { name: "long string", value: "a".repeat(256) },
    ];

    cases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createCollectorRef<string | undefined>();
        render(<SelectListInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);
        expect(collectValueRef.current?.getValue()).toBe(value);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createCollectorRef<string | undefined>();
      const values = ["recent", "archived", "shared", undefined];

      const { rerender } = render(<SelectListInputWrapper {...defaultProps} value={values[0]} collectValueRef={collectValueRef} />);

      for (let i = 1; i < values.length; i++) {
        rerender(<SelectListInputWrapper {...defaultProps} value={values[i]} collectValueRef={collectValueRef} />);
        await waitFor(() => { expect(collectValueRef.current?.getValue()).toBe(values[i]); });
      }
    });
  });

  describe("User Interaction and Sync", () => {
    it("fires onChange and keeps collectValueRef in sync after selection", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createCollectorRef<string | undefined>();

      render(<SelectListInputWrapper {...defaultProps} onChange={onChange} collectValueRef={collectValueRef} />);

      await openSelect(user);
      const option = await screen.findByRole("option", { name: "Archived" });
      await user.click(option);

      expect(onChange).toHaveBeenCalledWith("test-select", "archived");
      await waitFor(() => { expect(collectValueRef.current?.getValue()).toBe("archived"); });
    });
  });

  describe("Output Mode Behavior", () => {
    it("prevents user changes but keeps collectValueRef working", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      const testCases = [
        { initialValue: "recent", attempt: "Archived" },
        { initialValue: "archived", attempt: "Recent" },
      ];

      for (const { initialValue, attempt } of testCases) {
        onChange.mockClear();
        const collectValueRef = createCollectorRef<string | undefined>();

        const { unmount } = render(
          <SelectListInputWrapper
            {...defaultProps}
            mode="output"
            value={initialValue}
            onChange={onChange}
            collectValueRef={collectValueRef}
          />
        );

        const trigger = screen.getByRole("combobox");
        expect(trigger.getAttribute("aria-readonly")).toBe("true");
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        await openSelect(user);
        const option = await screen.findByRole("option", { name: attempt });
        await user.click(option);

        expect(onChange).not.toHaveBeenCalled();
        expect(collectValueRef.current?.getValue()).toBe(initialValue);

        unmount();
      }
    });
  });

  describe("Props Application Verification", () => {
    const propsCases = [
      {
        name : "placeholder",
        props: { placeholder: "Pick a dataset now" },
        verify() {
          expect(screen.getByText("Pick a dataset now")).toBeTruthy();
        },
      },
      {
        name : "options",
        props: { options },
        async verify(user: ReturnType<typeof userEvent.setup>) {
          await openSelect(user);
          expect(screen.getByRole("option", { name: "Recent" })).toBeTruthy();
          expect(screen.getByRole("option", { name: "Archived" })).toBeTruthy();
          expect(screen.getByRole("option", { name: "Shared" })).toBeTruthy();
        },
      },
      {
        name : "width",
        props: { width: "220px" },
        verify() {
          const container = screen.getByText("Dataset").closest(".group") as HTMLElement;
          expect(container.style.width).toBe("220px");
          expect(container.className).toContain("flex-shrink-0");
        },
      },
    ];

    propsCases.forEach(({ name, props, verify }) => {
      it(`correctly applies ${name} prop`, async () => {
        const user = userEvent.setup();
        render(<SelectListInputWrapper {...defaultProps} props={props} />);
        await verify(user);
      });
    });
  });
});
