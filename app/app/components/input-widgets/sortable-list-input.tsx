import { useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent, type DragStartEvent, type DragCancelEvent } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { z } from "zod";
import { cn } from "~/lib/utils";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import { SafeHtml } from "./common-components/safe-html";
import type { WidgetValueCollectorInf } from "./input-types";

export const SortableListInputItem = z.union([z.string(), z.object({ value: z.string(), label: z.string().optional() })]);
export const SortableListInputProps = z.object({
  options     : z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  defaultValue: z.array(SortableListInputItem).optional(),
  placeholder : z.string().optional(),
  width       : z.string().optional(),
});
export type SortableListInputProps = z.infer<typeof SortableListInputProps>;
export const SortableListInputOutputValue = z.array(SortableListInputItem);
export type SortableListInputOutputValue = Array<string | { value: string; label?: string }>;

export function SortableListInputOutputValueResolver(widget?: Record<string, unknown>): z.ZodTypeAny {
  return SortableListInputOutputValue;
}

export const SortableListInputUsageExample: WidgetGuideItem = {
  name       : "Sortable List",
  description: "Drag to reorder items; handler can return strings or `{value,label}[]` to build the list.",
  widget     : {
    id   : "guide-sortable-list",
    type : "SortableListInput",
    title: "Steps",
    mode : "input",
    props: {
      placeholder: "Add list options to enable drag handles.",
      options    : [
        { value: "plan", label: "Planning" },
        { value: "draft", label: "Draft" },
        { value: "review", label: "Review" },
      ],
    },
  },
};

function toEntry(item: string | { value: string; label?: string }) {
  if (typeof item === "string") return { value: item, label: undefined };
  if (item && typeof item.value === "string") return { value: item.value, label: item.label };
  return { value: "", label: undefined };
}

// Normalize both props and handler-returned payloads so the list can be rebuilt dynamically.
function buildEntries(items: SortableListInputOutputValue | SortableListInputProps["options"]) {
  if (!items) return [];
  return items.map((item) => {
    if (typeof item === "string") return { value: item, label: undefined };
    return { value: item.value, label: item.label };
  });
}

function reorderEntries(list: Array<{ value: string; label?: string }>, from: number, to: number) {
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

function areListsEqual(
  left: SortableListInputOutputValue | undefined,
  right: SortableListInputOutputValue | undefined
) {
  const leftList = left ?? [];
  const rightList = right ?? [];
  if (leftList.length !== rightList.length) return false;
  return leftList.every((item, index) => {
    const leftItem = toEntry(item);
    const rightItem = toEntry(rightList[index] as SortableListInputOutputValue[number]);
    return leftItem.value === rightItem.value && leftItem.label === rightItem.label;
  });
}

// Use one element as both draggable and droppable to keep the surface compact.
function SortableItem({
  id,
  label,
  disabled,
  isActive,
}: {
  id      : string;
  label   : string;
  disabled: boolean;
  isActive: boolean;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id, disabled });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, disabled });
  const setRefs = (node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setRefs}
      style={style}
      className={cn(
        "flex h-10 items-center justify-between rounded-md border border-border bg-card/70 px-3 text-sm transition-colors",
        (isDragging || isActive) && "border-primary shadow-sm",
        isOver && "bg-primary/5",
        disabled && "cursor-not-allowed opacity-70"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground transition-colors",
            !disabled && "cursor-grab active:cursor-grabbing"
          )}
          aria-label={`Drag ${label}`}
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm text-foreground">{label}</span>
      </div>
    </div>
  );
}

export function SortableListInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: SortableListInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<SortableListInputOutputValue> | undefined>,
  props?: SortableListInputProps
) {
  // Keep the list controlled via value/onChange and expose the latest value to the collector.
  const { options = [], placeholder = "No items available", width, defaultValue } = SortableListInputProps.parse(props ?? {});
  // Options-based fallback for display when value is not yet set
  const optionsEntries = useMemo(() => buildEntries(options), [options]);
  // Initial value is empty array, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<SortableListInputOutputValue>([]);
  const widgetValueRef = useRef<SortableListInputOutputValue>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const isOutputMode = mode === "output";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  // Expose current value to the tool collector.
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => widgetValueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: SortableListInputOutputValue) => {
      const nextValue = newValue && newValue.length > 0 ? newValue : optionsEntries;
      if (areListsEqual(widgetValueRef.current, nextValue)) return;
      widgetValueRef.current = nextValue;
      setWidgetValue(nextValue);
    },
  }), [optionsEntries]);

  const resolvedEntries = widgetValue && widgetValue.length > 0 ? widgetValue.map(toEntry) : optionsEntries;
  const orderedValues = resolvedEntries.map((item) => item.value);
  const labelMap = useMemo(() => {
    const map = new Map<string, string>();
    options.forEach((item) => map.set(item.value, item.label));
    resolvedEntries.forEach((item) => {
      if (!map.has(item.value) && item.value) map.set(item.value, item.label ?? item.value);
    });
    return map;
  }, [options, resolvedEntries]);

  const disableDrag = isOutputMode || orderedValues.length < 2;

  function handleDragStart(event: DragStartEvent) {
    if (disableDrag) return;
    setActiveId(String(event.active.id));
  }

  // Skip state writes when drag is disabled or no real position change happened.
  function handleDragEnd(event: DragEndEvent) {
    if (disableDrag) return;
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIndex = orderedValues.indexOf(String(active.id));
    const newIndex = orderedValues.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const nextOrder = reorderEntries(resolvedEntries, oldIndex, newIndex);
    setWidgetValue(nextOrder);
    widgetValueRef.current = nextOrder;
    onChange(id, nextOrder);
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveId(null);
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
          <SafeHtml html={title} />
        </label>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="space-y-2">
          {orderedValues.length === 0 && (
            <p className="h-10 rounded-md border border-dashed border-border/70 bg-muted/40 px-3 text-sm text-muted-foreground flex items-center">
              {placeholder}
            </p>
          )}
          {orderedValues.map((itemValue) => (
            <SortableItem
              key={itemValue}
              id={itemValue}
              label={labelMap.get(itemValue) ?? itemValue}
              disabled={disableDrag}
              isActive={activeId === itemValue}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
