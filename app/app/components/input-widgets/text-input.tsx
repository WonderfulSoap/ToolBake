import React, { type ChangeEvent, useRef, useState, useImperativeHandle, type RefObject } from "react";
import { z } from "zod";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import { CopyButton } from "./common-components/copy-button";
import { SafeHtml, stripHtmlToText } from "./common-components/safe-html";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import type { WidgetValueCollectorInf } from "./input-types";

export const TextInputProps = z.object({
  placeholder    : z.string().optional(),
  defaultValue   : z.string().optional(),
  prefixLabel    : z.string().optional(),
  prefixLabelSize: z.string().optional(),
  size           : z.enum(["normal", "mini"]).optional(),
  delayTrigger   : z.boolean().optional(),
  width          : z.string().optional(),
});
export type TextInputProps = z.infer<typeof TextInputProps>;
export const TextInputOutputValue = z.string();
export type TextInputOutputValue = z.infer<typeof TextInputOutputValue>;
export const TextInputDefaultValue = "";

export function TextInputOutputValueResolver(): z.ZodTypeAny {
  return TextInputOutputValue;
}

export const TextInputUsageExample : WidgetGuideItem = {
  name       : "Text Input",
  description: "Single-line value capture with optional prefix label and default text. $.props allow \"mini\"|\"normal\" size.",
  widget     : {
    id   : "guide-text-input",
    type : "TextInput",
    title: "Context Label",
    mode : "input",
    props: {
      prefixLabel    : "Title",
      prefixLabelSize: "6em",
      placeholder    : "Team sync summary...",
      defaultValue   : "Alpha squad sync notes",
      size           : "mini",
      delayTrigger   : false,
    },
  },
};

// Render a text input widget with optional prefix label and copy support.
export function TextInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id:string, newValue: string) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<string>|undefined|null>,
  props?: TextInputProps,
) {
  const {
    defaultValue,
    placeholder,
    prefixLabel,
    prefixLabelSize,
    size,
    width,
  } = TextInputProps.parse(props ?? {});

  const isOutputMode = mode === "output";
  const titleText = stripHtmlToText(title);
  const isMini = size === "mini";
  const domId = `tool-input-${id}`;

  // Initial value is empty, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<string>("");
  // Use ref to keep the latest value for getValue()
  const valueRef = useRef<string>("");

  useImperativeHandle(collectValueRef, () => ({
    getValue: () => valueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: string) => {
      valueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    valueRef.current = nextValue;
    setWidgetValue(nextValue);
    onChange(id, nextValue);
  }

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
        "flex items-stretch rounded-md border border-border bg-card/60 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40 overflow-hidden",
        isMini ? "h-8" : "h-10",
        isOutputMode && "bg-muted/50"
      )}>
        {prefixLabel && (
          <span
            className={cn(
              "flex items-center justify-center font-semibold tracking-wide text-muted-foreground border-r border-border bg-muted/50 whitespace-nowrap",
              isMini ? "px-2 text-[10px]" : "px-3 text-[11px]"
            )}
            style={prefixLabelSize && !isMini ? { minWidth: prefixLabelSize } : undefined}
          >
            <SafeHtml html={prefixLabel} />
          </span>
        )}
        <Input
          id={domId}
          type="text"
          className={cn(
            "flex-1 border-none bg-transparent shadow-none focus-visible:ring-0",
            isMini ? "h-8 px-2 text-xs" : "h-10 px-3 py-2 text-sm"
          )}
          placeholder={placeholder}
          value={widgetValue}
          readOnly={isOutputMode}
          aria-readonly={isOutputMode}
          onChange={isOutputMode ? undefined : handleChange}
        />
        {!isMini && (
          <CopyButton
            value={widgetValue}
            className="h-10 w-10 rounded-none border-l border-border"
            ariaLabel={`Copy ${titleText}`}
            disabled={!widgetValue}
          />
        )}
      </div>
    </div>
  );
}
