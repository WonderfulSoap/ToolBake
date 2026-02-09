import React, { type ChangeEvent, useRef, useState, useImperativeHandle, type RefObject } from "react";
import { Minus, Plus } from "lucide-react";
import { z } from "zod";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { CopyButton } from "./common-components/copy-button";
import { SafeHtml, stripHtmlToText } from "./common-components/safe-html";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem, WidgetValueCollectorInf } from "./input-types";

export const NumberInputProps = z.object({
  placeholder : z.string().optional(),
  defaultValue: z.number().optional(),
  prefixLabel : z.string().optional(),
  min         : z.number().optional(),
  max         : z.number().optional(),
  step        : z.number().optional(),
  size        : z.enum(["normal", "mini"]).optional(),
  width       : z.string().optional(),
});
export type NumberInputProps = z.infer<typeof NumberInputProps>;

export const NumberInputOutputValue = z.number();
export type NumberInputOutputValue = z.infer<typeof NumberInputOutputValue>;
export const NumberInputDefaultValue = 0;

export function NumberInputOutputValueResolver(): z.ZodTypeAny {
  return NumberInputOutputValue;
}

export const NumberInputUsageExample: WidgetGuideItem = {
  name       : "Number Input",
  description: "Numeric value field with increment controls and optional bounds. $.props allow \"mini\"|\"normal\" size.",
  widget     : {
    id   : "guide-number-input",
    type : "NumberInput",
    title: "Batch Size",
    mode : "input",
    props: {
      prefixLabel : "Items",
      min         : 1,
      max         : 250,
      step        : 5,
      defaultValue: 25,
      size        : "mini",
    },
  },
};

export function NumberInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: number) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<number>|undefined>,
  props?: NumberInputProps,
) {
  const {
    placeholder,
    prefixLabel,
    min,
    max,
    step = 1,
    size,
    width,
  } = NumberInputProps.parse(props ?? {});

  const isOutputMode = mode === "output";
  const isMini = size === "mini";
  const titleText = stripHtmlToText(title);
  const domId = `tool-input-${id}`;

  // Initial value is 0, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<number>(0);
  // Use ref to track the latest value synchronously for getValue()
  const valueRef = useRef<number>(0);

  // Clamp to min/max so programmatic updates stay consistent with user input rules.
  function clampValue(nextValue: number) {
    let clamped = nextValue;
    if (typeof min === "number") clamped = Math.max(clamped, min);
    if (typeof max === "number") clamped = Math.min(clamped, max);
    return clamped;
  }

  useImperativeHandle(collectValueRef, () => ({
    getValue: () => valueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (nextValue: number) => {
      const clamped = clampValue(nextValue);
      valueRef.current = clamped;
      setWidgetValue(clamped);
    },
  }), [min, max]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    const parsed = Number(nextValue);

    if (!Number.isNaN(parsed)) {
      const clamped = clampValue(parsed);
      valueRef.current = clamped;
      setWidgetValue(clamped);
      onChange(id, clamped);
    }
  }

  function adjust(delta: number) {
    if (isOutputMode) return;
    const clamped = clampValue(widgetValue + delta);
    valueRef.current = clamped;
    setWidgetValue(clamped);
    onChange(id, clamped);
  }

  const canDecrease = typeof min === "number" ? widgetValue > min : true;
  const canIncrease = typeof max === "number" ? widgetValue < max : true;

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label
          htmlFor={domId}
          className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
        >
          <SafeHtml html={title} />
        </label>
      </div>
      <div className={cn(
        "flex items-stretch rounded-md border border-border bg-card/60 overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30",
        isMini ? "h-8" : "h-10",
        isOutputMode && "bg-muted/40"
      )}>
        {prefixLabel && (
          <span className={cn(
            "flex items-center font-semibold tracking-wide text-muted-foreground border-r border-border bg-muted/50",
            isMini ? "px-2 text-[10px]" : "px-3 text-[11px]"
          )}>
            <SafeHtml html={prefixLabel} />
          </span>
        )}
        <Input
          id={domId}
          type="text"
          className={cn(
            "flex-1 border-none bg-transparent shadow-none focus-visible:ring-0",
            isMini ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm"
          )}
          placeholder={placeholder}
          value={widgetValue}
          readOnly={isOutputMode}
          aria-readonly={isOutputMode}
          inputMode="decimal"
          onChange={isOutputMode ? undefined : handleChange}
        />
        {!isMini && (
          <>
            <CopyButton
              value={String(widgetValue)}
              className="h-10 w-9 rounded-none border-l border-border"
              ariaLabel={`Copy ${titleText}`}
              disabled={!widgetValue}
            />
            <div className="flex h-10 divide-x divide-border">
              <button
                type="button"
                className="px-2 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
                onClick={() => adjust(-step)}
                disabled={isOutputMode || !canDecrease}
                aria-label={`Decrease ${titleText}`}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="px-2 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
                onClick={() => adjust(step)}
                disabled={isOutputMode || !canIncrease}
                aria-label={`Increase ${titleText}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
