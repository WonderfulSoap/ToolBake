import type { ToolUIRows } from "~/entity/tool";

export const defaultSandboxSource = `
/**
 * The jsdoc comment below describes the handler function signature. Don't remove it.
 * We will dynamically maintance the type definition of 'inputWidgets' and 'changedWidgetIds' based on uiWidgets you defined.
 * So that you can get strong type checking and code completion in the editor.
 * 
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widget-id"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * 
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  // do sometine
  console.log(messagePrefix, JSON.stringify(inputWidgets));
  console.log(messagePrefix, JSON.stringify(changedWidgetIds));
  return {};
}
`;

export const primaryUIWidgets: ToolUIRows = [
  {
    id   : "source-content",
    type : "TextareaInput",
    title: "Source Content",
    mode : "output",
    props: {
      placeholder: "Enter the log or text to process...",
      defaultValue:
        "{\"timestamp\": \"2023-10-27T10:00:00Z\", \"level\": \"ERROR\", \"message\": \"Database connection failed\"}",
    },
  },
  [
    {
      id   : "processing-mode",
      type : "SelectListInput",
      title: "Processing Mode",
      mode : "input",
      props: {
        defaultValue: "smart",
        placeholder : "Select mode",
        options     : [
          { value: "smart", label: "Smart Parse" },
          { value: "minify", label: "Minify Only" },
          { value: "yaml", label: "Convert to YAML" },
        ],
      },
    },
  ],
  [
    {
      id   : "strict-mode",
      type : "ToggleInput",
      title: "Strict Mode",
      mode : "input",
      props: {
        defaultChecked: true,
      },
    },
    {
      id   : "sampling-rate",
      type : "SliderInput",
      title: "Sampling Rate",
      mode : "input",
      props: {
        defaultValue: 75,
        max         : 100,
        step        : 1,
        valueSuffix : "%",
      },
    },
  ],
  {
    id   : "additional-config-file",
    type : "FileUploadInput",
    title: "Additional Config File (Optional)",
    mode : "input",
  },
];

export const showcaseUIWidgets: ToolUIRows = [
  [
    {
      id   : "showcase-text",
      type : "TextInput",
      title: "Context Label",
      mode : "input",
      props: {
        prefixLabel    : "Title",
        prefixLabelSize: "80px",
        placeholder    : "Team sync summary...",
        defaultValue   : "Alpha squad sync notes",
      },
    },
    {
      id   : "showcase-number",
      type : "NumberInput",
      title: "Batch Size",
      mode : "input",
      props: {
        prefixLabel : "Items",
        min         : 1,
        max         : 250,
        step        : 5,
        defaultValue: 25,
      },
    },
  ],
  [
    {
      id   : "showcase-radio",
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
    {
      id   : "showcase-select",
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
  ],
  [
    {
      id   : "showcase-slider",
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
    {
      id   : "showcase-toggle",
      type : "ToggleInput",
      title: "Realtime Sync",
      mode : "input",
      props: {
        defaultChecked: true,
        onLabel       : "Active",
      },
    },
  ],
  [
    {
      id   : "showcase-color",
      type : "ColorInput",
      title: "Accent Color",
      mode : "input",
      props: {
        defaultValue: "#0EA5E9",
      },
    },
  ],
  {
    id   : "showcase-textarea",
    type : "TextareaInput",
    title: "Operator Notes",
    mode : "input",
    props: {
      placeholder: "Document your procedure, keyboard shortcuts, or caution items...",
    },
  },
  {
    id   : "showcase-file",
    type : "FileUploadInput",
    title: "Attach Blueprint",
    mode : "input",
    props: {
      description: "Upload pipeline diagram or guidelines",
    },
  },
  {
    id   : "showcase-tags",
    type : "TagInput",
    title: "Tag Keywords",
    mode : "input",
    props: {
      placeholder: "Add keywords and press Enter",
      maxTags    : 6,
    },
  },
];
