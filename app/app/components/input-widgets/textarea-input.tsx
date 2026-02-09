import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type ChangeEvent, type RefObject, type UIEvent } from "react";
import { z } from "zod";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { CopyButton } from "./common-components/copy-button";
import { SafeHtml, stripHtmlToText } from "./common-components/safe-html";
import type { WidgetGuideItem, WidgetValueCollectorInf } from "./input-types";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { useThemeContext } from "~/contexts/theme-context";
import { getSingletonHighlighter, type Highlighter } from "shiki/bundle/web";

let shikiHighlighterPromise: Promise<Highlighter> | null = null;
const shikiLoadedLanguages = new Set<string>();

function getShikiHighlighter() {
  if (!shikiHighlighterPromise) {
    shikiHighlighterPromise = getSingletonHighlighter({ themes: ["github-light", "andromeeda"] });
  }
  return shikiHighlighterPromise;
}

async function ensureShikiLanguage(highlighter: Highlighter, language: string) {
  if (shikiLoadedLanguages.has(language)) return;
  await highlighter.loadLanguage(language as any);
  shikiLoadedLanguages.add(language);
}

function resolveHighlightLanguage(value?: string) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.startsWith("highlight:")) {
    const language = normalized.slice("highlight:".length).trim();
    return language.length ? language : null;
  }
  return normalized;
}

export const TextareaInputProps = z.object({
  placeholder : z.string().optional(),
  defaultValue: z.string().optional(),
  rows        : z.number().optional(),
  className   : z.string().optional(),
  width       : z.string().optional(),
  highlight   : z.string().optional(),
});
export type TextareaInputProps = z.infer<typeof TextareaInputProps>;
export const TextareaInputOutputValue = z.string();
export type TextareaInputOutputValue = z.infer<typeof TextareaInputOutputValue>;

export function TextareaInputOutputValueResolver(): z.ZodTypeAny {
  return TextareaInputOutputValue;
}

export const TextareaInputUsageExample: WidgetGuideItem = {
  name       : "Textarea",
  description: "Multi-line editor for descriptions, logs, or snippets. Supports syntax highlighting. set $.props.highlight to 'highlight:language' to enable.",
  widget     : {
    id   : "guide-textarea-input",
    type : "TextareaInput",
    title: "Operator Notes",
    mode : "input",
    props: {
      placeholder: "Document procedures, shortcuts, or caution items...",
      rows       : 6,
      highlight  : "",
    },
  },
};

export function TextareaInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: string) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<string> | undefined>,
  props?: TextareaInputProps
) {
  const { placeholder, defaultValue, rows = 7, className, width, highlight } = TextareaInputProps.parse(props ?? {});
  // Initial value from props.defaultValue, subsequent updates via setValue()
  const [widgetValue, setWidgetValue] = useState<string>(defaultValue ?? "");
  // Use ref to track the latest value synchronously for getValue()
  const valueRef = useRef<string>(defaultValue ?? "");
  const isOutputMode = mode === "output";
  const titleText = stripHtmlToText(title);
  const uniqueId = useId();
  const { theme } = useThemeContext();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const [highlightHtml, setHighlightHtml] = useState("");
  const [textareaSizing, setTextareaSizing] = useState<{ height: number; minHeight: number } | null>(null);
  const highlightLanguage = useMemo(() => resolveHighlightLanguage(highlight), [highlight]);
  const shouldHighlight = !!highlightLanguage;

  // Expose getValue/setValue methods via collectValueRef
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => valueRef.current,
    setValue: (newValue: string) => {
      valueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  function syncHighlightScroll(scrollLeft: number, scrollTop: number) {
    const highlightNode = highlightRef.current;
    if (!highlightNode) return;
    highlightNode.style.transform = `translate(${-scrollLeft}px, ${-scrollTop}px)`;
  }

  function handleScroll(event: UIEvent<HTMLTextAreaElement>) {
    syncHighlightScroll(event.currentTarget.scrollLeft, event.currentTarget.scrollTop);
  }

  useEffect(() => {
    if (!highlightLanguage) {
      setHighlightHtml("");
      return;
    }
    const language = highlightLanguage;
    let cancelled = false;
    async function updateHighlight() {
      try {
        const highlighter = await getShikiHighlighter();
        await ensureShikiLanguage(highlighter, language);
        const html = highlighter.codeToHtml(widgetValue, { lang: language, theme: theme === "dark" ? "andromeeda" : "github-light" });
        if (!cancelled) setHighlightHtml(html);
      } catch (error) {
        if (!cancelled) setHighlightHtml("");
        console.warn("Failed to highlight textarea content", error);
      }
    }
    void updateHighlight();
    return () => { cancelled = true; };
  }, [widgetValue, highlightLanguage, theme]);

  useEffect(() => {
    if (!shouldHighlight || !textareaRef.current) return;
    syncHighlightScroll(textareaRef.current.scrollLeft, textareaRef.current.scrollTop);
  }, [highlightHtml, shouldHighlight]);

  useEffect(() => {
    if (!shouldHighlight || !textareaRef.current) {
      setTextareaSizing(null);
      return;
    }
    // Track textarea resizing so the highlight overlay keeps the same height and minimum height.
    const textareaNode = textareaRef.current;
    let minHeight = 0;
    function updateSizing() {
      const height = Math.max(0, textareaNode.getBoundingClientRect().height);
      if (!minHeight) minHeight = height;
      setTextareaSizing({ height, minHeight });
    }
    updateSizing();
    const observer = new ResizeObserver(updateSizing);
    observer.observe(textareaNode);
    return () => observer.disconnect();
  }, [shouldHighlight]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value;
    valueRef.current = nextValue;
    setWidgetValue(nextValue);
    onChange(id, nextValue);
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label
          htmlFor={uniqueId}
          className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
        >
          <SafeHtml html={title} />
        </label>
      </div>
      <div className="relative">
        {shouldHighlight && highlightHtml ? (
          <div
            className="textarea-highlight pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-md px-3 py-2 pr-12 text-base md:text-sm code-font"
            style={textareaSizing ? { height: textareaSizing.height, minHeight: textareaSizing.minHeight } : undefined}
          >
            {/* Match textarea right padding so wrapped lines align with overlay content. */}
            <div ref={highlightRef} dangerouslySetInnerHTML={{ __html: highlightHtml }} />
          </div>
        ) : null}
        <Textarea
          id={uniqueId}
          ref={textareaRef}
          className={cn(
            // Enable bottom-right drag handle to resize height while keeping width stable.
            "code-font resize-y pr-12 relative z-10",
            shouldHighlight && "text-transparent caret-foreground",
            isOutputMode && "bg-muted/40 border-dashed ring-1 ring-muted-foreground/20",
            className
          )}
          style={shouldHighlight && textareaSizing ? { minHeight: textareaSizing.minHeight } : undefined}
          placeholder={placeholder}
          value={widgetValue}
          readOnly={isOutputMode}
          aria-readonly={isOutputMode}
          onChange={isOutputMode ? undefined : handleChange}
          onScroll={shouldHighlight ? handleScroll : undefined}
          rows={rows}
        />
        <CopyButton
          value={widgetValue}
          // Keep the copy button above the textarea for reliable click handling.
          className="absolute top-2 right-2 z-20 h-7 w-7 border border-border bg-card/90 text-muted-foreground hover:bg-primary/10"
          ariaLabel={`Copy ${titleText}`}
          disabled={!widgetValue}
        />
      </div>
    </div>
  );
}
