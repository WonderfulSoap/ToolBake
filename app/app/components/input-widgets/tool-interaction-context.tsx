import { createContext, useContext, type ReactNode } from "react";

const ToolInteractionContext = createContext<boolean | undefined>(undefined);

interface ToolInteractionProviderProps {
  isInteractive?: boolean;
  children      : ReactNode;
}

export function ToolInteractionProvider({ isInteractive = true, children }: ToolInteractionProviderProps) {
  return (
    <ToolInteractionContext value={isInteractive}>
      {children}
    </ToolInteractionContext>
  );
}

export function useToolInteractionEnabled() {
  const value = useContext(ToolInteractionContext);
  return value ?? true;
}
