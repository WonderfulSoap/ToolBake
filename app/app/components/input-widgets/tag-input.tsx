import { type KeyboardEvent, type RefObject, useImperativeHandle, useRef, useState } from "react";
import { X } from "lucide-react";
import { z } from "zod";
import { cn } from "~/lib/utils";
import { SafeHtml } from "./common-components/safe-html";
import type { ToolUIWidgetMode } from "~/entity/tool";
import type { WidgetGuideItem } from "./input-types";
import type { WidgetValueCollectorInf } from "./input-types";

export const TagInputProps = z.object({
  defaultValue: z.array(z.string()).optional(),
  placeholder : z.string().optional(),
  maxTags     : z.number().optional(),
  width       : z.string().optional(),
});
export type TagInputProps = z.infer<typeof TagInputProps>;
export const TagInputOutputValue = z.array(z.string());
export type TagInputOutputValue = z.infer<typeof TagInputOutputValue>;

export function TagInputOutputValueResolver(): z.ZodTypeAny {
  return TagInputOutputValue;
}

export const TagInputUsageExample: WidgetGuideItem = {
  name       : "Tag Input",
  description: "Collect multiple free-form keywords with optional cap.",
  widget     : {
    id   : "guide-tag-input",
    type : "TagInput",
    title: "Tag Keywords",
    mode : "input",
    props: {
      placeholder: "Add keywords and press Enter",
      maxTags    : 6,
    },
  },
};

export function TagInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: TagInputOutputValue) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<TagInputOutputValue> | undefined>,
  props?: TagInputProps
) {
  const {
    placeholder = "Press Enter to add tag",
    maxTags,
    width,
    defaultValue,
  } = TagInputProps.parse(props ?? {});
  // Initial value is empty array, parent will call setValue() to set the value
  const [tags, setTags] = useState<string[]>([]);
  // Ref to store real-time tags value for getValue()
  const tagsRef = useRef<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOutputMode = mode === "output";
  const atLimit = typeof maxTags === "number" ? tags.length >= maxTags : false;
  const showInput = !isOutputMode && !atLimit;

  // Expose getValue reading from ref for real-time value
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => tagsRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: TagInputOutputValue) => {
      const normalized = Array.isArray(newValue) ? newValue : [];
      tagsRef.current = normalized;
      setTags(normalized);
    },
  }), []);

  function commit(nextTags: string[]) {
    setTags(nextTags);
    tagsRef.current = nextTags;
    onChange(id, nextTags);
  }

  function addTag() {
    const input = inputRef.current;
    if (!input) return;
    const trimmed = input.value.trim();
    if (!trimmed || tags.includes(trimmed) || atLimit) return;
    commit([...tags, trimmed]);
    input.value = "";
  }

  function removeTag(tag: string) {
    if (isOutputMode) return;
    const nextTags = tags.filter((entry) => entry !== tag);
    commit(nextTags);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isOutputMode) return;
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
      return;
    }
    if (event.key === "Backspace" && inputRef.current?.value === "" && tags.length) {
      event.preventDefault();
      commit(tags.slice(0, -1));
    }
  }

  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label
          htmlFor={id}
          className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
        >
          <SafeHtml html={title} />
        </label>
        {typeof maxTags === "number" && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {tags.length}/{maxTags}
          </span>
        )}
      </div>
      <div
        className={cn(
          "flex h-10 flex-wrap items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-xs focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/40",
          isOutputMode && "bg-muted/50"
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
          >
            {tag}
            {!isOutputMode && (
              <button
                type="button"
                className="text-primary/70 transition-colors hover:text-primary"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        {showInput ? (
          <input
            ref={inputRef}
            id={id}
            type="text"
            className="flex-1 border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            placeholder={tags.length === 0 ? placeholder : undefined}
            onKeyDown={handleKeyDown}
          />
        ) : (
          tags.length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              <SafeHtml html={placeholder} />
            </span>
          )
        )}
      </div>
      {atLimit && !isOutputMode && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Tag limit reached
        </p>
      )}
    </div>
  );
}
