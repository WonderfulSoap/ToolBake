import { useEffect, useRef, useState, useImperativeHandle, type RefObject, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import { z } from "zod";
import { Upload } from "lucide-react";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { cn } from "~/lib/utils";
import type { WidgetGuideItem } from "./input-types";
import { SafeHtml } from "./common-components/safe-html";
import { useToolInteractionEnabled } from "./tool-interaction-context";
import type { WidgetValueCollectorInf } from "./input-types";

// Guard for default file inputs without relying on browser-only globals at module load time.
function isFileLike(value: unknown): value is File | Blob | string {
  if (typeof value === "string") return true;
  if (typeof File !== "undefined" && value instanceof File) return true;
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  return false;
}

export const FileUploadInputProps = z.object({
  description    : z.string().optional(),
  mini           : z.boolean().optional(),
  width          : z.string().optional(),
  defaultFile    : z.custom<File | Blob | string>((value) => isFileLike(value)).optional(),
  defaultFilename: z.string().optional(),
});
export type FileUploadInputProps = z.infer<typeof FileUploadInputProps>;
export const FileUploadInputOutputValue = z.instanceof(File).nullable().describe("ExtendedFile | null");
export type FileUploadInputOutputValue = z.infer<typeof FileUploadInputOutputValue>;

export function FileUploadInputOutputValueResolver(): z.ZodTypeAny {
  return FileUploadInputOutputValue;
}

export const FileUploadInputUsageExample: WidgetGuideItem = {
  name       : "File Upload",
  description: "Drag and drop zone for optional supporting files. Or paste from clipboard. This component can be used to read content from clipboard.",
  widget     : {
    id   : "guide-file-input",
    type : "FileUploadInput",
    title: "Attach Blueprint",
    mode : "input",
    props: {
      description: "Upload diagrams or auxiliary configs",
      mini       : false,
    },
  },
};

export function FileUploadInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: File | null) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<File | null> | undefined>,
  props?: FileUploadInputProps
) {
  // Parse props with defaults to keep the render logic small and predictable.
  const { description = "Click to upload or drag and drop file here", mini = false, width } =
    FileUploadInputProps.parse(props ?? {});

  const isOutputMode = mode === "output";
  const isInteractive = useToolInteractionEnabled();
  const isReadOnly = isOutputMode || !isInteractive;
  // Initial value is null, parent will call setValue() to set the value
  const [widgetValue, setWidgetValue] = useState<File | null>(null);
  // Use ref to keep the latest value for getValue().
  const widgetValueRef = useRef<File | null>(null);
  const pasteTargetRef = useRef<HTMLLabelElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Sync native input when handler clears the value so users can re-select the same file.
  useEffect(() => {
    if (!widgetValue && inputRef.current) inputRef.current.value = "";
  }, [widgetValue]);

  // Expose getValue method via collectValueRef
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => widgetValueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: File | null) => {
      widgetValueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  function focusPasteTarget() {
    if (isReadOnly) return;
    pasteTargetRef.current?.focus();
  }

  function buildTimestampedName(name: string) {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const HH = String(now.getHours()).padStart(2, "0");
    const MM = String(now.getMinutes()).padStart(2, "0");
    const SS = String(now.getSeconds()).padStart(2, "0");
    const timeTag = `${yyyy}-${mm}-${dd} ${HH}-${MM}-${SS}`;
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex > 0) return `${name.slice(0, dotIndex)}-${timeTag}${name.slice(dotIndex)}`;
    return `${name}-${timeTag}`;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) {
      event.preventDefault();
      event.currentTarget.value = "";
      return;
    }
    const nextFile = event.target.files?.[0] ?? null;
    setWidgetValue(nextFile);
    widgetValueRef.current = nextFile;
    onChange(id, nextFile);
  }

  function handlePaste(event: ClipboardEvent<HTMLLabelElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    const clipboard = event.clipboardData;
    const nextFile = clipboard?.files?.[0] ?? null;
    if (!nextFile && clipboard) {
      const text = clipboard.getData("text/plain");
      if (text) {
        const fallbackName = buildTimestampedName("clipboard.txt");
        const textFile = new File([text], fallbackName, { type: "text/plain" });
        event.preventDefault();
        setWidgetValue(textFile);
        widgetValueRef.current = textFile;
        onChange(id, textFile);
      }
      return;
    }
    if (!nextFile) return;
    event.preventDefault();
    setWidgetValue(nextFile);
    widgetValueRef.current = nextFile;
    onChange(id, nextFile);
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setIsDragging(false);
    const nextFile = event.dataTransfer.files?.[0] ?? null;
    if (!nextFile) return;
    setWidgetValue(nextFile);
    widgetValueRef.current = nextFile;
    onChange(id, nextFile);
  }

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setIsDragging(false);
  }

  const helperText = widgetValue?.name;
  // Keep the mini variant compact by reducing text and relying on a tooltip for details.
  const miniButtonText = helperText ? "Selected" : "Upload";
  return (
    <div className={cn("group", width && "flex-shrink-0")} style={width ? { width } : undefined}>
      <div className="flex justify-between mb-2">
        <label className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
          <SafeHtml html={title} />
        </label>
      </div>
      <label
        ref={pasteTargetRef}
        className={cn(
          mini
            ? "border border-dashed border-border rounded-md h-8 px-2 inline-flex items-center justify-center gap-1 transition-all text-[11px] text-muted-foreground bg-card/30"
            : "border border-dashed border-border rounded-md p-4 flex flex-col items-center justify-center gap-2 transition-all group-hover:text-primary text-muted-foreground bg-card/30",
          isReadOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/50 hover:border-primary/50",
          isDragging && !isReadOnly && "bg-muted/60 border-primary/70 ring-1 ring-primary/40"
        )}
        aria-label={title}
        aria-readonly={isReadOnly}
        tabIndex={isReadOnly ? -1 : 0}
        title={mini ? helperText ?? description : undefined}
        onPaste={handlePaste}
        onMouseEnter={focusPasteTarget}
        onClick={(event) => {
          if (isReadOnly) event.preventDefault();
          else inputRef.current?.click();
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className={cn(mini ? "h-4 w-4" : "h-6 w-6 mb-1")} />
        {mini ? (
          <span className="font-medium">{miniButtonText}</span>
        ) : (
          <>
            <span className="text-xs">{helperText ?? <SafeHtml html={description} />}</span>
            <span className="text-[11px] text-muted-foreground">Upload a file or hover mouse here to paste</span>
          </>
        )}
      </label>
      <input
        type="file"
        className="sr-only"
        onChange={handleFileChange}
        disabled={isReadOnly}
        ref={inputRef}
      />
    </div>
  );
}
