import { useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { z } from "zod";
import { cn } from "~/lib/utils";
import { SafeHtml } from "./common-components/safe-html";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import type { WidgetValueCollectorInf } from "./input-types";

export const RawHtmlInputProps = z.object({
  content   : z.string().optional(),
  align     : z.enum(["left", "center", "right"]).optional(),
  tone      : z.enum(["default", "muted"]).optional(),
  autoHeight: z.boolean().optional(),
  autoHight : z.boolean().optional(),
  maxHeight : z.string().optional(),
  width     : z.string().optional(),
});
export type RawHtmlInputProps = z.infer<typeof RawHtmlInputProps>;
export const RawHtmlInputScriptValue = z.object({
  innerHtml: z.string().optional(),
  afterHook: z.function({ input: [z.instanceof(HTMLElement)], output: z.void() }).optional(),
  data     : z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});
export type RawHtmlInputScriptValue = z.infer<typeof RawHtmlInputScriptValue>;
export const RawHtmlInputOutputValue = RawHtmlInputScriptValue;
export type RawHtmlInputOutputValue = z.infer<typeof RawHtmlInputOutputValue>;

export function RawHtmlInputOutputValueResolver(): z.ZodTypeAny {
  return RawHtmlInputOutputValue;
}

export const RawHtmlInputUsageExample: WidgetGuideItem = {
  name       : "Raw HTML",
  description: "Display-only HTML label rendered without sanitization. Use with trusted content only.",
  widget     : {
    id   : "guide-raw-html-input",
    type : "RawHtmlInput",
    title: "Unsafe HTML",
    mode : "output",
    props: {
      content   : "<div class='text-sm leading-relaxed'><div><b>Warning</b>: HTML renders directly without sanitization.</div><div class='text-muted-foreground text-[12px] mt-1'>Use only with trusted content.</div></div>",
      tone      : "default",
      autoHeight: true,
    },
  },
};

export function RawHtmlInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: RawHtmlInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<RawHtmlInputOutputValue> | undefined | null>,
  props?: RawHtmlInputProps
) {
  const parsed = RawHtmlInputProps.parse(props ?? {});
  const { content, align = "left", tone = "default", maxHeight, width } = parsed;
  const autoHeight = parsed.autoHeight ?? parsed.autoHight ?? true;
  // Props-based fallback for display when value is not yet set.
  const initialHtml = content ?? "";

  // Initial value is empty, parent will call setValue() to set the value.
  const [widgetValue, setWidgetValue] = useState<RawHtmlInputOutputValue>({});
  const widgetValueRef = useRef<RawHtmlInputOutputValue>({});

  // Key for forcing DOM rebuild when value changes.
  const [renderKey, setRenderKey] = useState(0);

  // Update internal state and force DOM rebuild when value changes programmatically.
  function applyWidgetValue(nextValue: RawHtmlInputOutputValue | undefined) {
    const resolvedValue = nextValue ?? {};
    widgetValueRef.current = resolvedValue;
    setWidgetValue(resolvedValue);
    setRenderKey((key) => key + 1);
  }

  const isOutputMode = mode === "output";
  const displayHtml = useMemo(
    () => normalizeRawHtmlValue(widgetValue, initialHtml),
    [initialHtml, widgetValue]
  );
  const alignClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Expose getValue method via collectValueRef - collects data-* attributes from elements with id.
  useImperativeHandle(collectValueRef, () => ({
    getValue: (): RawHtmlInputScriptValue => {
      const container = contentRef.current;
      if (!container) return { data: {} };
      return { data: collectDataAttributes(container) };
    },
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: RawHtmlInputOutputValue) => {
      applyWidgetValue(newValue);
    },
  }), []);

  // Insert raw HTML using createContextualFragment without sanitization.
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const range = document.createRange();
    range.selectNode(container);
    const fragment = range.createContextualFragment(displayHtml);
    container.replaceChildren(fragment);
    // Run afterHook only when the payload provides it.
    if (widgetValueRef.current?.afterHook) widgetValueRef.current.afterHook(container);
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
      >
        <div
          ref={contentRef}
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
 * Normalize raw HTML output values into a unified HTML string.
 */
function normalizeRawHtmlValue(value: RawHtmlInputOutputValue | undefined, fallbackHtml: string): string {
  return value?.innerHtml ?? fallbackHtml;
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
