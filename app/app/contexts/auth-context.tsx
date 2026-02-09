import { createContext, useContext, useMemo, useState } from "react";
import { globalDI } from "~/di/global-di";

type AuthMode = "logined" | "local";

interface AuthContextValue {
  mode       : AuthMode;
  refreshMode: () => void;
  forceLogout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * AuthProvider manages only the authentication mode (logined/local).
 * User data, login, and logout operations are handled by React Query hooks (see app/hooks/use-auth.ts).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AuthMode>(() => globalDI.authHelper.getMode());

  // Refresh mode from authHelper (called after login/logout mutations)
  function refreshMode() {
    setMode(globalDI.authHelper.getMode());
  }

  // Force logout for global error handling (e.g., token expired)
  function forceLogout() {
    globalDI.authHelper.forceLogout();
    refreshMode();
  }

  const value = useMemo(
    () => ({
      mode,
      refreshMode,
      forceLogout,
    }),
    [mode]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within AuthProvider");
  return context;
}
