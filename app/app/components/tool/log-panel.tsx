import { useMemo, useState, useImperativeHandle, type MouseEvent, type Ref } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "~/lib/utils";
import { useThemeContext } from "~/contexts/theme-context";
import type { ToolExecutionStatus, ToolLogEntry, ToolLogLevel } from "~/entity/tool-log";

// Expose imperative API for LogPanel
export interface LogPanelHandle {
  appendLog         : (level: ToolLogLevel, ...payload: unknown[]) => void;
  clearLogs         : () => void;
  setExecutionStatus: (status: ToolExecutionStatus) => void;
  setExpanded       : (expanded: boolean) => void;
}

// Helper function to create unique log IDs
let logCounter = 0;
function createLogId() {
  logCounter += 1;
  return `log-${Date.now()}-${logCounter}`;
}

const LEVEL_LABELS: Record<ToolLogLevel, string> = {
  log  : "LOG",
  info : "INFO",
  warn : "WARN",
  error: "ERROR",
  debug: "DEBUG",
};

const levelThemes: Record<
  "light" | "dark",
  Record<ToolLogLevel, { text: string; accent: string }>
> = {
  light: {
    log  : { text: "text-slate-600", accent: "bg-slate-400/60" },
    info : { text: "text-blue-600", accent: "bg-blue-500/40" },
    warn : { text: "text-amber-600", accent: "bg-amber-500/40" },
    error: { text: "text-red-600", accent: "bg-red-500/40" },
    debug: { text: "text-purple-600", accent: "bg-purple-500/40" },
  },
  dark: {
    log  : { text: "text-slate-200", accent: "bg-slate-500/40" },
    info : { text: "text-blue-300", accent: "bg-blue-500/20" },
    warn : { text: "text-amber-300", accent: "bg-amber-400/20" },
    error: { text: "text-red-300", accent: "bg-red-500/20" },
    debug: { text: "text-purple-300", accent: "bg-purple-500/20" },
  },
};

const STATUS_LABELS: Record<ToolExecutionStatus, string> = {
  idle   : "Not executed",
  running: "Running...",
  success: "Execution succeeded",
  error  : "Execution failed",
};

const statusThemes: Record<
  "light" | "dark",
  Record<ToolExecutionStatus, { text: string; accent: string }>
> = {
  light: {
    idle   : { text: "text-slate-600", accent: "bg-slate-300/60" },
    running: { text: "text-blue-600", accent: "bg-blue-500/40" },
    success: { text: "text-emerald-700", accent: "bg-emerald-500/40" },
    error  : { text: "text-red-700", accent: "bg-red-500/40" },
  },
  dark: {
    idle   : { text: "text-slate-200", accent: "bg-slate-500/30" },
    running: { text: "text-blue-300", accent: "bg-blue-500/25" },
    success: { text: "text-emerald-300", accent: "bg-emerald-500/25" },
    error  : { text: "text-red-300", accent: "bg-red-500/25" },
  },
};

function formatPayload(payload: unknown[]) {
  return payload
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "number" || typeof item === "boolean") return String(item);
      if (item instanceof Error) {
        const name = item.name || "Error";
        const message = item.message ? `${name}: ${item.message}` : name;
        if (item.stack) return item.stack.includes(item.message ?? "") ? item.stack : `${message}\n${item.stack}`;
        return message;
      }
      if (item === null) return "null";
      if (typeof item === "undefined") return "undefined";
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    })
    .join(" ");
}

interface LogPanelProps {
  ref?: Ref<LogPanelHandle>;
}

export function LogPanel({ ref }: LogPanelProps) {
  const { theme } = useThemeContext();
  const [logs, setLogs] = useState<ToolLogEntry[]>([]);
  const [executionStatus, setExecutionStatus] = useState<ToolExecutionStatus>("idle");
  const [isLogPanelExpanded, setIsLogPanelExpanded] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

  // Expose imperative methods via ref
  useImperativeHandle(ref, () => ({
    appendLog: (level: ToolLogLevel, ...payload: unknown[]) => {
      setLogs((previous) => [
        ...previous,
        {
          id       : createLogId(),
          level,
          payload,
          timestamp: Date.now(),
        },
      ]);
    },
    clearLogs: () => {
      setLogs([]);
      setExecutionStatus("idle");
    },
    setExecutionStatus: (status: ToolExecutionStatus) => {
      setExecutionStatus(status);
    },
    setExpanded: (expanded: boolean) => {
      setIsLogPanelExpanded(expanded);
    },
  }), []);

  function togglePanel() {
    setIsLogPanelExpanded(!isLogPanelExpanded);
  }

  const currentTheme = theme === "dark" ? "dark" : "light";
  const headerAccent = statusThemes[currentTheme][executionStatus];
  const statusLabel = STATUS_LABELS[executionStatus];

  const computedLogs = useMemo(() => logs, [logs]);
  const allExpanded = computedLogs.length > 0 && computedLogs.every((entry) => expandedEntries[entry.id]);

  function handleExpandAll(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (computedLogs.length === 0) {
      return;
    }
    if (allExpanded) {
      setExpandedEntries({});
      return;
    }
    const nextState: Record<string, boolean> = {};
    computedLogs.forEach((entry) => {
      nextState[entry.id] = true;
    });
    setExpandedEntries(nextState);
  }

  return (
    <div
      className={cn(
        "border-t border-border bg-background transition-all duration-300 ease-in-out flex flex-col z-20 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]",
        isLogPanelExpanded ? "h-64" : "h-7"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 cursor-pointer hover:bg-muted/50 transition-colors relative z-20",
          isLogPanelExpanded ? "h-9" : "h-7 py-0.5"
        )}
        onClick={togglePanel}
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-xs code-font text-muted-foreground">
            <div className={cn("w-2 h-2 rounded-full", headerAccent.accent)}></div>{" "}
            {statusLabel}
          </span>
        </div>
        <div className="text-muted-foreground text-xs flex items-center gap-2">
          <button
            type="button"
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            onClick={handleExpandAll}
          >
            {allExpanded ? "Collapse All" : "Expand All"}
          </button>
          <span
            className={cn(
              "mr-2 text-[10px] transition-opacity uppercase tracking-wider",
              !isLogPanelExpanded ? "opacity-0" : "opacity-100"
            )}
          >
            View Logs
          </span>
          <ChevronUp
            className={cn(
              "h-3 w-3 transition-transform duration-300",
              isLogPanelExpanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Content */}
      {isLogPanelExpanded ? (
        <div className="flex-1 bg-background p-3 overflow-y-auto code-font text-[11px] space-y-1 border-t border-border/50">
          {computedLogs.length === 0 ? (
            <div className="text-muted-foreground italic">No execution logs yet...</div>
          ) : (
            computedLogs.map((entry: ToolLogEntry) => {
              const palette = levelThemes[currentTheme][entry.level];
              const timestamp = new Date(entry.timestamp).toLocaleTimeString();
              const isExpanded = Boolean(expandedEntries[entry.id]);

              function toggleEntry() {
                setExpandedEntries((previous) => ({
                  ...previous,
                  [entry.id]: !previous[entry.id],
                }));
              }

              return (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-md px-2 py-1 border border-border/70 bg-muted/10 flex items-center gap-2",
                    palette.accent,
                    "leading-tight"
                  )}
                >
                  <span className={cn("text-[10px] font-semibold uppercase", palette.text)}>
                    {LEVEL_LABELS[entry.level]}
                  </span>
                  <span className="text-muted-foreground text-[10px]">{timestamp}</span>
                  <span
                    className={cn(
                      "flex-1 text-left",
                      palette.text,
                      isExpanded ? "whitespace-pre-wrap break-words" : "truncate whitespace-nowrap"
                    )}
                  >
                    {formatPayload(entry.payload)}
                  </span>
                  <button
                    type="button"
                    className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                    onClick={toggleEntry}
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
