import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface ToastContextValue {
  /** Report an error. Pass undefined message to clear an error by source. */
  reportError  : (source: string, message?: string, error?: unknown, showPopup?: boolean) => void;
  /** Report a notice. Pass undefined message to clear a notice by source. */
  reportNotice : (source: string, message?: string) => void;
  /** Current error entries as [source, message] pairs */
  errorEntries : [string, string][];
  /** Current notice entries as [source, message] pairs */
  noticeEntries: [string, string][];
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Provider for global toast notifications (errors and notices).
 * Handles auto-dismiss timers and deduplication by source key.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Record<string, string>>({});
  const errorTimersRef = useRef<Record<string, number>>({});
  const noticeTimersRef = useRef<Record<string, number>>({});

  const reportError = useCallback((source: string, message?: string, error?: unknown, showPopup = true) => {
    if (message) {
      if (error) {
        console.error(`[GlobalError][${source}] ${message}`, error);
      } else {
        console.error(`[GlobalError][${source}] ${message}`);
      }
    }
    if (!showPopup) return;
    setErrors((prev) => {
      if (message) return { ...prev, [source]: message };
      if (!(source in prev)) return prev;
      const { [source]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  const reportNotice = useCallback((source: string, message?: string) => {
    setNotices((prev) => {
      if (message) return { ...prev, [source]: message };
      if (!(source in prev)) return prev;
      const { [source]: _removed, ...rest } = prev;
      return rest;
    });
  }, []);

  // Auto-dismiss errors after 10 seconds
  useEffect(() => {
    const timers = errorTimersRef.current;
    Object.keys(timers).forEach((key) => {
      if (key in errors) return;
      window.clearTimeout(timers[key]);
      delete timers[key];
    });
    Object.keys(errors).forEach((key) => {
      if (timers[key]) return;
      timers[key] = window.setTimeout(() => {
        setErrors((prev) => {
          if (!(key in prev)) return prev;
          const { [key]: _removed, ...rest } = prev;
          return rest;
        });
        delete timers[key];
      }, 10000);
    });
  }, [errors]);

  // Auto-dismiss notices after 5 seconds
  useEffect(() => {
    const timers = noticeTimersRef.current;
    Object.keys(timers).forEach((key) => {
      if (key in notices) return;
      window.clearTimeout(timers[key]);
      delete timers[key];
    });
    Object.keys(notices).forEach((key) => {
      if (timers[key]) return;
      timers[key] = window.setTimeout(() => {
        setNotices((prev) => {
          if (!(key in prev)) return prev;
          const { [key]: _removed, ...rest } = prev;
          return rest;
        });
        delete timers[key];
      }, 5000);
    });
  }, [notices]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(errorTimersRef.current).forEach((id) => window.clearTimeout(id));
      errorTimersRef.current = {};
      Object.values(noticeTimersRef.current).forEach((id) => window.clearTimeout(id));
      noticeTimersRef.current = {};
    };
  }, []);

  const errorEntries = useMemo(() => Object.entries(errors), [errors]);
  const noticeEntries = useMemo(() => Object.entries(notices), [notices]);

  const value = useMemo<ToastContextValue>(
    () => ({ reportError, reportNotice, errorEntries, noticeEntries }),
    [reportError, reportNotice, errorEntries, noticeEntries]
  );

  return <ToastContext value={value}>{children}</ToastContext>;
}

export function useToastContext() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToastContext must be used within ToastProvider");
  return context;
}
