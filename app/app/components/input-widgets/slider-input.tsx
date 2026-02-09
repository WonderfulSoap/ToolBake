import { useState, useImperativeHandle, useRef, type RefObject } from "react";
import { z } from "zod";
import { Slider } from "~/components/ui/slider";
import type { WidgetGuideItem, WidgetValueCollectorInf } from "./input-types";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { cn } from "~/lib/utils";
import { SafeHtml } from "./common-components/safe-html";

export const SliderInputProps = z.object({
  defaultValue: z.number().optional(),
  min         : z.number().optional(),
  max         : z.number().optional(),
  step        : z.number().optional(),
  valueSuffix : z.string().optional(),
  width       : z.string().optional(),
});
export type SliderInputProps = z.infer<typeof SliderInputProps>;
export const SliderInputOutputValue = z.number();
export type SliderInputOutputValue = z.infer<typeof SliderInputOutputValue>;

export function SliderInputOutputValueResolver(): z.ZodTypeAny {
  return SliderInputOutputValue;
}

export const SliderInputUsageExample: WidgetGuideItem = {
  name       : "Slider",
  description: "Continuous numeric control with live display badge.",
  widget     : {
    id   : "guide-slider-input",
    type : "SliderInput",
    title: "Sampling Rate",
    mode : "input",
    props: {
      defaultValue: 60,
      max         : 100,
      step        : 5,
      valueSuffix : "%",
    },
  },
};

/**
 * SliderInput - Continuous numeric slider control.
 * New version interface: receives value from parent, notifies changes via onChange,
 * and exposes getValue() via collectValueRef.
 */
export function SliderInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: number) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<number> | undefined>,
  props?: SliderInputProps
) {
  const { min = 0, max = 100, step = 1, valueSuffix = "", width, defaultValue = 0 } = SliderInputProps.parse(props ?? {});
  // Initial value is 0, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<number>(0);
  // Ref to store the real-time slider value for getValue()
  const widgetValueRef = useRef<number>(0);
  const displayValue = `${widgetValue}${valueSuffix}`;
  const isOutputMode = mode === "output";

  // Expose getValue method via collectValueRef, reading from ref for real-time value
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => widgetValueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: number) => {
      widgetValueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  function handleValueChange([newValue]: number[]) {
    if (isOutputMode || typeof newValue !== "number") return;
    setWidgetValue(newValue);
    widgetValueRef.current = newValue;
    onChange(id, newValue);
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
          <SafeHtml html={title} />
        </span>
        <span className="text-[10px] text-primary font-mono font-bold">{displayValue}</span>
      </div>
      <Slider
        value={[widgetValue]}
        min={min}
        max={max}
        step={step}
        aria-readonly={isOutputMode}
        className={cn("h-10", isOutputMode && "pointer-events-none")}
        onValueChange={handleValueChange}
      />
    </div>
  );
}
