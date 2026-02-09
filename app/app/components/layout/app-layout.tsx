import { useState, useCallback, useEffect } from "react";
import { Header } from "../header/header";
import { Sidebar } from "./sidebar";
import type { Tool } from "~/entity/tool";

interface AppLayoutProps {
  children         : React.ReactNode;
  tools?           : Tool[];
  onSelectTool?    : (toolId: string) => void;
  showSidebar?     : boolean;
  showHeaderSearch?: boolean;
  activeTool?      : Tool;
  onCreateTool?    : () => void;
  onReportError?   : (source: string, message?: string, error?: unknown) => void;
  onReportNotice?  : (source: string, message?: string) => void;
}

/** Breakpoint for mobile detection (matches Tailwind's md: 768px) */
const MOBILE_BREAKPOINT = 768;

export function AppLayout({
  children,
  tools,
  onSelectTool,
  showSidebar = true,
  showHeaderSearch = true,
  activeTool,
  onCreateTool,
  onReportError,
  onReportNotice,
}: AppLayoutProps) {
  // Mobile sidebar drawer state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // Desktop sidebar visibility state
  const [isDesktopSidebarVisible, setIsDesktopSidebarVisible] = useState(true);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => typeof window !== "undefined" && window.innerWidth >= MOBILE_BREAKPOINT);

  // Close mobile sidebar when window resizes to desktop
  useEffect(() => {
    function handleResize() {
      const isDesktop = window.innerWidth >= MOBILE_BREAKPOINT;
      setIsDesktopViewport(isDesktop);
      if (isDesktop) setIsMobileSidebarOpen(false);
    }
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Toggle sidebar based on current viewport
  const handleToggleSidebar = useCallback(() => {
    if (isDesktopViewport) {
      setIsDesktopSidebarVisible((prev) => !prev);
      return;
    }
    setIsMobileSidebarOpen((prev) => !prev);
  }, [isDesktopViewport]);

  // Close mobile sidebar when a tool is selected
  const handleSelectTool = useCallback((toolId: string) => {
    setIsMobileSidebarOpen(false);
    onSelectTool?.(toolId);
  }, [onSelectTool]);

  // Close mobile sidebar when create tool is clicked
  const handleCreateTool = useCallback(() => {
    setIsMobileSidebarOpen(false);
    onCreateTool?.();
  }, [onCreateTool]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Header
        showSearch={showHeaderSearch}
        toolMeta={showHeaderSearch ? undefined : activeTool}
        tools={tools}
        onSelectTool={handleSelectTool}
        onReportError={onReportError}
        onReportNotice={onReportNotice}
        showMenuButton={showSidebar}
        isSidebarOpen={isDesktopViewport ? isDesktopSidebarVisible : isMobileSidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar: hidden on mobile (md:block) */}
        <div className="hidden md:block">
          <Sidebar
            isVisible={showSidebar && isDesktopSidebarVisible}
            tools={tools}
            onToolSelect={handleSelectTool}
            onCreateTool={handleCreateTool}
          />
        </div>

        {/* Mobile sidebar overlay */}
        {showSidebar && (
          <>
            {/* Backdrop with fade animation */}
            <div
              className={`fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-300 ease-out ${isMobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            {/* Drawer with slide animation */}
            <div
              className={`fixed inset-y-0 left-0 z-50 w-[340px] max-w-[85vw] md:hidden ${isMobileSidebarOpen ? "shadow-2xl" : "invisible"}`}
              style={{
                transform: isMobileSidebarOpen ? "translateX(0)" : "translateX(-100%)",
                transition: isMobileSidebarOpen
                  ? "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)"
                  : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1), visibility 0s 300ms",
              }}
            >
              <Sidebar
                isVisible={true}
                tools={tools}
                onToolSelect={handleSelectTool}
                onCreateTool={handleCreateTool}
              />
            </div>
          </>
        )}

        <main className="flex-1 relative flex overflow-hidden bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
