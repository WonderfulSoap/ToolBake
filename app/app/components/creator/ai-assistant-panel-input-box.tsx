import { useRef, useState, useCallback } from "react";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

type SendMode = "enter" | "ctrl+enter";

// Max image size: 3MB
const MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Send handler interface for parent-child communication via ref. */
export interface ChatSendHandler {
  /** Called when user triggers send. Parent implements this to process the message. */
  send: (text: string, images: string[]) => void;
}

export interface ChatInputBoxProps {
  /** Ref containing the send handler. Parent sets ref.current to provide send implementation. */
  sendHandlerRef: React.MutableRefObject<ChatSendHandler | null>;
  /** Whether the input is disabled (e.g., during loading). */
  disabled?     : boolean;
  /** Status message shown in footer (e.g., "Using gpt-4o"). */
  statusMessage?: string;
  /** Whether status indicates an error state. */
  statusError?  : boolean;
  /** Custom placeholder text. */
  placeholder?  : string;
}

/** Chat input box component with text input, image upload, and send controls. */
export function AiAssistantPanelInputBox({ sendHandlerRef, disabled = false, statusMessage, statusError = false, placeholder }: ChatInputBoxProps) {
  const [inputValue, setInputValue] = useState("");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [sendMode, setSendMode] = useState<SendMode>("ctrl+enter");
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = inputValue.trim().length > 0 || pendingImages.length > 0;
  const isSendDisabled = !hasContent || disabled;

  // Process image files and convert to base64. Returns array of valid base64 data URIs.
  const processImageFiles = useCallback(async (files: FileList | File[]): Promise<string[]> => {
    const results: string[] = [];
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        alert(`"${file.name}" is not a supported format. Only PNG, JPG, and WebP are allowed.`);
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        alert(`Image "${file.name}" exceeds 3MB limit and was skipped.`);
        continue;
      }
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      results.push(base64);
    }
    return results;
  }, []);

  // Handle file input change for upload button.
  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newImages = await processImageFiles(files);
    if (newImages.length > 0) setPendingImages((prev) => [...prev, ...newImages]);
    e.target.value = ""; // Reset input to allow selecting the same file again.
  }

  // Handle paste event to capture images from clipboard.
  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (ALLOWED_IMAGE_TYPES.includes(item.type)) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;
    e.preventDefault();
    const newImages = await processImageFiles(imageFiles);
    if (newImages.length > 0) setPendingImages((prev) => [...prev, ...newImages]);
  }

  // Handle drag over event.
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  // Handle drag leave event.
  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  // Handle drop event to capture dragged images.
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const newImages = await processImageFiles(files);
    if (newImages.length > 0) setPendingImages((prev) => [...prev, ...newImages]);
  }

  // Remove a pending image by index.
  function removePendingImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  // Trigger send action and clear input.
  function doSend() {
    if (isSendDisabled) return;
    const text = inputValue.trim();
    const images = [...pendingImages];
    setInputValue("");
    setPendingImages([]);
    // Call parent's send handler via ref.
    sendHandlerRef.current?.send(text, images);
  }

  // Handle keyboard shortcuts for sending.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter") return;
    const shouldSend = sendMode === "enter" ? !e.ctrlKey && !e.metaKey : (e.ctrlKey || e.metaKey);
    if (shouldSend) {
      e.preventDefault();
      doSend();
    }
  }

  return (
    <>
      <div
        className={cn("rounded-lg border bg-background p-3 space-y-3 transition-colors", isDragOver ? "border-primary bg-primary/5" : "border-border")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => { void handleDrop(e); }}
      >
        {/* Pending images preview */}
        {pendingImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img src={img} alt={`pending ${idx + 1}`} className="h-14 w-14 object-cover rounded border border-border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPreviewImage(img)} />
                <button
                  type="button"
                  className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none pb-px"
                  onClick={() => removePendingImage(idx)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <Textarea
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={(e) => { void handlePaste(e); }}
          className="text-sm font-normal normal-case min-h-[96px] resize-y"
          placeholder={isDragOver ? "Drop images here..." : (placeholder ?? "Describe what you want to build... (paste or drag images)")}
        />
        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
          className="hidden"
          onChange={(e) => { void handleFileInputChange(e); }}
        />
        <div className="flex items-center justify-between gap-4">
          <span className={cn("text-[11px]", statusError ? "text-destructive" : "text-muted-foreground")}>
            {statusMessage ?? ""}
          </span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} title="Upload images (PNG, JPG, WebP)">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15M17 8L12 3M12 3L7 8M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
            <Button size="sm" onClick={doSend} disabled={isSendDisabled}>
              {disabled ? "Sending..." : "Send"}
            </Button>
            <Popover open={sendMenuOpen} onOpenChange={setSendMenuOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="px-1.5" disabled={disabled}>
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-1">
                <button
                  className={cn("flex w-full items-center gap-2 rounded px-3 py-1.5 text-xs hover:bg-muted", sendMode === "enter" && "bg-muted")}
                  onClick={() => { setSendMode("enter"); setSendMenuOpen(false); }}
                >
                  <span className="w-4">{sendMode === "enter" ? "✓" : ""}</span>
                  <span>Enter to send</span>
                </button>
                <button
                  className={cn("flex w-full items-center gap-2 rounded px-3 py-1.5 text-xs hover:bg-muted", sendMode === "ctrl+enter" && "bg-muted")}
                  onClick={() => { setSendMode("ctrl+enter"); setSendMenuOpen(false); }}
                >
                  <span className="w-4">{sendMode === "ctrl+enter" ? "✓" : ""}</span>
                  <span>Ctrl+Enter to send</span>
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>
      {/* Image preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <DialogContent className="max-w-fit max-h-[90vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center [&>button]:hidden">
          {previewImage && (
            <div className="relative">
              <img src={previewImage} alt="preview" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
              <button
                type="button"
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors text-sm leading-none pb-0.5"
                onClick={() => setPreviewImage(null)}
              >
                ×
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
