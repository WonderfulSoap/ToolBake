import { z } from "zod";
import { useImperativeHandle, useRef, useState, type RefObject } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { cn } from "~/lib/utils";
import type { WidgetGuideItem } from "./input-types";
import { SafeHtml } from "./common-components/safe-html";
import type { WidgetValueCollectorInf } from "./input-types";

export const SelectListInputProps = z.object({
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  defaultValue: z.string().optional(),
  placeholder : z.string().optional(),
  width       : z.string().optional(),
});
export type SelectListInputProps = z.infer<typeof SelectListInputProps>;
export const SelectListInputOutputValue = z.string().optional();
export type SelectListInputOutputValue = z.infer<typeof SelectListInputOutputValue>;

export function SelectListInputOutputValueResolver(widget?: Record<string, unknown>): z.ZodTypeAny {
  if (widget?.props) {
    const props = widget.props as Record<string, unknown>;
    const options = props.options as Array<{ value: string; label: string }> | undefined;
    if (Array.isArray(options) && options.length > 0) {
      const values = options.map(opt => opt.value);
      return z.enum(values as [string, ...string[]]);
    }
  }
  return SelectListInputOutputValue;
}

export const SelectListInputUsageExample: WidgetGuideItem = {
  name       : "Select List",
  description: "Dropdown list for picking a single option.",
  widget     : {
    id   : "guide-select-input",
    type : "SelectListInput",
    title: "Dataset",
    mode : "input",
    props: {
      placeholder : "Pick dataset",
      defaultValue: "recent",
      options     : [
        { value: "recent", label: "Recent" },
        { value: "archived", label: "Archived" },
        { value: "shared", label: "Shared" },
      ],
    },
  },
};

export function SelectListInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: SelectListInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<SelectListInputOutputValue> | undefined>,
  props?: SelectListInputProps
) {
  const {
    options = [],
    placeholder = "Select an option",
    width,
    defaultValue,
  } = SelectListInputProps.parse(props ?? {});
  // Initial value is undefined, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<SelectListInputOutputValue>(undefined);
  const widgetValueRef = useRef<SelectListInputOutputValue>(undefined);
  const isOutputMode = mode === "output";

  // Expose the current widget value to the collector.
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => widgetValueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: SelectListInputOutputValue) => {
      widgetValueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  function handleValueChange(next: string) {
    if (isOutputMode) return;
    setWidgetValue(next);
    widgetValueRef.current = next;
    onChange(id, next);
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label
          className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
        >
          <SafeHtml html={title} />
        </label>
      </div>
      <Select
        value={widgetValue}
        onValueChange={handleValueChange}
      >
        <SelectTrigger
          aria-readonly={isOutputMode}
          className={cn(isOutputMode && "cursor-text select-text")}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <SafeHtml html={option.label} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
