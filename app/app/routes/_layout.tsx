import { useCallback, useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { X } from "lucide-react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "~/contexts/theme-context";
import { ToastProvider, useToastContext } from "~/contexts/toast-context";
import { useAuthContext } from "~/contexts/auth-context";
import { ActiveToolOverrideProvider, useActiveToolOverride } from "~/contexts/active-tool-context";
import { AppLayout } from "~/components/layout/app-layout";
import { ErrorHandler } from "~/error/error-checker";
import { useToolList } from "~/hooks/use-tools";
import { queryClient } from "~/lib/query-client";
/**
 * Main layout route providing shared UI structure (Header + Sidebar + Toast)
 * and global contexts (Theme, Toast, ToolList) for all child routes.
 */
export default function MainLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <ActiveToolOverrideProvider>
            <LayoutContent />
          </ActiveToolOverrideProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function LayoutContent() {
  const { data: toolList = [] } = useToolList();
  const { reportError, reportNotice, errorEntries, noticeEntries } = useToastContext();
  const { forceLogout } = useAuthContext();
  const { overrideTool } = useActiveToolOverride();
  const navigate = useNavigate();
  const params = useParams<{ toolId?: string }>();
  const location = useLocation();

  // Register global error listeners (window.error, unhandledrejection)
  useEffect(() => {
    const cleanup = ErrorHandler.registerGlobalListeners(forceLogout, reportError);
    return cleanup;
  }, [forceLogout, reportError]);

  // Determine if sidebar/search should be visible based on current route
  const isEditRoute = location.pathname.endsWith("/edit") || location.pathname === "/t/new";
  const showSidebar = !isEditRoute;
  const showHeaderSearch = !isEditRoute;

  // Build sidebar tools with isActive flag
  const sidebarTools = useMemo(
    () => toolList.map((tool) => ({ ...tool, isActive: tool.id === params.toolId })),
    [toolList, params.toolId]
  );

  // Find active tool for header display (use override if available, e.g., from edit page)
  const activeTool = useMemo(
    () => overrideTool ?? toolList.find((tool) => tool.id === params.toolId),
    [overrideTool, toolList, params.toolId]
  );

  const handleSelectTool = useCallback((toolId: string) => {
    void navigate(`/t/${toolId}`);
  }, [navigate]);

  const handleCreateNewTool = useCallback(() => {
    void navigate("/t/new");
  }, [navigate]);

  return (
    <AppLayout
      tools={sidebarTools}
      onSelectTool={handleSelectTool}
      onCreateTool={handleCreateNewTool}
      showSidebar={showSidebar}
      showHeaderSearch={showHeaderSearch}
      activeTool={activeTool}
      onReportError={reportError}
      onReportNotice={reportNotice}
    >
      {/* Toast notifications */}
      {(noticeEntries.length > 0 || errorEntries.length > 0) && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
          {noticeEntries.map(([source, message]) => (
            <div
              key={`notice-${source}`}
              className="pointer-events-auto rounded-lg border border-emerald-400 bg-emerald-950/90 text-emerald-50 text-sm px-4 py-3 flex items-center gap-4 shadow-2xl shadow-emerald-500/30 min-w-[280px] max-w-sm"
            >
              <span className="flex-1 text-left">{message}</span>
              <button
                type="button"
                className="text-emerald-200 hover:text-emerald-50"
                onClick={() => reportNotice(source, undefined)}
                aria-label="Dismiss notice"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {errorEntries.map(([source, message]) => (
            <div
              key={`error-${source}`}
              className="pointer-events-auto rounded-lg border border-red-400 bg-red-950/90 text-red-50 text-sm px-4 py-3 flex items-center gap-4 shadow-2xl shadow-red-500/30 min-w-[280px] max-w-sm"
            >
              <span className="flex-1 text-left">{message}</span>
              <button
                type="button"
                className="text-red-200 hover:text-red-50"
                onClick={() => reportError(source, undefined)}
                aria-label="Dismiss error"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Child routes */}
      <Outlet />
    </AppLayout>
  );
}
