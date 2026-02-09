export type ToolLogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface ToolLogEntry {
  id       : string;
  level    : ToolLogLevel;
  timestamp: number;
  payload  : unknown[];
}

export type ToolExecutionStatus = "idle" | "running" | "success" | "error";
