import { useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { z } from "zod";
import Sketch from "@uiw/react-color-sketch";
import type { ColorResult } from "@uiw/color-convert";
import type { SwatchPresetColor } from "@uiw/react-color-swatch";
import { cn } from "~/lib/utils";
import { CopyButton } from "./common-components/copy-button";
import { SafeHtml, stripHtmlToText } from "./common-components/safe-html";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import type { WidgetValueCollectorInf } from "./input-types";

const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const SwatchPresetColorSchema = z.union([
  z.string().regex(HEX_COLOR_PATTERN),
  z.object({ color: z.string().regex(HEX_COLOR_PATTERN), title: z.string().optional() }),
]);

export const ColorPickerInputProps = z.object({
  defaultValue   : z.string().regex(HEX_COLOR_PATTERN).optional(),
  width          : z.string().optional(),
  panelWidth     : z.number().int().min(160).max(480).optional(),
  disableAlpha   : z.boolean().optional(),
  editableDisable: z.boolean().optional(),
  presetColors   : z.union([z.literal(false), z.array(SwatchPresetColorSchema)]).optional(),
});
export type ColorPickerInputProps = z.infer<typeof ColorPickerInputProps>;
export const ColorPickerInputOutputValue = z.string().regex(HEX_COLOR_PATTERN);
export type ColorPickerInputOutputValue = z.infer<typeof ColorPickerInputOutputValue>;

function getDefaultPresetColors(): SwatchPresetColor[] {
  return [
    "#F97316",
    "#FACC15",
    "#4ADE80",
    "#2DD4BF",
    "#38BDF8",
    "#6366F1",
    { color: "#A855F7", title: "Violet" },
    { color: "#EC4899", title: "Rose" },
    "#EF4444",
    "#0F172A",
  ];
}

function normalizeHexValue(value: string, fallback: string): string {
  if (HEX_COLOR_PATTERN.test(value)) return value.toUpperCase();
  return fallback.toUpperCase();
}

export function ColorPickerInputOutputValueResolver(): z.ZodTypeAny {
  return ColorPickerInputOutputValue;
}

export const ColorPickerInputUsageExample: WidgetGuideItem = {
  name       : "Color Picker Panel",
  description: "Popover color palette powered by Sketch picker with preset swatches and copy action.",
  widget     : {
    id   : "guide-color-picker-input",
    type : "ColorPickerInput",
    title: "Brand Gradient",
    mode : "input",
    props: {
      defaultValue: "#4B6E35",
      presetColors: [
        "#FDE68A",
        "#FCA5A5",
        { color: "#D8B4FE", title: "Soft Lavender" },
      ],
    },
  },
};

/**
 * ColorPickerInput - Sketch-based color picker with optional debounced commits.
 * New version interface: uses setValue() for programmatic updates, notifies changes via onChange,
 * and exposes getValue() via collectValueRef.
 */
export function ColorPickerInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: ColorPickerInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<ColorPickerInputOutputValue> | undefined>,
  props?: ColorPickerInputProps
) {
  const {
    defaultValue = "#6366F1",
    width,
    panelWidth = 280,
    disableAlpha = false,
    editableDisable = true,
    presetColors,
  } = ColorPickerInputProps.parse(props ?? {});
  const palette = useMemo<false | SwatchPresetColor[]>(() => {
    if (presetColors === false) return false;
    if (Array.isArray(presetColors) && presetColors.length > 0) return presetColors;
    return getDefaultPresetColors();
  }, [presetColors]);
  // Initial value is empty, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<string>("");
  // Use ref to keep the latest value for getValue()
  const widgetValueRef = useRef<string>("");
  const isOutputMode = mode === "output";
  const [draftValue, setDraftValue] = useState<string>("");
  const normalizedValue = normalizeHexValue(widgetValue ?? "", defaultValue);
  const titleText = stripHtmlToText(title);

  // Expose getValue/setValue methods via collectValueRef for value collection.
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => widgetValueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: string) => {
      const normalizedExternal = normalizeHexValue(newValue ?? "", defaultValue);
      widgetValueRef.current = normalizedExternal;
      setWidgetValue(normalizedExternal);
      setDraftValue(normalizedExternal);
    },
  }), []);

  function commit(nextValue: string) {
    setWidgetValue(nextValue);
    widgetValueRef.current = nextValue;
    onChange(id, nextValue);
  }

  const handleColorChange = (result: ColorResult) => {
    if (isOutputMode) return;
    const hexCandidate = disableAlpha ? result.hex : result.hexa ?? result.hex;
    const nextValue = normalizeHexValue(hexCandidate, normalizedValue);
    setDraftValue(nextValue);
    commit(nextValue);
  };

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-foreground transition-colors group-hover:text-primary">
          <SafeHtml html={title} />
        </label>
        <CopyButton
          value={normalizedValue}
          ariaLabel={`Copy ${titleText} color value`}
          className="h-7 w-7 border border-border bg-card/60"
        />
      </div>
      <div className="mt-3 flex justify-center">
        <div className="relative rounded-md border border-border/70 bg-card/95 p-3">
          {isOutputMode && <div className="pointer-events-none absolute inset-0 z-10 rounded-md bg-background/40" />}
          <Sketch
            color={normalizedValue}
            width={panelWidth}
            disableAlpha={disableAlpha}
            editableDisable={editableDisable}
            presetColors={palette}
            onChange={handleColorChange}
          />
        </div>
      </div>
    </div>
  );
}
