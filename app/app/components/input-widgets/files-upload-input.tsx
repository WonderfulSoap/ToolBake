import { useEffect, useRef, useState, useImperativeHandle, type RefObject, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import { z } from "zod";
import { Upload } from "lucide-react";
import type { ToolUIWidgetMode } from "~/entity/tool";
import { cn } from "~/lib/utils";
import type { WidgetGuideItem } from "./input-types";
import { SafeHtml } from "./common-components/safe-html";
import { useToolInteractionEnabled } from "./tool-interaction-context";
import type { WidgetValueCollectorInf } from "./input-types";

interface LocalFileSystemEntry {
  isFile     : boolean;
  isDirectory: boolean;
  fullPath?  : string;
}

interface LocalFileSystemFileEntry extends LocalFileSystemEntry {
  file: (success: (file: File) => void, error?: (err: DOMException) => void) => void;
}

interface LocalFileSystemDirectoryEntry extends LocalFileSystemEntry {
  createReader: () => {
    readEntries: (success: (entries: LocalFileSystemEntry[]) => void, error?: (err: DOMException) => void) => void;
  };
}

export const FilesUploadInputProps = z.object({
  description   : z.string().optional(),
  allowDirectory: z.boolean().optional(),
  mini          : z.boolean().optional(),
  width         : z.string().optional(),
});
export type FilesUploadInputProps = z.infer<typeof FilesUploadInputProps>;
export const FilesUploadInputOutputValue = z.array(z.instanceof(File)).nullable().describe("ExtendedFile[] | null");
export type FilesUploadInputOutputValue = z.infer<typeof FilesUploadInputOutputValue>;

export function FilesUploadInputOutputValueResolver(): z.ZodTypeAny {
  return FilesUploadInputOutputValue;
}

function normalizeEntryPath(path?: string) {
  if (!path) return undefined;
  return path.replace(/^\/+/, "");
}

function fileFromEntry(entry: LocalFileSystemFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file((file) => {
      const relativePath = normalizeEntryPath(entry.fullPath);
      if (relativePath) {
        (file as File & { relativePath?: string }).relativePath = relativePath;
      }
      resolve(file);
    }, reject);
  });
}

function readAllDirectoryEntries(directory: LocalFileSystemDirectoryEntry) {
  return new Promise<LocalFileSystemEntry[]>((resolve, reject) => {
    const reader = directory.createReader();
    const entries: LocalFileSystemEntry[] = [];
    function readBatch() {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    }
    readBatch();
  });
}

async function collectFilesFromEntry(entry: LocalFileSystemEntry): Promise<File[]> {
  // Resolve files recursively to keep drag-and-drop directory reads typed.
  if (entry.isFile) return [await fileFromEntry(entry as LocalFileSystemFileEntry)];
  if (entry.isDirectory) {
    const entries = await readAllDirectoryEntries(entry as LocalFileSystemDirectoryEntry);
    const nestedFiles = await Promise.all(entries.map((child) => collectFilesFromEntry(child)));
    return nestedFiles.flat();
  }
  return [];
}

function getWebkitEntry(item: DataTransferItem): LocalFileSystemEntry | null {
  // Normalize Chromium-only webkitGetAsEntry so TS stays happy across browsers.
  const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry?.();
  if (!entry) return null;
  // Cast FileSystemEntry to our local interface which omits unsupported fields.
  return entry as unknown as LocalFileSystemEntry;
}

export const FilesUploadInputUsageExample: WidgetGuideItem = {
  name       : "Files Upload",
  description: "Drag and drop multiple files. Or paste from clipboard to upload files. Set allowDirectory to enable folder selection (Chromium only).",
  widget     : {
    id   : "guide-files-input",
    type : "FilesUploadInput",
    title: "Attach Files",
    mode : "input",
    props: {
      description   : "Upload multiple files to process",
      allowDirectory: false,
    },
  },
};

export function FilesUploadInput(
  id: string,
  title: string,
  mode: ToolUIWidgetMode,
  onChange: (id: string, newValue: File[] | null) => void,
  collectValueRef: RefObject<WidgetValueCollectorInf<File[] | null> | undefined>,
  props?: FilesUploadInputProps
) {
  // Parse props with defaults to keep layout logic predictable.
  const { description = "Click to upload or drag and drop files here", allowDirectory = false, mini = false, width } =
    FilesUploadInputProps.parse(props ?? {});
  const [widgetValue, setWidgetValue] = useState<File[] | null>(null);
  // Use ref to keep the latest value for getValue().
  const widgetValueRef = useRef<File[] | null>(null);
  const isOutputMode = mode === "output";
  const isInteractive = useToolInteractionEnabled();
  const isReadOnly = isOutputMode || !isInteractive;
  const pasteTargetRef = useRef<HTMLLabelElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Sync native input when handler clears the value so users can re-select the same files.
    if (!widgetValue?.length && inputRef.current) inputRef.current.value = "";
  }, [widgetValue]);

  useEffect(() => {
    // Toggle directory selection attributes via DOM API to avoid non-standard JSX props.
    if (!inputRef.current) return;
    if (allowDirectory) {
      inputRef.current.setAttribute("webkitdirectory", "true");
      inputRef.current.setAttribute("directory", "true");
      return;
    }
    inputRef.current.removeAttribute("webkitdirectory");
    inputRef.current.removeAttribute("directory");
  }, [allowDirectory]);

  // Expose getValue method via collectValueRef.
  useImperativeHandle(collectValueRef, () => ({
    getValue: () => widgetValueRef.current,
    // Allow parent to set value without triggering onChange.
    setValue: (newValue: File[] | null) => {
      widgetValueRef.current = newValue;
      setWidgetValue(newValue);
    },
  }), []);

  function focusPasteTarget() {
    if (isReadOnly) return;
    pasteTargetRef.current?.focus();
  }

  function buildTimestampedName(name: string, index?: number) {
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const HH = String(now.getHours()).padStart(2, "0");
    const MM = String(now.getMinutes()).padStart(2, "0");
    const SS = String(now.getSeconds()).padStart(2, "0");
    let timeTag = `${yyyy}-${mm}-${dd} ${HH}-${MM}-${SS}`;
    if (index !== undefined) {
      timeTag += `-${index}`;
    }
    const dotIndex = name.lastIndexOf(".");
    if (dotIndex > 0) return `${name.slice(0, dotIndex)}-${timeTag}${name.slice(dotIndex)}`;
    return `${name}-${timeTag}`;
  }

  function buildFilesLabel(files: File[] | null) {
    if (!files?.length) return null;
    const names = files.map((file) => file.name).filter(Boolean);
    if (!names.length) return `${files.length} files selected`;
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  }

  function applyRelativePathFromSelection(files: File[]) {
    return files.map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
      if (!relativePath) return file;
      const withPath = file as File & { relativePath?: string };
      withPath.relativePath = relativePath;
      return file;
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (isReadOnly) {
      event.preventDefault();
      event.currentTarget.value = "";
      return;
    }
    const nextFiles = Array.from(event.target.files ?? []);
    const mappedFiles = allowDirectory ? applyRelativePathFromSelection(nextFiles) : nextFiles;
    const nextValue = mappedFiles.length ? mappedFiles : null;
    setWidgetValue(nextValue);
    widgetValueRef.current = nextValue;
    onChange(id, nextValue);
  }

  function handlePaste(event: ClipboardEvent<Element>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    const clipboard = event.clipboardData;
    if (!clipboard) return;

    const items = Array.from(clipboard.items ?? []);
    const files: File[] = [];

    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length === 0 && clipboard.files && clipboard.files.length > 0) {
      files.push(...Array.from(clipboard.files));
    }

    if (files.length > 0) {
      event.preventDefault();
      setWidgetValue(files);
      widgetValueRef.current = files;
      onChange(id, files);
      return;
    }

    const text = clipboard.getData("text/plain");
    if (text) {
      const fallbackName = buildTimestampedName("clipboard.txt");
      const textFile = new File([text], fallbackName, { type: "text/plain" });
      event.preventDefault();
      const nextValue = [textFile];
      setWidgetValue(nextValue);
      widgetValueRef.current = nextValue;
      onChange(id, nextValue);
    }
  }

  function handleDragEnter(event: DragEvent<HTMLLabelElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setIsDragging(true);
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

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    if (isReadOnly) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setIsDragging(false);
    const items = Array.from(event.dataTransfer.items ?? []);
    const entries = items.map((item) => getWebkitEntry(item)).filter((entry): entry is LocalFileSystemEntry => entry !== null);
    if (entries.length > 0) {
      void (async () => {
        const collected = await Promise.all(entries.map((entry) => collectFilesFromEntry(entry)));
        const files = collected.flat();
        if (!files.length) return;
        setWidgetValue(files);
        widgetValueRef.current = files;
        onChange(id, files);
      })();
      return;
    }
    const nextFiles = Array.from(event.dataTransfer.files ?? []);
    if (!nextFiles.length) return;
    setWidgetValue(nextFiles);
    widgetValueRef.current = nextFiles;
    onChange(id, nextFiles);
  }

  const helperText = buildFilesLabel(widgetValue);
  // Keep the mini variant compact by using a short label and a tooltip.
  const miniButtonText = helperText ? "Selected" : "Upload";
  return (
    <div
      className={cn("group", width && "flex-shrink-0")}
      style={width ? { width } : undefined}
      tabIndex={isReadOnly ? -1 : 0}
      onPaste={handlePaste}
    >
      <div className="flex justify-between mb-2">
        <label
          className="text-xs font-medium text-foreground group-hover:text-primary transition-colors"
        >
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
          else inputRef.current?.click(); // Keep a single click trigger to avoid double file dialogs.
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
            <span className="text-[11px] text-muted-foreground">Upload files or hover mouse here to paste</span>
          </>
        )}
      </label>
      <input
        type="file"
        multiple
        className="sr-only"
        onChange={handleFileChange}
        disabled={isReadOnly}
        ref={inputRef}
      />
    </div>
  );
}
