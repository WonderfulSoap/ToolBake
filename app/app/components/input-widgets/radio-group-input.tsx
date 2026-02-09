import { useState, useImperativeHandle, useRef, type RefObject } from "react";
import { z } from "zod";
import { cn } from "~/lib/utils";
import type { WidgetValueCollectorInf } from "./input-types";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import { SafeHtml } from "./common-components/safe-html";

export const RadioGroupInputProps = z.object({
  options: z.array(
    z.object({
      label      : z.string(),
      value      : z.string(),
      description: z.string().optional(),
    })
  ),
  defaultValue: z.string().optional(),
  orientation : z.enum(["horizontal", "vertical"]).optional(),
  width       : z.string().optional(),
});
export type RadioGroupInputProps = z.infer<typeof RadioGroupInputProps>;
export const RadioGroupInputOutputValue = z.string().optional();
export type RadioGroupInputOutputValue = z.infer<typeof RadioGroupInputOutputValue>;

export function RadioGroupInputOutputValueResolver(widget?: Record<string, unknown>): z.ZodTypeAny {
  if (widget?.props) {
    const props = widget.props as Record<string, unknown>;
    const options = props.options as Array<{ value: string; label: string }> | undefined;
    if (Array.isArray(options) && options.length > 0) {
      const values = options.map(opt => opt.value);
      return z.enum(values as [string, ...string[]]);
    }
  }
  return RadioGroupInputOutputValue;
}

export const RadioGroupInputUsageExample: WidgetGuideItem = {
  name       : "Radio Group",
  description: "Pill-style selection for mutually exclusive options.",
  widget     : {
    id   : "guide-radio-input",
    type : "RadioGroupInput",
    title: "Execution Profile",
    mode : "input",
    props: {
      orientation : "horizontal",
      defaultValue: "balanced",
      options     : [
        { value: "fast", label: "Fast", description: "Prioritize speed" },
        { value: "balanced", label: "Balanced", description: "Best effort" },
        { value: "precise", label: "Precise", description: "Max accuracy" },
      ],
    },
  },
};

export function RadioGroupInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: string | undefined) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<string | undefined> | undefined>,
  props?: RadioGroupInputProps
) {
  const { options, orientation = "vertical", width, defaultValue } = RadioGroupInputProps.parse(props ?? {});
  const isOutputMode = mode === "output";
  const layoutClass = orientation === "horizontal" ? "flex flex-wrap gap-2" : "flex flex-col gap-2";

  // Initial value is undefined, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<string | undefined>(undefined);
  const widgetValueRef = useRef<string | undefined>(undefined);

  // Expose getValue method via collectValueRef, read from ref for real-time value
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => widgetValueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: string | undefined) => {
      widgetValueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  function handleSelect(optionValue: string) {
    if (isOutputMode) return;
    setWidgetValue(optionValue);
    widgetValueRef.current = optionValue;
    onChange(id, optionValue);
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
          <SafeHtml html={title} />
        </label>
      </div>
      <div className={layoutClass} role="radiogroup" aria-readonly={isOutputMode}>
        {options.map((option) => {
          const isActive = widgetValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={cn(
                "min-w-[120px] rounded-md border px-3 py-2 text-left text-xs transition-colors",
                isActive
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                isOutputMode && "cursor-default opacity-80"
              )}
              onClick={() => handleSelect(option.value)}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-3 w-3 rounded-full border",
                    isActive ? "border-primary bg-primary" : "border-border bg-white"
                  )}
                />
                <span className="text-[11px] font-semibold text-foreground">
                  <SafeHtml html={option.label} />
                </span>
              </span>
              {option.description && (
                <span className="mt-1 block text-[10px] text-muted-foreground leading-snug">
                  <SafeHtml html={option.description} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
