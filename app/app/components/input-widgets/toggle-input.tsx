import { useImperativeHandle, useRef, useState, type RefObject } from "react";
import { z } from "zod";
import { Switch } from "~/components/ui/switch";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { cn } from "~/lib/utils";
import type { WidgetGuideItem } from "./input-types";
import { SafeHtml } from "./common-components/safe-html";
import type { WidgetValueCollectorInf } from "./input-types";

export const ToggleInputProps = z.object({
  defaultValue: z.boolean().optional(),
  onLabel     : z.string().optional(),
  description : z.string().optional(),
  width       : z.string().optional(),
});
export type ToggleInputProps = z.infer<typeof ToggleInputProps>;
export const ToggleInputOutputValue = z.boolean();
export type ToggleInputOutputValue = z.infer<typeof ToggleInputOutputValue>;

export function ToggleInputOutputValueResolver(): z.ZodTypeAny {
  return ToggleInputOutputValue;
}

export const ToggleInputUsageExample: WidgetGuideItem = {
  name       : "Toggle",
  description: "Switch control for boolean values with helper text.",
  widget     : {
    id   : "guide-toggle-input",
    type : "ToggleInput",
    title: "Realtime Sync",
    mode : "input",
    props: {
      defaultValue: true,
      onLabel     : "Active",
      description : "Enable live handler execution",
    },
  },
};

// Toggle input widget with controlled value flow and collector exposure.
export function ToggleInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: ToggleInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<ToggleInputOutputValue> | undefined>,
  props?: ToggleInputProps,
) {
  const {
    onLabel = "Enabled",
    description,
    width,
  } = ToggleInputProps.parse(props ?? {});
  const isOutputMode = mode === "output";
  // Use widget id directly to avoid dom-id context dependency.
  const domId = id;
  // Initial value is false, parent will call setValue() to set the value
  const [checked, setChecked] = useState<boolean>(false);
  const checkedRef = useRef<boolean>(false);

  // Expose current value to the collector.
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => checkedRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: ToggleInputOutputValue) => {
      checkedRef.current = newValue;
      setChecked(newValue);
    },
  }), []);

  // Notify parent when user toggles the switch.
  function handleCheckedChange(next: boolean) {
    setChecked(next);
    if (isOutputMode) return;
    checkedRef.current = next;
    onChange(id, next);
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <div className="flex flex-col">
          <label
            htmlFor={domId}
            className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
          >
            <SafeHtml html={title} />
          </label>
          {description && (
            <span className="text-[10px] text-muted-foreground mt-0.5">
              <SafeHtml html={description} />
            </span>
          )}
        </div>
      </div>
      <div className="h-10 border border-border rounded-md px-3 py-2 flex items-center justify-between hover:border-border/70 transition-colors bg-card/50">
        <span className="text-[11px] text-muted-foreground"><SafeHtml html={onLabel} /></span>
        <Switch
          id={domId}
          checked={checked}
          aria-readonly={isOutputMode}
          className={isOutputMode ? "pointer-events-none" : undefined}
          onCheckedChange={handleCheckedChange}
        />
      </div>
    </div>
  );
}
