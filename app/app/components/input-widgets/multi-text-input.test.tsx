import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject } from "react";
import {
  MultiTextInput,
  MultiTextInputOutputValueResolver,
  MultiTextInputProps,
  type MultiTextInputOutputValue,
} from "./multi-text-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to render the MultiTextInput factory function.
function MultiTextInputWrapper({
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
  value          : MultiTextInputOutputValue;
  onChange       : (id: string, newValue: MultiTextInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>;
  props?         : MultiTextInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{MultiTextInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

// Find the stack container that owns the rowGap style.
function findStackWithRowGap(container: HTMLElement) {
  const stacks = Array.from(container.querySelectorAll("div.flex.flex-col")) as HTMLElement[];
  return stacks.find((element) => element.style.rowGap) ?? null;
}

describe("MultiTextInput Component", () => {
  const baseItems = [
    {
      id             : "host",
      title          : "Host",
      placeholder    : "db.internal",
      defaultValue   : "localhost",
      prefixLabel    : "Host",
      prefixLabelSize: "5em",
      description    : "Database host",
    },
    {
      id             : "port",
      title          : "Port",
      placeholder    : "5432",
      defaultValue   : "5432",
      prefixLabel    : "Port",
      prefixLabelSize: "5em",
      description    : "Database port",
    },
  ];

  const baseWidgetProps: MultiTextInputProps = {
    items: baseItems,
  };

  const defaultProps = {
    id             : "multi-text-input",
    title          : "Multi Text",
    mode           : "input" as const,
    value          : {},
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>,
    props          : baseWidgetProps,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: MultiTextInputProps = {
        items: [
          {
            id             : "user",
            title          : "User",
            placeholder    : "name",
            defaultValue   : "admin",
            prefixLabel    : "User",
            prefixLabelSize: "6em",
            description    : "Database user",
          },
        ],
        gap  : "8px",
        width: "320px",
      };

      const result = MultiTextInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = MultiTextInputProps.parse({});
      expect(result).toEqual({});
    });

    it("rejects empty items array", () => {
      expect(() => {
        MultiTextInputProps.parse({ items: [] });
      }).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates record output values", () => {
      const resolver = MultiTextInputOutputValueResolver();
      expect(resolver.parse({})).toEqual({});
      expect(resolver.parse({ host: "db", port: undefined })).toEqual({ host: "db", port: undefined });
    });

    it("rejects invalid record output values", () => {
      const resolver = MultiTextInputOutputValueResolver();
      expect(() => resolver.parse({ host: 123 })).toThrow();
    });

    it("uses item-based resolver when widget props are provided", () => {
      const resolver = MultiTextInputOutputValueResolver({
        props: {
          items: [
            { id: "host", title: "Host" },
            { id: "port", title: "Port" },
          ],
        },
      });

      expect(resolver.parse({ host: "db", port: "5432" })).toEqual({ host: "db", port: "5432" });
      expect(() => resolver.parse({ host: "db" })).toThrow();
      expect(() => resolver.parse({ host: "db", port: 5432 })).toThrow();
    });
  });

  describe("DOM Rendering", () => {
    it("renders a textbox for each item", () => {
      render(<MultiTextInputWrapper {...defaultProps} />);
      const inputs = screen.getAllByRole("textbox");
      expect(inputs).toHaveLength(baseItems.length);
    });

    it("renders the title label pointing to the first input", () => {
      render(<MultiTextInputWrapper {...defaultProps} title="<strong>Config</strong>" />);
      const label = screen.getByText("Config").closest("label");
      expect(label?.getAttribute("for")).toBe("multi-text-input-host");
    });

    it("renders item labels, placeholders, and prefix labels", () => {
      render(<MultiTextInputWrapper {...defaultProps} />);
      expect(screen.getAllByText("Host").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Port").length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText("db.internal")).toBeTruthy();
      expect(screen.getByPlaceholderText("5432")).toBeTruthy();
    });
  });

  describe("collectValueRef Interface", () => {
    const cases = [
      {
        name    : "empty value",
        value   : {},
        expected: { host: "localhost", port: "5432" },
      },
      {
        name    : "partial value",
        value   : { host: "db" },
        expected: { host: "db", port: "5432" },
      },
      {
        name    : "full value",
        value   : { host: "db", port: "1111" },
        expected: { host: "db", port: "1111" },
      },
    ];

    cases.forEach(({ name, value, expected }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>;

        render(
          <MultiTextInputWrapper
            {...defaultProps}
            value={value}
            collectValueRef={collectValueRef}
          />
        );

        expect(collectValueRef.current?.getValue()).toEqual(expected);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>;
      const values = [
        { host: "one", port: "1000" },
        { host: "two", port: "2000" },
        { host: "", port: "3000" },
      ];

      const { rerender } = render(
        <MultiTextInputWrapper {...defaultProps} value={values[0]} collectValueRef={collectValueRef} />
      );

      expect(collectValueRef.current?.getValue()).toEqual(values[0]);

      for (let i = 1; i < values.length; i++) {
        rerender(
          <MultiTextInputWrapper {...defaultProps} value={values[i]} collectValueRef={collectValueRef} />
        );

        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toEqual(values[i]);
        });
      }
    });
  });

  describe("User Interaction", () => {
    it("calls onChange and updates collectValueRef on input", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>;

      render(
        <MultiTextInputWrapper
          {...defaultProps}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
      await user.clear(inputs[0]);
      await user.type(inputs[0], "db");

      const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
      expect(lastCall[0]).toBe("multi-text-input");
      expect(lastCall[1]).toEqual({ host: "db", port: "5432" });
      expect(collectValueRef.current?.getValue()).toEqual({ host: "db", port: "5432" });
      expect(inputs[0].value).toBe("db");
    });
  });

  describe("Output Mode", () => {
    it("renders inputs as read-only and blocks onChange", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>() as RefObject<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>;
      const readonlyValue = { host: "readonly", port: "9000" };

      render(
        <MultiTextInputWrapper
          {...defaultProps}
          mode="output"
          value={readonlyValue}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
      inputs.forEach((input) => {
        expect(input.readOnly).toBe(true);
        expect(input.getAttribute("aria-readonly")).toBe("true");
      });

      await user.type(inputs[0], "try");
      expect(onChange).not.toHaveBeenCalled();
      expect(collectValueRef.current?.getValue()).toEqual(readonlyValue);
    });
  });

  describe("Props Application Verification", () => {
    it("applies items prop and renders descriptions", () => {
      render(<MultiTextInputWrapper {...defaultProps} />);
      expect(screen.getByText("Database host")).toBeTruthy();
      expect(screen.getByText("Database port")).toBeTruthy();
    });

    it("applies gap prop to the stack container", () => {
      const { container } = render(
        <MultiTextInputWrapper {...defaultProps} props={{ ...baseWidgetProps, gap: "12px" }} />
      );
      const stack = findStackWithRowGap(container);
      expect(stack?.style.rowGap).toBe("12px");
    });

    it("applies width prop to the wrapper", () => {
      render(<MultiTextInputWrapper {...defaultProps} props={{ ...baseWidgetProps, width: "280px" }} />);
      const wrapper = screen.getAllByRole("textbox")[0].closest(".group") as HTMLElement;
      expect(wrapper?.style.width).toBe("280px");
      expect(wrapper?.className).toContain("flex-shrink-0");
    });
  });
});
