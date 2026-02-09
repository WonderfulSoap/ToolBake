import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { type RefObject, type ReactNode, useEffect, useState } from "react";
import {
  SortableListInput,
  SortableListInputProps,
  SortableListInputOutputValueResolver,
  type SortableListInputOutputValue,
} from "./sortable-list-input";
import type { WidgetValueCollectorInf } from "./input-types";

// Mock DnD kit so we can trigger drag callbacks deterministically in tests.
const dndHandlers: {
  onDragEnd?   : (event: { active: { id: string }; over: { id: string } | null }) => void;
  onDragStart? : (event: { active: { id: string } }) => void;
  onDragCancel?: () => void;
} = {};

vi.mock("@dnd-kit/core", () => ({
  DndContext: function DndContext(props: {
    children     : ReactNode;
    onDragEnd?   : (event: { active: { id: string }; over: { id: string } | null }) => void;
    onDragStart? : (event: { active: { id: string } }) => void;
    onDragCancel?: () => void;
  }) {
    dndHandlers.onDragEnd = props.onDragEnd;
    dndHandlers.onDragStart = props.onDragStart;
    dndHandlers.onDragCancel = props.onDragCancel;
    return <div data-testid="dnd-context">{props.children}</div>;
  },
  PointerSensor: class PointerSensor {},
  closestCenter: vi.fn(),
  useSensor    : vi.fn(() => ({})),
  useSensors   : vi.fn(() => []),
  useDraggable : vi.fn(() => ({
    attributes: {},
    listeners : {},
    setNodeRef: vi.fn(),
    transform : null,
    isDragging: false,
  })),
  useDroppable: vi.fn(() => ({
    setNodeRef: vi.fn(),
    isOver    : false,
  })),
}));

// Wrapper component to render the SortableListInput factory function.
function SortableListInputWrapper({
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
  value          : SortableListInputOutputValue;
  onChange       : (id: string, newValue: SortableListInputOutputValue) => void;
  collectValueRef: RefObject<WidgetValueCollectorInf<SortableListInputOutputValue> | undefined>;
  props?         : SortableListInputProps;
}) {
  useEffect(() => {
    collectValueRef.current?.setValue?.(value);
  }, [collectValueRef, value]);
  return <>{SortableListInput(id, title, mode, onChange, collectValueRef, props)}</>;
}

function createCollectorRef() {
  // Keep a plain ref object so the current value can start as undefined.
  return { current: undefined } as RefObject<WidgetValueCollectorInf<SortableListInputOutputValue> | undefined>;
}

describe("SortableListInput Component", () => {
  const defaultProps = {
    id             : "test-sortable",
    title          : "Sortable Title",
    mode           : "input" as const,
    value          : ["plan", "draft", "review"] as SortableListInputOutputValue,
    onChange       : vi.fn(),
    collectValueRef: createCollectorRef(),
    props          : {
      options: [
        { value: "plan", label: "Planning" },
        { value: "draft", label: "Draft" },
        { value: "review", label: "Review" },
      ],
    } satisfies SortableListInputProps,
  };

  beforeEach(function () {
    // Reset handlers and mock calls so tests stay isolated.
    dndHandlers.onDragEnd = undefined;
    dndHandlers.onDragStart = undefined;
    dndHandlers.onDragCancel = undefined;
    defaultProps.onChange.mockClear();
  });

  describe("Props Schema Validation", () => {
    it("parses valid props correctly", () => {
      const validProps: SortableListInputProps = {
        options     : [{ label: "Alpha", value: "alpha" }],
        defaultValue: [{ value: "alpha", label: "Alpha" }],
        placeholder : "No items",
        width       : "320px",
      };

      const result = SortableListInputProps.parse(validProps);
      expect(result).toEqual(validProps);
    });

    it("parses props with optional fields omitted", () => {
      const result = SortableListInputProps.parse({});
      expect(result).toEqual({});
    });

    it("rejects invalid option types", () => {
      expect(() => SortableListInputProps.parse({ options: [{ value: 123, label: "Bad" }] })).toThrow();
      expect(() => SortableListInputProps.parse({ width: 100 })).toThrow();
    });
  });

  describe("Output Value Schema", () => {
    it("validates correct output values", () => {
      const resolver = SortableListInputOutputValueResolver();
      expect(resolver.parse(["alpha", "beta"])).toEqual(["alpha", "beta"]);
      expect(resolver.parse([{ value: "alpha", label: "Alpha" }])).toEqual([
        { value: "alpha", label: "Alpha" },
      ]);
    });

    it("rejects invalid output values", () => {
      const resolver = SortableListInputOutputValueResolver();
      expect(() => resolver.parse([123])).toThrow();
      expect(() => resolver.parse([{ label: "Missing value" }])).toThrow();
    });
  });

  describe("Value Collection with collectValueRef", () => {
    const cases: Array<{ name: string; value: SortableListInputOutputValue; expected?: SortableListInputOutputValue }> = [
      {
        name    : "empty list",
        value   : [],
        expected: [
          { value: "plan", label: "Planning" },
          { value: "draft", label: "Draft" },
          { value: "review", label: "Review" },
        ],
      },
      { name: "simple strings", value: ["alpha", "beta"] },
      { name: "objects with labels", value: [{ value: "alpha", label: "Alpha" }] },
      { name: "special characters", value: ["value-with-dash", "value_with_underscore"] },
    ];

    cases.forEach(({ name, value, expected }) => {
      it(`collects correct value for ${name}`, () => {
        const collectValueRef = createCollectorRef();
        render(
          <SortableListInputWrapper
            {...defaultProps}
            value={value}
            collectValueRef={collectValueRef}
          />
        );
        expect(collectValueRef.current?.getValue()).toEqual(expected ?? value);
      });
    });

    it("collects correct value after multiple rerenders", async () => {
      const collectValueRef = createCollectorRef();
      const values: SortableListInputOutputValue[] = [
        ["first", "second"],
        ["second", "first"],
        [{ value: "third", label: "Third" }],
      ];

      const { rerender } = render(
        <SortableListInputWrapper {...defaultProps} value={values[0]} collectValueRef={collectValueRef} />
      );

      for (let index = 1; index < values.length; index += 1) {
        rerender(
          <SortableListInputWrapper {...defaultProps} value={values[index]} collectValueRef={collectValueRef} />
        );
        await waitFor(() => {
          expect(collectValueRef.current?.getValue()).toEqual(values[index]);
        });
      }
    });
  });

  describe("User Interaction and Value Sync", () => {
    it("calls onChange and updates collectValueRef after drag reorder", async () => {
      const onChange = vi.fn();
      const collectValueRef = createCollectorRef();

      // Use a stateful wrapper so the component stays controlled after onChange.
      function ControlledSortableListInput() {
        const [controlledValue, setControlledValue] = useState<SortableListInputOutputValue>(defaultProps.value);
        return (
          <SortableListInputWrapper
            {...defaultProps}
            value={controlledValue}
            onChange={(changedId, nextValue) => {
              onChange(changedId, nextValue);
              setControlledValue(nextValue);
            }}
            collectValueRef={collectValueRef}
          />
        );
      }

      render(<ControlledSortableListInput />);

      // Simulate drag end to move "plan" after "review".
      act(() => {
        dndHandlers.onDragEnd?.({ active: { id: "plan" }, over: { id: "review" } });
      });

      // Reordering normalizes list items to entry objects.
      const expected = [{ value: "draft" }, { value: "review" }, { value: "plan" }];
      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith("test-sortable", expected);
        expect(collectValueRef.current?.getValue()).toEqual(expected);
      });
    });
  });

  describe("Output Mode Behavior", () => {
    it("prevents drag updates but keeps collectValueRef working", () => {
      const onChange = vi.fn();
      const collectValueRef = createCollectorRef();
      const readonlyValue = ["one", "two"];

      render(
        <SortableListInputWrapper
          {...defaultProps}
          mode="output"
          value={readonlyValue}
          onChange={onChange}
          collectValueRef={collectValueRef}
        />
      );

      act(() => {
        dndHandlers.onDragEnd?.({ active: { id: "one" }, over: { id: "two" } });
      });
      expect(onChange).not.toHaveBeenCalled();
      expect(collectValueRef.current?.getValue()).toEqual(readonlyValue);
    });
  });

  describe("Props Application Verification", () => {
    it("renders placeholder when list is empty", () => {
      render(
        <SortableListInputWrapper
          {...defaultProps}
          value={[]}
          props={{ placeholder: "Nothing here" }}
        />
      );
      expect(screen.getByText("Nothing here")).toBeTruthy();
    });

    it("applies width prop on the container", () => {
      render(
        <SortableListInputWrapper
          {...defaultProps}
          props={{ width: "240px" }}
        />
      );
      const label = screen.getByText("Sortable Title");
      const container = label.closest(".group") as HTMLElement;
      expect(container.style.width).toBe("240px");
    });
  });
});
