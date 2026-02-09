import { useImperativeHandle, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { z } from "zod";
import { cn } from "~/lib/utils";
import { CopyButton } from "./common-components/copy-button";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import { SafeHtml, stripHtmlToText } from "./common-components/safe-html";
import type { WidgetValueCollectorInf } from "./input-types";

export const ColorInputProps = z.object({
  defaultValue: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .optional(),
  showHex: z.boolean().optional(),
  width  : z.string().optional(),
});
export type ColorInputProps = z.infer<typeof ColorInputProps>;
export const ColorInputOutputValue = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/);
export type ColorInputOutputValue = z.infer<typeof ColorInputOutputValue>;

export function ColorInputOutputValueResolver(): z.ZodTypeAny {
  return ColorInputOutputValue;
}

export const ColorInputUsageExample: WidgetGuideItem = {
  name       : "Color Picker",
  description: "Hex color selector with preview circle and copy action.",
  widget     : {
    id   : "guide-color-input",
    type : "ColorInput",
    title: "Accent Color",
    mode : "input",
    props: {
      defaultValue: "#0EA5E9",
      showHex     : true,
    },
  },
};

export function ColorInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: ColorInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<ColorInputOutputValue> | undefined>,
  props?: ColorInputProps
) {
  const {
    defaultValue = "#6366F1",
    showHex = true,
    width,
  } = ColorInputProps.parse(props ?? {});
  // Initial value is empty, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<string>("");
  // Use ref to keep the latest value for getValue()
  const valueRef = useRef<string>("");
  const isOutputMode = mode === "output";
  const valueIsValid = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(widgetValue);
  const colorValue = valueIsValid ? widgetValue : defaultValue;
  const displayValue = colorValue.toUpperCase();
  const titleText = stripHtmlToText(title);
  const colorPickerId = `${id}-picker`;

  // Expose the current color value for value collection.
  useImperativeHandle(
    collectValueRef,
    () => ({
      getValue: () => valueRef.current,
      // Allow parent to set value without triggering onChange.
      setValue: (newValue: string) => {
        valueRef.current = newValue;
        setWidgetValue(newValue);
      },
    }),
    []
  );

  function commit(nextValue: string) {
    valueRef.current = nextValue;
    setWidgetValue(nextValue);
    onChange(id, nextValue);
  }

  // Update local value and notify parent immediately for real-time updates.
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    commit(nextValue);
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label
          htmlFor={colorPickerId}
          className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
        >
          <SafeHtml html={title} />
        </label>
        {showHex && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {displayValue}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10">
          <input
            id={colorPickerId}
            type="color"
            className={cn(
              "absolute inset-0 h-10 w-10 cursor-pointer rounded-full border-none bg-transparent p-0 opacity-0 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isOutputMode && "cursor-default"
            )}
            value={displayValue}
            onChange={isOutputMode ? undefined : handleChange}
            disabled={isOutputMode}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none h-10 w-10 rounded-full shadow-inner transition-opacity",
              isOutputMode && "opacity-80"
            )}
            style={{ backgroundColor: displayValue }}
          />
        </div>
        <div className="flex h-10 flex-1 items-center justify-between rounded-md border border-border bg-card/70 px-3">
          <span className="font-mono text-xs text-foreground">
            {displayValue}
          </span>
          <CopyButton
            value={displayValue}
            ariaLabel={`Copy ${titleText} color value`}
            className="h-8 w-8 border border-border bg-card/90"
          />
        </div>
      </div>
    </div>
  );
}
