import { createContext, useContext, useState, type ReactNode } from "react";
import type { Tool } from "~/entity/tool";

interface ActiveToolOverrideContextValue {
  /** Override tool to display in header (used by edit pages). */
  overrideTool: Tool | null;
  /** Set the override tool. Pass null to clear. */
  setOverrideTool: (tool: Tool | null) => void;
}

const ActiveToolOverrideContext = createContext<ActiveToolOverrideContextValue | null>(null);

interface ActiveToolOverrideProviderProps {
  children: ReactNode;
}

/**
 * Provider for overriding the active tool displayed in the header.
 * Used by edit pages to show the editing tool's current state instead of the saved version.
 */
export function ActiveToolOverrideProvider({ children }: ActiveToolOverrideProviderProps) {
  const [overrideTool, setOverrideTool] = useState<Tool | null>(null);
  return (
    <ActiveToolOverrideContext value={{ overrideTool, setOverrideTool }}>
      {children}
    </ActiveToolOverrideContext>
  );
}

/**
 * Hook to access the active tool override context.
 */
export function useActiveToolOverride() {
  const context = useContext(ActiveToolOverrideContext);
  if (!context) throw new Error("useActiveToolOverride must be used within ActiveToolOverrideProvider");
  return context;
}
