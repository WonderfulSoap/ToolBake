import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ToolExecutionStatus, ToolLogEntry, ToolLogLevel } from "~/entity/tool-log";

interface ToolLogContextValue {
  logs                 : ToolLogEntry[];
  appendLog            : (level: ToolLogLevel, ...payload: unknown[]) => void;
  clearLogs            : () => void;
  executionStatus      : ToolExecutionStatus;
  setExecutionStatus   : (status: ToolExecutionStatus) => void;
  isLogPanelExpanded   : boolean;
  setIsLogPanelExpanded: (expanded: boolean) => void;
}

const ToolLogContext = createContext<ToolLogContextValue | null>(null);

let logCounter = 0;
function createLogId() {
  logCounter += 1;
  return `log-${Date.now()}-${logCounter}`;
}

interface ToolLogProviderProps {
  children        : ReactNode;
  defaultExpanded?: boolean;
  resetKey?       : string | number | null;
}

export function ToolLogProvider({ children, defaultExpanded = false, resetKey }: ToolLogProviderProps) {
  const [logs, setLogs] = useState<ToolLogEntry[]>([]);
  const [executionStatus, setExecutionStatus] = useState<ToolExecutionStatus>("idle");
  const [isLogPanelExpanded, setIsLogPanelExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (resetKey === undefined) return;
    setLogs([]);
    setExecutionStatus("idle");
    setIsLogPanelExpanded(defaultExpanded);
  }, [resetKey, defaultExpanded]);

  const appendLog = useCallback((level: ToolLogLevel, ...payload: unknown[]) => {
    setLogs((previous) => [
      ...previous,
      {
        id       : createLogId(),
        level,
        payload,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setExecutionStatus("idle");
  }, []);

  const contextValue = useMemo(
    () => ({
      logs,
      appendLog,
      clearLogs,
      executionStatus,
      setExecutionStatus,
      isLogPanelExpanded,
      setIsLogPanelExpanded,
    }),
    [logs, appendLog, clearLogs, executionStatus, isLogPanelExpanded]
  );

  return <ToolLogContext value={contextValue}>{children}</ToolLogContext>;
}

export function useToolLogContext() {
  const context = useContext(ToolLogContext);
  if (!context) {
    throw new Error("useToolLogContext must be used within ToolLogProvider");
  }
  return context;
}
