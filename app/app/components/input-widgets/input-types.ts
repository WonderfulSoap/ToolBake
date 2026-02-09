import z from "zod";
import { type ReactNode, type RefObject } from "react";
import { SelectListInput, SelectListInputProps, SelectListInputOutputValueResolver, SelectListInputUsageExample } from "./select-list-input";
import { TextareaInput, TextareaInputProps, TextareaInputOutputValueResolver, TextareaInputUsageExample } from "./textarea-input";
import { ToggleInput, ToggleInputProps, ToggleInputOutputValueResolver, ToggleInputUsageExample } from "./toggle-input";
import { SliderInput, SliderInputProps, SliderInputOutputValueResolver, SliderInputUsageExample } from "./slider-input";
import { FileUploadInput, FileUploadInputProps, FileUploadInputOutputValueResolver, FileUploadInputUsageExample } from "./file-upload-input";
import { FilesUploadInput, FilesUploadInputProps, FilesUploadInputOutputValueResolver, FilesUploadInputUsageExample } from "./files-upload-input";
import { NumberInput, NumberInputProps, NumberInputOutputValueResolver, NumberInputUsageExample } from "./number-input";
import { RadioGroupInput, RadioGroupInputProps, RadioGroupInputOutputValueResolver, RadioGroupInputUsageExample } from "./radio-group-input";
import { ColorInput, ColorInputProps, ColorInputOutputValueResolver, ColorInputUsageExample } from "./color-input";
import { ColorPickerInput, ColorPickerInputProps, ColorPickerInputOutputValueResolver, ColorPickerInputUsageExample } from "./color-picker-input";
import { TagInput, TagInputProps, TagInputOutputValueResolver, TagInputUsageExample } from "./tag-input";
import { ButtonInput, ButtonInputProps, ButtonInputOutputValueResolver, ButtonInputUsageExample } from "./button-input";
import { LabelInput, LabelInputProps, LabelInputOutputValueResolver, LabelInputUsageExample } from "./label-input";
import { RawHtmlInput, RawHtmlInputProps, RawHtmlInputOutputValueResolver, RawHtmlInputUsageExample } from "./raw-html-input";
import { DividerInput, DividerInputProps, DividerInputOutputValueResolver, DividerInputUsageExample } from "./divider-input";
import { MultiTextInput, MultiTextInputProps, MultiTextInputOutputValueResolver, MultiTextInputUsageExample } from "./multi-text-input";
import { ProgressBarInput, ProgressBarInputProps, ProgressBarInputOutputValueResolver, ProgressBarInputUsageExample } from "./progress-bar-input";
import { SortableListInput, SortableListInputProps, SortableListInputOutputValueResolver, SortableListInputUsageExample } from "./sortable-list-input";
import { resolveToolWidgetValueType, type ToollUIRow, type ToolUIWidget as ToolUiWidgetEntity, type ToolUIWidgetMode } from "~/entity/tool";
import { TextInput, TextInputOutputValueResolver, TextInputProps, TextInputUsageExample } from "./text-input";
import { WaveformPlaylistInput, WaveformPlaylistInputOutputValueResolver, WaveformPlaylistInputProps, WaveformPlaylistInputUsageExample } from "./waveform-playlist-input";
// Updated factory function signature with value and onChange parameters

export interface WidgetValueCollectorInf<T = any> {
  getValue(): T;
  /** Set value programmatically and trigger re-render, without calling onChange */
  setValue(value: T): void;
}

// Use `any` for value/onChange/props to allow components with specific types to be assigned.
// strictFunctionTypes requires contravariant parameter types, so `unknown` or `Record<string, unknown>`
// would reject components that expect narrower types.
export type ToolInputComponentFactoryDef = (
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: any) => void,
  widgetValueCollecterRef: RefObject<WidgetValueCollectorInf<any> | undefined>,
  props?: any,
) => ReactNode;
export interface ToolUIWidget {
  id     : string;
  title  : string;
  mode   : ToolUIWidgetMode;
  type   : ToolInputType;
  props? : Record<string, unknown>;
  factory: ToolInputComponentFactoryDef;
}

export const ToolInputType = z.enum([
  "SelectListInput",
  "TextareaInput",
  "ToggleInput",
  "SliderInput",
  "FileUploadInput",
  "FilesUploadInput",
  "TextInput",
  "NumberInput",
  "RadioGroupInput",
  "ColorInput",
  "ColorPickerInput",
  "TagInput",
  "ButtonInput",
  "LabelInput",
  "RawHtmlInput",
  "DividerInput",
  "ProgressBarInput",
  "MultiTextInput",
  "SortableListInput",
  "WaveformPlaylistInput",
]);
export type ToolInputType = z.infer<typeof ToolInputType>;
export const ToolInputTypeUiComponentInfoConvertMap: Record<ToolInputType, {
  propsSchema       : z.ZodObject<any>;
  uiComponentFactory: ToolInputComponentFactoryDef;
  defaultValue?     : unknown;
}> = {
  SelectListInput      : { propsSchema: SelectListInputProps, uiComponentFactory: SelectListInput },
  TextareaInput        : { propsSchema: TextareaInputProps, uiComponentFactory: TextareaInput},
  ToggleInput          : { propsSchema: ToggleInputProps, uiComponentFactory: ToggleInput},
  SliderInput          : { propsSchema: SliderInputProps, uiComponentFactory: SliderInput},
  FileUploadInput      : { propsSchema: FileUploadInputProps, uiComponentFactory: FileUploadInput},
  FilesUploadInput     : { propsSchema: FilesUploadInputProps, uiComponentFactory: FilesUploadInput},
  TextInput            : { propsSchema: TextInputProps, uiComponentFactory: TextInput},
  NumberInput          : { propsSchema: NumberInputProps, uiComponentFactory: NumberInput},
  RadioGroupInput      : { propsSchema: RadioGroupInputProps, uiComponentFactory: RadioGroupInput},
  ColorInput           : { propsSchema: ColorInputProps, uiComponentFactory: ColorInput},
  ColorPickerInput     : { propsSchema: ColorPickerInputProps, uiComponentFactory: ColorPickerInput},
  TagInput             : { propsSchema: TagInputProps, uiComponentFactory: TagInput},
  ButtonInput          : { propsSchema: ButtonInputProps, uiComponentFactory: ButtonInput},
  LabelInput           : { propsSchema: LabelInputProps, uiComponentFactory: LabelInput},
  RawHtmlInput         : { propsSchema: RawHtmlInputProps, uiComponentFactory: RawHtmlInput},
  DividerInput         : { propsSchema: DividerInputProps, uiComponentFactory: DividerInput},
  ProgressBarInput     : { propsSchema: ProgressBarInputProps, uiComponentFactory: ProgressBarInput},
  MultiTextInput       : { propsSchema: MultiTextInputProps, uiComponentFactory: MultiTextInput},
  SortableListInput    : { propsSchema: SortableListInputProps, uiComponentFactory: SortableListInput},
  // Waveform playlist provides an audio preview and download-friendly output payload.
  WaveformPlaylistInput: { propsSchema: WaveformPlaylistInputProps, uiComponentFactory: WaveformPlaylistInput},
};

export type ToolInputTypeOutputSchemaResolver = (widget?: Record<string, unknown>) => z.ZodTypeAny;

export const ToolInputTypeOutputSchemaMap: Record<ToolInputType, ToolInputTypeOutputSchemaResolver> = {
  SelectListInput      : SelectListInputOutputValueResolver,
  TextareaInput        : TextareaInputOutputValueResolver,
  ToggleInput          : ToggleInputOutputValueResolver,
  SliderInput          : SliderInputOutputValueResolver,
  FileUploadInput      : FileUploadInputOutputValueResolver,
  FilesUploadInput     : FilesUploadInputOutputValueResolver,
  TextInput            : TextInputOutputValueResolver,
  NumberInput          : NumberInputOutputValueResolver,
  RadioGroupInput      : RadioGroupInputOutputValueResolver,
  ColorInput           : ColorInputOutputValueResolver,
  ColorPickerInput     : ColorPickerInputOutputValueResolver,
  TagInput             : TagInputOutputValueResolver,
  ButtonInput          : ButtonInputOutputValueResolver,
  LabelInput           : LabelInputOutputValueResolver,
  RawHtmlInput         : RawHtmlInputOutputValueResolver,
  DividerInput         : DividerInputOutputValueResolver,
  ProgressBarInput     : ProgressBarInputOutputValueResolver,
  MultiTextInput       : MultiTextInputOutputValueResolver,
  SortableListInput    : SortableListInputOutputValueResolver,
  WaveformPlaylistInput: WaveformPlaylistInputOutputValueResolver,
};

// Widget guide metadata for the UI reference panel.
export interface WidgetGuideItem {
  name       : string;
  description: string;
  widget     : ToolUiWidgetEntity;
}

// Centralized examples so the guide panel can reuse them without importing each widget file.
export const WidgetGuideItems: WidgetGuideItem[] = [
  TextInputUsageExample,
  NumberInputUsageExample,
  RadioGroupInputUsageExample,
  SelectListInputUsageExample,
  SliderInputUsageExample,
  ToggleInputUsageExample,
  ColorInputUsageExample,
  ColorPickerInputUsageExample,
  TextareaInputUsageExample,
  FileUploadInputUsageExample,
  FilesUploadInputUsageExample,
  TagInputUsageExample,
  ButtonInputUsageExample,
  LabelInputUsageExample,
  RawHtmlInputUsageExample,
  DividerInputUsageExample,
  ProgressBarInputUsageExample,
  MultiTextInputUsageExample,
  SortableListInputUsageExample,
  // Waveform playlist shows audio upload + preview behavior in the guide panel.
  WaveformPlaylistInputUsageExample,
];

// Build markdown for the UI widgets reference panel based on the centralized examples.
export function buildUiWidgetsReferenceMarkdown(baseSectionLevel = 1) {
  const normalizedBaseLevel = Math.max(1, Math.floor(baseSectionLevel));
  const basePrefix = "#".repeat(normalizedBaseLevel);
  const itemPrefix = "#".repeat(normalizedBaseLevel + 1);
  // Base section level controls the heading depth of the reference block.
  const blocks = WidgetGuideItems.map((item) => {
    return `${itemPrefix} ${item.name}
${item.description}
\`\`\`json
${JSON.stringify(item.widget, null, 2)}
\`\`\`

Handler output
\`\`\`ts
${buildWidgetOutputTypeJsonExample(item.widget)}
\`\`\``;
  });
  return [
    `${basePrefix} uiWidgets object reference`,
    ...blocks
  ].join("\n\n");
}

// Build a handler-return snippet that highlights the output payload expected by each widget.
export function buildWidgetOutputTypeJsonExample(widget: ToolUiWidgetEntity) {
  const outputType = resolveToolWidgetValueType(widget);
  return `{\n  "${widget.id}": ${outputType};\n}`;
}

/**
 * Build Docusaurus-flavored markdown for the UI widgets documentation site.
 * Uses Tabs/TabItem components for sample object and handler output.
 * @param baseSectionLevel - The heading depth for widget titles (default 3 for ###)
 */
export function buildUiWidgetsDocusaurusMarkdown(baseSectionLevel = 3) {
  const normalizedBaseLevel = Math.max(1, Math.floor(baseSectionLevel));
  const itemPrefix = "#".repeat(normalizedBaseLevel);
  const blocks = WidgetGuideItems.map((item) => {
    const sampleJson = JSON.stringify(item.widget, null, 2);
    const outputJson = buildWidgetOutputTypeJsonExample(item.widget);
    const widgetType = item.widget.type;
    return `${itemPrefix} ${widgetType} (${item.name})

${item.description}

<Tabs>
<TabItem value="${widgetType}-sample-object" label="Sample object">
\`\`\`javascript
${sampleJson}
\`\`\`
</TabItem>
<TabItem value="${widgetType}-handler-output" label="Handler output">
\`\`\`typescript
${outputJson}
\`\`\`
</TabItem>
</Tabs>`;
  });
  return blocks.join("\n\n");
}
export function generateToolWidgets(rows: ToollUIRow[]): ToolUIWidget[][] {
  const toolsUiComponents: ToolUIWidget[][] = [];

  for (const [rowIndex, row] of rows.entries()) {
    const rowEntries = Array.isArray(row) ? row : [row];
    const convertedRow: ToolUIWidget[] = [];

    for (const [inputColIdx, inputMeta] of rowEntries.entries()) {
      // the meta info of input widget
      const id = inputMeta.id;
      const title = inputMeta.title;
      const type = inputMeta.type;
      const props = inputMeta.props;
      const mode = inputMeta.mode ?? "input";

      // get react ui component info by type string
      const toolInputInfo = ToolInputTypeUiComponentInfoConvertMap[type];
      if (!toolInputInfo) {
        throw new Error(`Unknown input type for input tool: row: ${rowIndex}, col: ${inputColIdx} type: ${type} title: ${inputMeta.title}`);
      }

      // validate props if correct
      const validateResult = toolInputInfo.propsSchema.safeParse(inputMeta.props ?? {});
      if (!validateResult.success) {
        // todo: let zod's error formatter prettier the error message
        throw new Error(`Invalid props for input tool: row: ${rowIndex}, col: ${inputColIdx} type: ${type} title: ${inputMeta.title} props: ${JSON.stringify(inputMeta.props)} - ${validateResult.error.message}`);
      }
      // call the react component factory
      const descriptor: ToolUIWidget = {
        id,
        title,
        mode,
        type,
        props  : validateResult.data,
        factory: toolInputInfo.uiComponentFactory,
      };
      convertedRow.push(descriptor);
    }
    toolsUiComponents.push(convertedRow);
  }
  return toolsUiComponents;
};
