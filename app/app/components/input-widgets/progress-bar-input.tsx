import { useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { z } from "zod";
import type { WidgetGuideItem } from "./input-types";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { cn } from "~/lib/utils";
import { SafeHtml, stripHtmlToText } from "./common-components/safe-html";
import type { WidgetValueCollectorInf } from "./input-types";

export const ProgressBarInputProps = z.object({
  label       : z.string().optional(),
  hint        : z.string().optional(),
  color       : z.string().optional(),
  defaultValue: z.number().optional(),
  defaultTotal: z.number().optional(),
  width       : z.string().optional(),
});
export type ProgressBarInputProps = z.infer<typeof ProgressBarInputProps>;

export const ProgressBarInputOutputValue = z.object({
  current: z.number().optional(),
  total  : z.number().optional(),
  percent: z.number().optional(),
  label  : z.string().optional(),
  hint   : z.string().optional(),
});
export type ProgressBarInputOutputValue = z.infer<typeof ProgressBarInputOutputValue>;

export function ProgressBarInputOutputValueResolver(): z.ZodTypeAny {
  return ProgressBarInputOutputValue;
}

export const ProgressBarInputUsageExample: WidgetGuideItem = {
  name       : "Progress Bar",
  description: "Read-only progress indicator with ratio text, percent badge, and optional custom color.",
  widget     : {
    id   : "guide-progress-bar-input",
    type : "ProgressBarInput",
    title: "Data Sync",
    mode : "output",
    props: {
      label       : "Sync progress",
      hint        : "Server job",
      defaultValue: 32,
      defaultTotal: 100,
      color       : "#22c55e",
    },
  },
};

// Clamp percent into 0-100 to keep bar width within bounds.
function clampPercent(percent?: number) {
  if (typeof percent !== "number" || Number.isNaN(percent) || !Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

// Prefer explicit percent, otherwise derive from current/total when provided.
function resolvePercent(percent?: number, current?: number, total?: number) {
  if (typeof percent === "number" && Number.isFinite(percent)) return clampPercent(percent);
  if (typeof current === "number" && Number.isFinite(current) && typeof total === "number" && Number.isFinite(total) && total > 0) {
    return clampPercent((current / total) * 100);
  }
  return 0;
}

function formatNumber(value?: number, fallback = 0) {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return fallback;
  return value;
}

function formatProgressText(current?: number, total?: number) {
  const currentValue = formatNumber(current);
  const totalValue = formatNumber(total);
  if (typeof total === "number" && Number.isFinite(total)) return `${currentValue}/${totalValue}`;
  return `${currentValue}`;
}

/**
 * ProgressBarInput renders a non-interactive progress indicator that can show a label, hint, ratio, and percent.
 * Color is configurable via props, defaulting to the theme primary color for consistency with the rest of the UI.
 */
export function ProgressBarInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  _onChange: (id: string, newValue: ProgressBarInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<ProgressBarInputOutputValue> | undefined | null>,
  props?: ProgressBarInputProps
) {
  const { label, hint, color, defaultValue, defaultTotal, width } = ProgressBarInputProps.parse(props ?? {});
  // Props-based defaults for display fallback when value is not yet set
  const propsDefaults = useMemo<ProgressBarInputOutputValue>(() => ({
    current: defaultValue,
    total  : defaultTotal,
    label,
    hint,
  }), [defaultValue, defaultTotal, hint, label]);
  // Initial value is empty object, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<ProgressBarInputOutputValue>({});
  const valueRef = useRef<ProgressBarInputOutputValue>({});
  // Merge props defaults with incoming values so partial updates still render consistently.
  const mergedValue = useMemo<ProgressBarInputOutputValue>(() => ({ ...propsDefaults, ...widgetValue }), [propsDefaults, widgetValue]);

  // Expose current value to the collector for consistent tool execution reads.
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => valueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: ProgressBarInputOutputValue) => {
      const nextValue = { ...propsDefaults, ...(newValue ?? {}) };
      valueRef.current = nextValue;
      setWidgetValue(nextValue);
    },
  }), [propsDefaults]);

  const isOutputMode = mode === "output";
  const liveLabel = mergedValue.label ?? label ?? title;
  const liveHint = mergedValue.hint ?? hint;
  const currentValue = formatNumber(mergedValue.current, formatNumber(defaultValue));
  const totalValue = Math.max(0, formatNumber(mergedValue.total, formatNumber(defaultTotal)));
  const percentValue = resolvePercent(mergedValue.percent, currentValue, totalValue);
  const percentLabel = `${percentValue.toFixed(0)}%`;
  const progressText = formatProgressText(currentValue, totalValue);
  const titleText = stripHtmlToText(liveLabel ?? title);

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <div className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
            <SafeHtml html={liveLabel} />
          </div>
          {liveHint && (
            <span className="text-[10px] text-muted-foreground mt-0.5">
              <SafeHtml html={liveHint} />
            </span>
          )}
        </div>
        <span className="text-[11px] font-semibold text-foreground">{percentLabel}</span>
      </div>
      <div className="mt-2 h-10 flex flex-col justify-center gap-2">
        <div
          role="progressbar"
          aria-label={titleText}
          aria-valuenow={percentValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-readonly={isOutputMode}
          className="relative h-3 w-full overflow-hidden rounded-full border border-border/70 bg-muted"
        >
          <div
            className="h-full w-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${percentValue}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex items-center text-[11px] text-muted-foreground">{progressText}</div>
      </div>
    </div>
  );
}
