import { Check, Copy } from "lucide-react";
import { cn } from "~/lib/utils";
import { useCallback, useEffect, useState } from "react";

interface CopyButtonProps {
  value?    : string;
  disabled? : boolean;
  className?: string;
  ariaLabel?: string;
}



export function useCopyToClipboard(text: string) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      console.warn("Failed to copy value", error);
    }
  }, [text]);

  useEffect(() => {
    if (!copied || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  return { copied, copy };
}



// Copy control that forwards the click handler from the clipboard hook.
export function CopyButton({
  value = "",
  disabled = false,
  className,
  ariaLabel = "Copy value",
}: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard(value);
  // Bridge async clipboard action into the void-returning click handler.
  function handleClick() {
    void copy();
  }
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-40",
        className
      )}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
