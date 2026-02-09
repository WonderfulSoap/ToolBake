import { useMemo, useState, type CSSProperties } from "react";
import { Badge } from "~/components/ui/badge";
import { CopyButton } from "~/components/input-widgets/common-components/copy-button";
import { ToolInputTypeUiComponentInfoConvertMap, WidgetGuideItems, buildWidgetOutputTypeJsonExample, buildUiWidgetsReferenceMarkdown, type WidgetGuideItem } from "~/components/input-widgets/input-types";
import { ToolInteractionProvider } from "~/components/input-widgets/tool-interaction-context";
import { cn } from "~/lib/utils";
import { type ToolUIWidget } from "~/entity/tool";

function renderWidgetPreview(widget: ToolUIWidget) {
  const config = ToolInputTypeUiComponentInfoConvertMap[widget.type];
  if (!config) return null;
  const props = config.propsSchema.parse(widget.props ?? {});
  // Render with empty onChange and dummy ref for preview
  const noop = () => {};
  const dummyRef = { current: undefined };
  return config.uiComponentFactory(widget.id, widget.title, widget.mode, noop, dummyRef, props);
}

function WidgetStructureSnippet({ widget }: { widget: ToolUIWidget }) {
  const snippet = useMemo(() => JSON.stringify(widget, null, 2), [widget]);
  return (
    <div className="relative rounded-md border border-border/70 bg-muted/40 pr-10">
      <CopyButton value={snippet} className="absolute right-1 top-1 h-6 w-6" ariaLabel={`Copy ${widget.type} example`} />
      <pre className="code-font whitespace-pre-wrap break-words text-[11px] leading-relaxed p-3">{snippet}</pre>
    </div>
  );
}

// Render a copyable snippet that documents the handler output payload for the widget.
function WidgetOutputSnippet({ widget }: { widget: ToolUIWidget }) {
  const snippet = useMemo(() => buildWidgetOutputTypeJsonExample(widget), [widget]);
  return (
    <div className="relative rounded-md border border-border/70 bg-muted/40 pr-10">
      <CopyButton value={snippet} className="absolute right-1 top-1 h-6 w-6" ariaLabel={`Copy ${widget.type} handler output`} />
      <pre className="code-font whitespace-pre-wrap break-words text-[11px] leading-relaxed p-3">{snippet}</pre>
    </div>
  );
}

function WidgetGuideCard({ item }: { item: WidgetGuideItem }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-3 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.widget.type}</p>
          <p className="text-sm font-medium text-foreground">{item.name}</p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-1">{item.description}</p>
        </div>
        <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider">
          {item.widget.mode}
        </Badge>
      </div>
      <div className="rounded-md border border-dashed border-border/80 bg-background/80 p-3">{renderWidgetPreview(item.widget)}</div>
      <WidgetStructureSnippet widget={item.widget} />
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Handler output</p>
        <WidgetOutputSnippet widget={item.widget} />
      </div>
    </div>
  );
}

export function UiWidgetsGuidePanel({ className, scrollStyle }: { className?: string; scrollStyle?: CSSProperties }) {
  const [isDocsVisible, setIsDocsVisible] = useState(false);
  const widgetDocsMarkdown = useMemo(() => {
    return buildUiWidgetsReferenceMarkdown();
  }, []);
  return (
    <ToolInteractionProvider isInteractive={false}>
      <div className={cn("w-[360px] flex-shrink-0 border-l border-border bg-muted/20 flex flex-col min-h-0 h-full", className)}>
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">uiWidgets reference</p>
            <button
              type="button"
              className="text-[11px] text-muted-foreground hover:text-foreground transition"
              onClick={() => setIsDocsVisible((prev) => !prev)}
            >
              Markdown
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Each object goes inside the <code className="font-mono text-[11px]">uiWidgets</code> array. Wrap multiple widgets in an inner array to render columns.
          </p>
        </div>
        {isDocsVisible && (
          <div className="border-b border-border/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Markdown</p>
              <CopyButton value={widgetDocsMarkdown} className="h-6 w-6" ariaLabel="Copy uiWidgets markdown" />
            </div>
            <pre className="code-font max-h-72 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed">
              {widgetDocsMarkdown}
            </pre>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 overscroll-contain touch-pan-y" style={scrollStyle}>
          {WidgetGuideItems.map((item) => (
            <WidgetGuideCard key={item.widget.id} item={item} />
          ))}
        </div>
      </div>
    </ToolInteractionProvider>
  );
}
