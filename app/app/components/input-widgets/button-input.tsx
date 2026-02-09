import { z } from "zod";
import { useState, useRef, useImperativeHandle, type RefObject } from "react";
import { Button } from "~/components/ui/button";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { cn } from "~/lib/utils";
import type { WidgetGuideItem, WidgetValueCollectorInf } from "./input-types";
import { SafeHtml } from "./common-components/safe-html";

export const ButtonInputProps = z.object({
  label      : z.string().optional(),
  variant    : z.enum(["default", "destructive", "outline", "secondary", "ghost", "link"]).optional(),
  size       : z.enum(["default", "sm", "lg", "icon"]).optional(),
  description: z.string().optional(),
  width      : z.string().optional(),
});
export type ButtonInputProps = z.infer<typeof ButtonInputProps>;
export const ButtonInputOutputValue = z.number();
export type ButtonInputOutputValue = z.infer<typeof ButtonInputOutputValue>;

export function ButtonInputOutputValueResolver(): z.ZodTypeAny {
  return ButtonInputOutputValue;
}

export const ButtonInputUsageExample: WidgetGuideItem = {
  name       : "Button",
  description: "Action button that triggers a click event with customizable style. Only user clicks trigger the handler, external value changes don't affect button behavior.",
  widget     : {
    id   : "guide-button-input",
    type : "ButtonInput",
    title: "Execute Action",
    mode : "input",
    props: {
      label      : "Run Process",
      variant    : "default",
      size       : "default",
      description: "Click to trigger the action",
    },
  },
};

export function ButtonInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: number) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<number> | undefined | null>,
  props?: ButtonInputProps
) {
  const {
    label,
    variant = "default",
    size = "default",
    description,
    width,
  } = ButtonInputProps.parse(props ?? {});

  const initialValue = 0;
  const [widgetValue, setWidgetValue] = useState<number>(initialValue);
  // Use ref to keep the latest value for getValue()
  const valueRef = useRef<number>(initialValue);

  // Expose getValue/setValue methods via collectValueRef
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => valueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: number) => {
      valueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  const isOutputMode = mode === "output";
  const displayLabel = label ?? title;

  function handleClick() {
    if (!isOutputMode) {
      // Use timestamp to ensure each click triggers handler, but button display doesn't depend on value
      const nextValue = Date.now();
      valueRef.current = nextValue;
      setWidgetValue(nextValue);
      onChange(id, nextValue);
    }
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
            <SafeHtml html={title} />
          </label>
          {description && (
            <span className="text-[10px] text-muted-foreground mt-0.5">
              <SafeHtml html={description} />
            </span>
          )}
        </div>
      </div>
      <Button
        id={id}
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isOutputMode}
        className={cn(isOutputMode && "pointer-events-none opacity-60")}
      >
        <SafeHtml html={displayLabel} />
      </Button>
    </div>
  );
}
