import { z } from "zod";
import { useImperativeHandle, type RefObject } from "react";
import { cn } from "~/lib/utils";
import { SafeHtml, stripHtmlToText } from "./common-components/safe-html";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import type { WidgetValueCollectorInf } from "./input-types";

export const DividerInputProps = z.object({
  label    : z.string().optional(),
  variant  : z.enum(["solid", "dashed"]).optional(),
  hidden   : z.boolean().optional(),
  gap      : z.number().optional(),
  gapBefore: z.number().optional(),
  gapAfter : z.number().optional(),
  width    : z.string().optional(),
});
export type DividerInputProps = z.infer<typeof DividerInputProps>;
export const DividerInputOutputValue = z.null();
export type DividerInputOutputValue = z.infer<typeof DividerInputOutputValue>;

export function DividerInputOutputValueResolver(): z.ZodTypeAny {
  return DividerInputOutputValue;
}

export const DividerInputUsageExample: WidgetGuideItem = {
  name       : "Divider",
  description: "Visual separator between widgets with optional inline label.",
  widget     : {
    id   : "guide-divider-input",
    type : "DividerInput",
    title: "Divider",
    mode : "output",
    props: { label: "Advanced", variant: "dashed", gap: 8, hidden: false },
  },
};

export function DividerInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: null) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<null> | undefined | null>,
  props?: DividerInputProps
) {
  const { label, variant = "solid", hidden = false, width } = DividerInputProps.parse(props ?? {});

  // Divider always returns null, expose getValue via collectValueRef
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => null,
    // Static widget: ignore setValue but keep interface compatibility.
    setValue: () => {},
  }), []);

  const isOutputMode = mode === "output";
  const isHidden = hidden === true;
  const lineClass = variant === "dashed" ? "border-dashed" : "border-solid";
  const hasLabel = Boolean(label && stripHtmlToText(label).trim());

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div
        className={cn(
          "h-10 w-full flex items-center gap-2 text-xs text-muted-foreground",
          isOutputMode && "opacity-90",
          isHidden && "invisible"
        )}
        aria-label={title}
        aria-hidden={isHidden || undefined}
      >
        {hasLabel ? (
          <>
            <div className={cn("flex-1 border-t border-border", lineClass)} />
            <span className="px-1 whitespace-nowrap">
              <SafeHtml html={label!} />
            </span>
            <div className={cn("flex-1 border-t border-border", lineClass)} />
          </>
        ) : (
          <div className={cn("w-full border-t border-border", lineClass)} />
        )}
      </div>
    </div>
  );
}
