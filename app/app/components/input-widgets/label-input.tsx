import { useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { z } from "zod";
import { cn } from "~/lib/utils";
import { SafeHtml, SafeHtmlBlock } from "./common-components/safe-html";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import type { WidgetValueCollectorInf } from "./input-types";

export const LabelInputProps = z.object({
  content   : z.string().optional(),
  align     : z.enum(["left", "center", "right"]).optional(),
  tone      : z.enum(["default", "muted"]).optional(),
  autoHeight: z.boolean().optional(),
  autoHight : z.boolean().optional(),
  maxHeight : z.string().optional(),
  width     : z.string().optional(),
});
export type LabelInputProps = z.infer<typeof LabelInputProps>;
export const LabelInputScriptValue = z.object({
  innerHtml: z.string().optional(),
  afterHook: z.function({ input: [z.instanceof(HTMLElement)], output: z.void() }).optional(),
  data     : z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});
export type LabelInputScriptValue = z.infer<typeof LabelInputScriptValue>;
export const LabelInputOutputValue = z.union([z.string(), LabelInputScriptValue]);
export type LabelInputOutputValue = z.infer<typeof LabelInputOutputValue>;

export function LabelInputOutputValueResolver(): z.ZodTypeAny {
  return LabelInputOutputValue;
}

export const LabelInputUsageExample: WidgetGuideItem = {
  name       : "Label",
  description: "Display-only text label that supports richer HTML tags and optional Tailwind classes.",
  widget     : {
    id   : "guide-label-input",
    type : "LabelInput",
    title: "Status",
    mode : "output",
    props: {
      content   : "<div class='text-sm leading-relaxed'><div><b>durationStr</b> supports an optional sign (<code>+</code>/<code>-</code>) and one or more <code>&lt;int&gt;&lt;unit&gt;</code> segments like <code>1h30m</code>.</div><div class='text-muted-foreground text-[12px] mt-1'>Units: ms, s, m, h, d, w, M, y.</div></div>",
      tone      : "default",
      autoHeight: true,
    },
  },
};

export function LabelInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: LabelInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<LabelInputOutputValue> | undefined | null>,
  props?: LabelInputProps
) {
  const parsed = LabelInputProps.parse(props ?? {});
  const { content, align = "left", tone = "default", maxHeight, width } = parsed;
  const autoHeight = parsed.autoHeight ?? parsed.autoHight ?? true;
  // Props-based fallback for display when value is not yet set
  const initialHtml = content ?? "";

  // Initial value is empty, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<LabelInputOutputValue>("");
  const widgetValueRef = useRef<LabelInputOutputValue>("");

  // Key for forcing DOM rebuild when value changes
  const [renderKey, setRenderKey] = useState(0);

  // Update internal state and force DOM rebuild when value changes programmatically.
  function applyWidgetValue(nextValue: LabelInputOutputValue) {
    widgetValueRef.current = nextValue;
    setWidgetValue(nextValue);
    setRenderKey((key) => key + 1);
  }

  const isOutputMode = mode === "output";
  const displayHtml = useMemo(
    () => normalizeLabelValue(widgetValue, initialHtml),
    [initialHtml, widgetValue]
  );
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Expose getValue method via collectValueRef - collects data-* attributes from elements with id
  useImperativeHandle(collectValueRef, () => ({
    getValue: (): LabelInputScriptValue => {
      const container = contentRef.current;
      if (!container) return { data: {} };
      return { data: collectDataAttributes(container) };
    },
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: LabelInputOutputValue) => {
      applyWidgetValue(newValue);
    },
  }), []);

  // Execute afterHook after DOM is rendered (using useLayoutEffect to run before paint)
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    // Execute afterHook if present
    console.log(`[LabelInput] id: ${id}, execute afterHook?: widgetValueRef: ${widgetValueRef.current}`);
    if (isLabelScriptValue(widgetValueRef.current) && widgetValueRef.current.afterHook) {
      console.log(`[LabelInput] id: ${id}, execute start execute afterHook: ${widgetValueRef.current.afterHook}`);
      widgetValueRef.current.afterHook(container);
    }
  });



  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      {title && (
        <div className="flex justify-between mb-2">
          <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
            <SafeHtml html={title} />
          </div>
        </div>
      )}
      <div
        key={renderKey}
        className={cn(
          // Allow label HTML to position overlays relative to the label container.
          "w-full rounded-md border border-border bg-card/60 px-3 flex relative",
          autoHeight ? "min-h-10 h-auto py-2 items-start" : "h-10 items-center overflow-hidden",
          maxHeight && "overflow-auto",
          isOutputMode && "bg-muted/50"
        )}
        style={maxHeight ? { maxHeight } : undefined}
        ref={contentRef}
      >
        <SafeHtmlBlock
          html={displayHtml}
          className={cn(
            "w-full min-w-0 text-sm",
            autoHeight ? "leading-relaxed break-words whitespace-normal" : "leading-snug truncate",
            alignClass,
            tone === "muted" && "text-muted-foreground"
          )}
        />
      </div>
    </div>
  );
}

/**
 * Normalize label output values into a unified HTML string.
 */
function normalizeLabelValue(value: LabelInputOutputValue | undefined, fallbackHtml: string): string {
  if (isLabelScriptValue(value)) return value.innerHtml ?? fallbackHtml;
  return (value ?? fallbackHtml) as string;
}

/**
 * Determine whether the output payload is a script-enabled label value.
 */
function isLabelScriptValue(value: LabelInputOutputValue | undefined): value is LabelInputScriptValue {
  return typeof value === "object" && value !== null && "innerHtml" in value;
}

/**
 * Collect data-* attributes from elements with id within the container.
 * Returns { elementId: { dataKey: dataValue } } structure.
 */
function collectDataAttributes(container: HTMLElement): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  const elements = container.querySelectorAll("[id]");

  for (const el of elements) {
    const elId = el.id;
    if (!elId) continue;

    const dataAttrs: Record<string, string> = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith("data-")) {
        dataAttrs[attr.name] = attr.value;
      }
    }

    
    if (Object.keys(dataAttrs).length > 0) {
      result[elId] = dataAttrs;
    }
  }

  return result;
}
