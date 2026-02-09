import { ToolInputTypeOutputSchemaMap } from "~/components/input-widgets/input-types";
import type { ToolInputType } from "~/components/input-widgets/input-types";
import { zodSchemaToTs } from "~/lib/zod-schema-to-ts";
import { EMBEDDED_PACKAGES, getEmbeddedPackageDTsDef } from "~/config/embedded-packages";

export type ToolUIWidgetMode = "input" | "output";
export type ToolUIWidget = {
  id    : string;
  type  : ToolInputType;
  title : string;
  props?: Record<string, unknown>;

  mode: ToolUIWidgetMode
};

export type ToollUIRow = ToolUIWidget | ToolUIWidget[];
export type ToolUIRows = ToollUIRow[];
export type ToolWidgetMeta = { id: string; type: ToolInputType };

export interface Tool {
  id        : string;
  uid?      : string; // unique identifier for internal operations (update/delete)
  name      : string;
  namespace : string; // workspace grouping (e.g. WORKSPACE, WORKSPACE2)
  category? : string; // sub grouping within namespace
  isOfficial: boolean;
  isActive? : boolean;

  realtimeExecution?: boolean;

  description: string;
  extraInfo  : Record<string, string>;

  // definition of tool UI widgets
  uiWidgets: ToolUIRows;


  // tool code source
  source: string;
}


// Filter tools by matching all query terms against core metadata fields.
export function searchTools(tools: Tool[], query: string): Tool[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return tools;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  return tools.filter((tool) => {
    // Combine searchable fields to keep matching predictable and fast.
    const haystack = [tool.name, tool.description, tool.namespace, tool.category, tool.id, tool.uid]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}



export function cloneTool(tool: Tool): Tool {
  const cloneWidget = (widget: ToolUIWidget): ToolUIWidget => ({
    ...widget,
    props: widget.props ? { ...widget.props } : undefined,
  });
  const clonedUiWidgets: ToolUIRows = tool.uiWidgets.map((row) =>
    Array.isArray(row)
      ? row.map((widget) => cloneWidget(widget))
      : cloneWidget(row)
  );
  return {
    ...tool,
    uiWidgets: clonedUiWidgets,
  };
}

function collectToolWidgets(rows: ToolUIRows | undefined, predicate: (widget: ToolUIWidget) => boolean): ToolUIWidget[] {
  const widgets: ToolUIWidget[] = [];
  if (!rows?.length) return widgets;
  rows.forEach((row) => {
    if (Array.isArray(row)) row.forEach((widget) => { if (widget?.id && predicate(widget)) widgets.push(widget); });
    else if (row?.id && predicate(row)) widgets.push(row);
  });
  return widgets;
}

export function resolveToolWidgetValueType(widget: ToolUIWidget | ToolInputType) {
  // Handle both widget object and type string for backward compatibility
  const type = typeof widget === "string" ? widget : widget.type;
  const resolver = ToolInputTypeOutputSchemaMap[type];
  if (!resolver) return "unknown";
  // Call the resolver function with the widget object to get the schema
  const schema = typeof widget === "string" ? resolver() : resolver(widget);
  return zodSchemaToTs(schema);
}

export function buildToolHandlerDts(rows: ToolUIRows | undefined) {
  const widgets = collectToolWidgets(rows, (widget) => (widget.mode ?? "input") === "input");
  const allWidgets = collectToolWidgets(rows, () => true);
  const inputShape = widgets.length > 0 ? widgets.map((widget) => `  "${widget.id}": ${resolveToolWidgetValueType(widget)};`).join("\n") : "  [key: string]: unknown;";
  const allShape = allWidgets.length > 0 ? allWidgets.map((widget) => `  "${widget.id}": ${resolveToolWidgetValueType(widget)};`).join("\n") : "  [key: string]: unknown;";
  const union = widgets.length > 0 ? widgets.map(({ id }) => `"${id}"`).join(" | ") : "never";
  const embeddedPackagesUnion = Object.keys(EMBEDDED_PACKAGES).map(pkg => `"${pkg}"`).join(" | ");

  // Keep this template multi-line for readability; do not flatten into escaped newlines.
  return `// This readonly file is auto-generated from tool definition. 
// It will provide strong type checking and code completion for the handler editor.

type ExtendedFile = File & { relativePath?: string };

declare type InputUIWidgets = {
${inputShape}
};

declare type ChangedUIWidget = ${union};

declare type AllUIWidgets = {
${allShape}
};

declare type HandlerReturnWidgets = Partial<AllUIWidgets>;

declare type HandlerReturnValue = void | HandlerReturnWidgets | Promise<void | HandlerReturnWidgets>;

declare type HandlerCallback = (output: HandlerReturnValue) => void;

declare function handler(input: InputUIWidgets, widgetId: ChangedUIWidget, callback: HandlerCallback): HandlerReturnValue;

${getEmbeddedPackageDTsDef()};
`;
}
