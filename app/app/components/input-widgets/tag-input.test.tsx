import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useEffect, type RefObject, useState } from "react";
import { TagInput, TagInputOutputValueResolver, TagInputProps } from "./tag-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Wrapper component to render TagInput factory function.
function TagInputWrapper({
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
  value          : string[];
  onChange       : (id: string, newValue: string[]) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<string[]> | undefined>;
  props?         : TagInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{TagInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

// Controlled wrapper to mimic parent state updates in user interaction tests.
function ControlledTagInput({
  id,
  title,
  mode,
  initialValue,
  onChange,
  collectValueRef,
  props,
}: {
  id             : string;
  title          : string;
  mode           : "input" | "output";
  initialValue   : string[];
  onChange       : (id: string, newValue: string[]) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<string[]> | undefined>;
  props?         : TagInputProps;
}) {
  const [value, setValue] = useState<string[]>(initialValue);

  function handleChange(nextId: string, nextValue: string[]) {
    setValue(nextValue);
    onChange(nextId, nextValue);
  }

  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{TagInput(id, title, mode, handleChange, collectValueRef, props)}</>;
}

describe("TagInput Component", () => {
  const defaultProps = {
    id             : "tag-input",
    title          : "Tag Input",
    mode           : "input" as const,
    value          : [] as string[],
    onChange       : vi.fn(),
    collectValueRef: createRef<WidgetValueCollectorInf<string[]> | undefined>() as RefObject<WidgetValueCollectorInf<string[]> | undefined>,
  };

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: TagInputProps = {
        defaultValue: ["alpha", "beta"],
        placeholder : "Add tag",
        maxTags     : 3,
        width       : "240px",
      };

      const result = TagInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = TagInputProps.parse({});
      expect(result).toEqual({});
    });
  });

  describe("Output Value Schema", () => {
    it("validates array output values", () => {
      const resolver = TagInputOutputValueResolver();
      expect(resolver.parse([])).toEqual([]);
      expect(resolver.parse(["alpha"])).toEqual(["alpha"]);
    });

    it("rejects invalid output values", () => {
      const resolver = TagInputOutputValueResolver();
      expect(() => resolver.parse("alpha")).toThrow();
      expect(() => resolver.parse(12)).toThrow();
      expect(() => resolver.parse([1, 2])).toThrow();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const cases = [
      { name: "empty list", value: [] as string[] },
      { name: "single tag", value: ["alpha"] },
      { name: "multiple tags", value: ["alpha", "beta"] },
      { name: "special chars", value: ["<script>"] },
    ];

    cases.forEach(({ name, value }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createRef<WidgetValueCollectorInf<string[]> | undefined>() as RefObject<WidgetValueCollectorInf<string[]> | undefined>;
        render(<TagInputWrapper {...defaultProps} value={value} collectValueRef={collectValueRef} />);
        expect(collectValueRef.current?.getValue()).toEqual(value);
      });
    });
  });

  describe("Value Collection after rerender", () => {
    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createRef<WidgetValueCollectorInf<string[]> | undefined>() as RefObject<WidgetValueCollectorInf<string[]> | undefined>;
      const values = [["alpha"], ["beta", "gamma"], []];

      const { rerender } = render(
        <TagInputWrapper {...defaultProps} value={values[0]} collectValueRef={collectValueRef} />
      );

      for (let index = 1; index < values.length; index += 1) {
        rerender(<TagInputWrapper {...defaultProps} value={values[index]} collectValueRef={collectValueRef} />);
        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toEqual(values[index]);
        });
      }
    });
  });

  describe("User Interaction", () => {
    it("adds tag on Enter and syncs onChange with collectValueRef", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string[]> | undefined>() as RefObject<WidgetValueCollectorInf<string[]> | undefined>;

      render(
        <ControlledTagInput
          id={defaultProps.id}
          title={defaultProps.title}
          mode={defaultProps.mode}
          initialValue={[]}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      const input = screen.getByRole("textbox");
      await user.type(input, "alpha{enter}");

      expect(onChange).toHaveBeenCalledWith("tag-input", ["alpha"]);
      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toEqual(["alpha"]);
      });
      expect(screen.getByText("alpha")).toBeTruthy();
    });

    it("removes tag when clicking remove button", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string[]> | undefined>() as RefObject<WidgetValueCollectorInf<string[]> | undefined>;

      render(
        <ControlledTagInput
          id={defaultProps.id}
          title={defaultProps.title}
          mode={defaultProps.mode}
          initialValue={["alpha", "beta"]}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      await user.click(screen.getByLabelText("Remove alpha"));

      expect(onChange).toHaveBeenCalledWith("tag-input", ["beta"]);
      await waitFor(() => {
        expect(collectValueRef.current?.getValue()).toEqual(["beta"]);
      });
    });
  });

  describe("Output Mode", () => {
    it("renders without input and keeps value stable", () => {
      const onChange = vi.fn();
      const collectValueRef = createRef<WidgetValueCollectorInf<string[]> | undefined>() as RefObject<WidgetValueCollectorInf<string[]> | undefined>;

      render(
        <TagInputWrapper
          {...defaultProps}
          mode="output"
          value={["alpha"]}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      expect(screen.queryByRole("textbox")).toBeNull();
      expect(screen.queryByLabelText("Remove alpha")).toBeNull();
      expect(collectValueRef.current?.getValue()).toEqual(["alpha"]);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("Props Application Verification", () => {
    it("applies placeholder text", () => {
      render(<TagInputWrapper {...defaultProps} props={{ placeholder: "Type tag" }} />);
      expect(screen.getByPlaceholderText("Type tag")).toBeTruthy();
    });

    it("applies maxTags limit by hiding the input", () => {
      render(<TagInputWrapper {...defaultProps} value={["alpha"]} props={{ maxTags: 1 }} />);
      expect(screen.queryByRole("textbox")).toBeNull();
    });

    it("applies width on container", () => {
      render(<TagInputWrapper {...defaultProps} props={{ width: "200px" }} />);
      const container = screen.getByText("Tag Input").closest(".group") as HTMLElement;
      expect(container.style.width).toBe("200px");
    });
  });
});
