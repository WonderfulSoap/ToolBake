import { useCallback, useImperativeHandle, useRef, useState, type Ref } from "react";
import { cn } from "~/lib/utils";
import type { ToolExecutionStatus } from "~/entity/tool-log";

/** Delay before showing the indicator (ms). Fast executions won't trigger a visible flash. */
const SHOW_DELAY_MS = 300;

/** Imperative API for ExecutionIndicator */
export interface ExecutionIndicatorHandle {
  setStatus: (status: ToolExecutionStatus) => void;
}

interface ExecutionIndicatorProps {
  ref?: Ref<ExecutionIndicatorHandle>;
}

/**
 * Displays a visual indicator showing tool execution status.
 * - Running: animated indeterminate progress bar (only shown after SHOW_DELAY_MS)
 * - Success/Error: brief color flash then hide (only if indicator was already visible)
 * - Idle: hidden
 */
export function ExecutionIndicator({ ref }: ExecutionIndicatorProps) {
  const [visible, setVisible] = useState(false);
  const [displayStatus, setDisplayStatus] = useState<ToolExecutionStatus>("idle");
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(false); // Track visible state synchronously for setStatus calls

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    setStatus: (status: ToolExecutionStatus) => {
      if (status === "running") {
        clearTimers();
        // Delay showing the indicator to avoid flashing for fast executions
        showTimerRef.current = setTimeout(() => {
          visibleRef.current = true;
          setVisible(true);
          setDisplayStatus("running");
        }, SHOW_DELAY_MS);
      } else if (status === "success" || status === "error") {
        clearTimers();
        // Only show final status if indicator was already visible
        if (visibleRef.current) {
          setDisplayStatus(status);
          hideTimerRef.current = setTimeout(() => {
            visibleRef.current = false;
            setVisible(false);
          }, 800);
        }
      } else {
        clearTimers();
        visibleRef.current = false;
        setVisible(false);
      }
    },
  }), [clearTimers]);

  return (
    <div
      className={cn(
        "h-1 w-full overflow-hidden transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className={cn(
          "h-full",
          displayStatus === "running" && "bg-primary/80 animate-indeterminate-progress",
          displayStatus === "success" && "bg-emerald-500 w-full",
          displayStatus === "error" && "bg-destructive w-full"
        )}
      />
    </div>
  );
}
