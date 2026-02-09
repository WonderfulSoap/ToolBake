import { useImperativeHandle, useMemo, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { z } from "zod";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { CopyButton } from "./common-components/copy-button";
import { SafeHtml, stripHtmlToText } from "./common-components/safe-html";
import type { WidgetValueCollectorInf } from "./input-types";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";

const MultiTextInputItemSchema = z.object({
  id             : z.string(),
  title          : z.string(),
  placeholder    : z.string().optional(),
  defaultValue   : z.string().optional(),
  prefixLabel    : z.string().optional(),
  prefixLabelSize: z.string().optional(),
  description    : z.string().optional(),
});

export const MultiTextInputProps = z.object({
  items: z.array(MultiTextInputItemSchema).min(1).optional(),
  gap  : z.string().optional(),
  width: z.string().optional(),
});
export type MultiTextInputProps = z.infer<typeof MultiTextInputProps>;

export const MultiTextInputOutputValue = z.record(z.string(), z.union([z.string(), z.undefined()]));
export type MultiTextInputOutputValue = z.infer<typeof MultiTextInputOutputValue>;

export function MultiTextInputOutputValueResolver(widget?: Record<string, unknown>): z.ZodTypeAny {
  if (widget?.props) {
    const props = widget.props as Record<string, unknown>;
    const items = props.items;
    if (Array.isArray(items) && items.length > 0) {
      const shape: Record<string, z.ZodTypeAny> = {};
      items.forEach((item) => {
        if (isRecord(item) && typeof item.id === "string") {
          shape[item.id] = z.string();
        }
      });
      const keys = Object.keys(shape);
      if (keys.length > 0) {
        return z.object(shape);
      }
    }
  }
  return MultiTextInputOutputValue;
}

function buildDefaultValue(items?: MultiTextInputProps["items"]) {
  return (items ?? []).reduce<Record<string, string>>((acc, item) => {
    acc[item.id] = item.defaultValue ?? "";
    return acc;
  }, {});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isZeroGapValue(value: string) {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) && numeric === 0;
}

function buildNormalizedValue(
  storedValue: unknown,
  defaultValues: Record<string, string>
): Record<string, string> {
  const base = { ...defaultValues };
  if (isRecord(storedValue)) {
    Object.entries(storedValue).forEach(([key, value]) => {
      if (typeof value === "string") base[key] = value;
      else if (typeof value === "number") base[key] = String(value);
      else if (value == null) base[key] = "";
      else base[key] = String(value);
    });
  }
  return base;
}

export const MultiTextInputUsageExample: WidgetGuideItem = {
  name       : "Multi Text Input",
  description: "Stacks several text inputs and returns a nested payload keyed by field ids.",
  widget     : {
    id   : "guide-multi-text-input",
    type : "MultiTextInput",
    title: "",
    mode : "input",
    props: {
      gap  : "0",
      items: [
        { id: "host", title: "", placeholder: "db.internal.local", prefixLabel: "Host", prefixLabelSize: "5em" },
        { id: "port", title: "", prefixLabel: "Port", prefixLabelSize: "5em", defaultValue: "5432" },
        { id: "username", title: "", defaultValue: "service-account", prefixLabel: "User", prefixLabelSize: "5em" },
      ],
    },
  },
};


// Render a stacked set of text inputs and emit a record keyed by item ids.
export function MultiTextInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: MultiTextInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<MultiTextInputOutputValue> | undefined>,
  props?: MultiTextInputProps
) {
  const { items, gap, width } = MultiTextInputProps.parse(props ?? {});
  // Props-based defaults for normalization when setValue is called
  const propsDefaults = useMemo(() => buildDefaultValue(items), [items]);
  // Initial value is empty object, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<MultiTextInputOutputValue>({});
  // Use ref to keep the latest value for getValue().
  const valueRef = useRef<MultiTextInputOutputValue>({});

  const isOutputMode = mode === "output";
  const stackGap = typeof gap === "string" && gap.trim().length > 0 ? gap : "0px";
  const isMergedStack = isZeroGapValue(stackGap);

  useImperativeHandle(collectValueRef, () => ({
    getValue: () => valueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: MultiTextInputOutputValue) => {
      const normalized = buildNormalizedValue(newValue, propsDefaults);
      valueRef.current = normalized;
      setWidgetValue(normalized);
    },
  }), [propsDefaults]);

  function handleChange(itemId: string, event: ChangeEvent<HTMLInputElement>) {
    const nextValue = { ...valueRef.current, [itemId]: event.target.value };
    valueRef.current = nextValue;
    setWidgetValue(nextValue);
    onChange(id, nextValue);
  }

  const firstItemId = items?.[0]?.id;
  const firstInputId = firstItemId ? `${id}-${firstItemId}` : undefined;

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label
          htmlFor={firstInputId}
          className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
        >
          <SafeHtml html={title} />
        </label>
      </div>
      <div className="flex flex-col" style={isMergedStack ? undefined : { rowGap: stackGap }}>
        {props?.items?.map((item, index) => {
          const itemInputId = `${id}-${item.id}`;
          const currentValue = widgetValue?.[item.id] ?? "";
          const itemTitleText = stripHtmlToText(item.title);
          const isFirst = index === 0;
          const isLast = index === props!.items!.length - 1;
          return (
            <div key={item.id} className="flex flex-col">
              <div className={cn("flex justify-between mb-2", isMergedStack && "sr-only mb-0")}>
                <label
                  htmlFor={itemInputId}
                  className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
                >
                  <SafeHtml html={item.title} />
                </label>
              </div>
              <div
                className={cn(
                  "flex h-10 items-stretch rounded-md border border-border bg-card/60 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 overflow-hidden",
                  isOutputMode && "bg-muted/50",
                  isMergedStack && [
                    "rounded-none",
                    isFirst && "rounded-t-md",
                    isLast && "rounded-b-md",
                    !isFirst && "border-t-0",
                  ]
                )}
              >
                {item.prefixLabel && (
                  <span
                    className="flex items-center justify-center px-3 text-[11px] font-semibold tracking-wide text-muted-foreground border-r border-border bg-muted/50 whitespace-nowrap"
                    style={item.prefixLabelSize ? { minWidth: item.prefixLabelSize } : undefined}
                  >
                    <SafeHtml html={item.prefixLabel} />
                  </span>
                )}
                <Input
                  id={itemInputId}
                  type="text"
                  className="h-10 flex-1 border-none bg-transparent px-3 py-2 text-sm shadow-none focus-visible:ring-0"
                  placeholder={item.placeholder}
                  value={currentValue}
                  readOnly={isOutputMode}
                  aria-readonly={isOutputMode}
                  onChange={isOutputMode ? undefined : (event) => handleChange(item.id, event)}
                />
                <CopyButton
                  value={currentValue}
                  className="h-10 w-10 rounded-none border-l border-border"
                  ariaLabel={`Copy ${itemTitleText}`}
                  disabled={!currentValue}
                />
              </div>
              {item.description && (
                <p className={cn("mt-1 text-[11px] leading-snug text-muted-foreground", isMergedStack && "sr-only mt-0")}>
                  <SafeHtml html={item.description} />
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
