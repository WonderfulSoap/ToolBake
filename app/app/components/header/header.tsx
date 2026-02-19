import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Link } from "react-router";
import { BookOpen, ChevronLeft, Github, Menu, Moon, MoreHorizontal, Palette, Search, Sun, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { themeColorPresets, useThemeContext, type ThemeColor } from "~/contexts/theme-context";
import { Badge } from "~/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { searchTools, type Tool } from "~/entity/tool";
import { UserAvatar } from "./user-avatar";
import { LoginDialog } from "./login-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Logo } from "./logo";

interface HeaderProps {
  showSearch?     : boolean;
  toolMeta?       : Tool;
  tools?          : Tool[];
  onSelectTool?   : (toolId: string) => void;
  onReportError?  : (source: string, message?: string, error?: unknown) => void;
  onReportNotice? : (source: string, message?: string) => void;
  /** Show hamburger menu button when sidebar is enabled */
  showMenuButton? : boolean;
  /** Current state of sidebar */
  isSidebarOpen?  : boolean;
  /** Callback to toggle sidebar */
  onToggleSidebar?: () => void;
}

export function Header({
  showSearch = true,
  toolMeta,
  tools = [],
  onSelectTool,
  onReportError,
  onReportNotice,
  showMenuButton = false,
  isSidebarOpen = false,
  onToggleSidebar,
}: HeaderProps) {
  // Keep repository URL configurable without hardcoding project-specific links in code.
  const projectGithubUrl = (import.meta.env.VITE_PROJECT_GITHUB_URL as string | undefined)?.trim() || "https://github.com/WonderfulSoap/ToolBake";
  const projectDocsUrl = (import.meta.env.VITE_PROJECT_DOCS_URL as string | undefined)?.trim() || "https://docs.toolbake.com";
  const { theme, setTheme, themeColor, setThemeColor } = useThemeContext();
  const selectedPreset = themeColor ? themeColorPresets[themeColor] : undefined;
  const themeColorOptions = Object.entries(themeColorPresets);
  const groupingLabel = toolMeta
    ? [toolMeta.namespace, toolMeta.category].filter(Boolean).join(" / ") || "Unassigned"
    : "";
  const namespaceBadgeLabel = toolMeta?.namespace?.trim()
    || (toolMeta?.isOfficial ? "Official" : "Workspace");
  const [isLoginDialogOpen, setIsLoginDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState("openai");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobileQuickLinksOpen, setIsMobileQuickLinksOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement | null>(null);
  const maxVisibleResults = 14;
  const resultRowHeight = 32; // Keep scroll window aligned with result limit.
  const resultListMaxHeight = Math.max(1, maxVisibleResults) * resultRowHeight;

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleOpenLoginDialog = useCallback(() => {
    setIsLoginDialogOpen(true);
  }, []);

  // Open settings at profile tab for user-centric actions from the avatar menu.
  function handleOpenProfileSettings() {
    setSettingsActiveTab("profile");
    setIsSettingsDialogOpen(true);
  }

  // Filter results locally for instant feedback when typing.
  const matchedTools = useMemo(() => searchTools(tools, searchQuery), [tools, searchQuery]);
  const visibleTools = showAllResults ? matchedTools : matchedTools.slice(0, maxVisibleResults);
  const hasMoreResults = matchedTools.length > maxVisibleResults;

  useEffect(() => {
    if (!isSearchOpen) return;
    // Close search panel on outside click.
    function handleDocumentMouseDown(event: MouseEvent) {
      if (!searchContainerRef.current) return;
      if (searchContainerRef.current.contains(event.target as Node)) return;
      setIsSearchOpen(false);
      setShowAllResults(false);
    }
    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!showSearch) return;
    // Enable "/" for quick access and Alt+K as a global fallback.
    function handleGlobalSearchShortcut(event: globalThis.KeyboardEvent) {
      const isSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      const isAltK = (event.key === "k" || event.key === "K") && event.altKey && !event.metaKey && !event.ctrlKey;
      if (!isSlash && !isAltK) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (isSlash && (tagName === "input" || tagName === "textarea" || target?.isContentEditable)) return;
      event.preventDefault();
      setSearchQuery("");
      setIsSearchOpen(true);
      setShowAllResults(false);
      setHighlightedIndex(0);
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
    window.addEventListener("keydown", handleGlobalSearchShortcut);
    return () => window.removeEventListener("keydown", handleGlobalSearchShortcut);
  }, [showSearch]);

  useEffect(() => {
    if (!isSearchOpen) return;
    setHighlightedIndex(visibleTools.length > 0 ? 0 : -1);
  }, [isSearchOpen, searchQuery, showAllResults, visibleTools.length]);

  function handleSearchFocus() {
    setIsSearchOpen(true);
    setShowAllResults(false);
  }

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.target.value);
    setIsSearchOpen(true);
    setShowAllResults(false);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsSearchOpen(false);
      setShowAllResults(false);
      return;
    }
    if (!isSearchOpen || visibleTools.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % visibleTools.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + visibleTools.length) % visibleTools.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      // Select the highlighted tool for quick keyboard navigation.
      const selected = visibleTools[highlightedIndex];
      if (selected) handleSelectSearchTool(selected.id);
    }
  }

  function handleSelectSearchTool(toolId: string) {
    onSelectTool?.(toolId);
    setIsSearchOpen(false);
    setIsMobileSearchOpen(false);
    setShowAllResults(false);
  }

  // Open mobile fullscreen search panel
  function handleOpenMobileSearch() {
    setIsMobileQuickLinksOpen(false);
    setSearchQuery("");
    setIsMobileSearchOpen(true);
    setShowAllResults(false);
    setHighlightedIndex(0);
    requestAnimationFrame(() => mobileSearchInputRef.current?.focus());
  }

  function handleCloseMobileSearch() {
    setIsMobileSearchOpen(false);
    setShowAllResults(false);
  }

  const headerContent = (
    <header className="h-14 glass-effect border-b border-border flex items-center justify-between px-4 z-30 shrink-0 sticky top-0">
      <div className="flex items-center gap-3">
        {/* Sidebar menu button */}
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
          >
            {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        )}
        <Link to="/" className="flex items-center gap-3 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/50" aria-label="Go to home page">
          <div className="w-8 h-8 flex items-center justify-center text-primary">
            <Logo className="h-8 w-8" />
          </div>
          <span className="font-semibold text-base tracking-tight hidden sm:inline">ToolBake</span>
        </Link>
      </div>

      <div className="flex-1 flex justify-center" id="headerContext">
        {showSearch ? (
          <div ref={searchContainerRef} className="relative w-96 hidden md:block group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4 group-focus-within:text-primary transition-colors" />
            <Input
              type="text"
              placeholder=""
              className="w-full text-xs pl-9 pr-4 bg-muted/50 border-border focus:border-primary/50 placeholder:text-muted-foreground"
              value={searchQuery}
              onFocus={handleSearchFocus}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              ref={searchInputRef}
            />
            {!searchQuery && (
              <div className="absolute left-9 right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none select-none text-left">
                Search tools (Type <span className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono text-foreground">/</span> or <span className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono text-foreground">ALT+K</span> to focus)...
              </div>
            )}
            {isSearchOpen && (
              <div className="absolute mt-2 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden z-50">
                <div className="overflow-auto py-1" style={{ maxHeight: resultListMaxHeight }}>
                  {visibleTools.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">No tools found.</div>
                  ) : (
                    visibleTools.map((tool, index) => (
                      <button
                        key={tool.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelectSearchTool(tool.id)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-3 ${index === highlightedIndex ? "bg-muted/80" : "hover:bg-muted/70"}`}
                      >
                        <span className="font-medium text-foreground truncate">{tool.name}</span>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {[tool.namespace, tool.category].filter(Boolean).join(" / ") || "Unassigned"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
                {hasMoreResults && !showAllResults && (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowAllResults(true)}
                    className="w-full text-xs px-3 py-2 border-t border-border bg-muted/40 hover:bg-muted/60 text-muted-foreground"
                  >
                    Show all {matchedTools.length} results
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          toolMeta && (
            <div className="hidden md:flex items-center gap-6 px-4 py-1 rounded-full border border-border/60 bg-muted/30 shadow-sm">
              <div>
                <div className="text-sm font-semibold text-foreground leading-tight">
                  {toolMeta.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {groupingLabel}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground font-mono">
                ID: {toolMeta.id}
              </div>
              <Badge variant={toolMeta.isOfficial ? "outline" : "secondary"} className="text-[10px] uppercase tracking-wide">
                {namespaceBadgeLabel}
              </Badge>
            </div>
          )
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <Button asChild variant="ghost" size="icon" className="hidden rounded-full md:inline-flex" aria-label="Open GitHub repository">
          <a href={projectGithubUrl} target="_blank" rel="noopener noreferrer">
            <Github className="h-4 w-4" />
          </a>
        </Button>
        <Button asChild variant="ghost" size="icon" className="hidden rounded-full md:inline-flex" aria-label="Open documentation">
          <a href={projectDocsUrl} target="_blank" rel="noopener noreferrer">
            <BookOpen className="h-4 w-4" />
          </a>
        </Button>
        <Popover open={isMobileQuickLinksOpen} onOpenChange={setIsMobileQuickLinksOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="Open quick links">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-1.5">
            <a href={projectGithubUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-muted">
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>
            <a href={projectDocsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-muted">
              <BookOpen className="h-4 w-4" />
              <span>Docs</span>
            </a>
            <button type="button" onClick={toggleTheme} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-foreground hover:bg-muted">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            {themeColor && selectedPreset && (
              <div className="pt-1">
                <div className="px-2.5 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Accent</div>
                <Select value={themeColor} onValueChange={(value) => setThemeColor(value as ThemeColor)}>
                  <SelectTrigger className="h-9 w-full rounded-md bg-muted/40 border-border text-xs font-medium text-foreground px-2.5 shadow-none focus:ring-1 focus:ring-ring">
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-full border border-border/60" style={{ backgroundColor: selectedPreset.previewColor }}></span>
                      <span>{selectedPreset.label}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="w-64" align="end">
                    {themeColorOptions.map(([value, preset]) => (
                      <SelectItem key={value} value={value} textValue={preset.label} className="text-xs py-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded-full border border-border/60" style={{ backgroundColor: preset.previewColor }}></span>
                            <span className="font-semibold">{preset.label}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </PopoverContent>
        </Popover>
        {/* Mobile search button remains visible for quick access */}
        {showSearch && (
          <Button variant="ghost" size="icon" className="rounded-full md:hidden" onClick={handleOpenMobileSearch} aria-label="Search tools">
            <Search className="h-4 w-4" />
          </Button>
        )}

        {/* Theme color selector - separate Select for mobile and desktop to fix positioning */}
        {themeColor && selectedPreset ? (
          <>
            {/* Desktop: full selector */}
            <Select value={themeColor} onValueChange={(value) => setThemeColor(value as ThemeColor)}>
              <SelectTrigger className="hidden md:flex w-44 h-9 rounded-full bg-muted/40 border-border text-xs font-medium text-foreground px-3 shadow-none focus:ring-1 focus:ring-ring">
                <div className="flex items-center gap-2">
                  <div className="relative h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center">
                    <span className="absolute inset-0 rounded-full opacity-30" style={{ backgroundColor: selectedPreset.previewColor }}></span>
                    <Palette className="h-4 w-4 relative text-foreground" />
                  </div>
                  <div className="flex flex-col leading-tight text-left">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Accent</span>
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <span className="h-3 w-3 rounded-full border border-border/60" style={{ backgroundColor: selectedPreset.previewColor }}></span>
                      {selectedPreset.label}
                    </span>
                  </div>
                </div>
              </SelectTrigger>
              <SelectContent className="w-64">
                {themeColorOptions.map(([value, preset]) => (
                  <SelectItem key={value} value={value} textValue={preset.label} className="text-xs py-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border border-border/60" style={{ backgroundColor: preset.previewColor }}></span>
                        <span className="font-semibold">{preset.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <div className="hidden md:flex w-44 h-9 rounded-full bg-muted/40 border border-dashed border-border/80 text-xs font-medium text-muted-foreground px-3 items-center" aria-hidden="true">
            <div className="flex items-center gap-2">
              <div className="relative h-8 w-8 rounded-full bg-background/60 border border-border/60 flex items-center justify-center">
                <Palette className="h-4 w-4 relative text-muted-foreground" />
              </div>
              <div className="flex flex-col leading-tight text-left">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Accent</span>
                <span className="text-xs font-semibold text-muted-foreground">—</span>
              </div>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="hidden rounded-full md:inline-flex"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <SettingsDialog
          onReportError={onReportError}
          open={isSettingsDialogOpen}
          onOpenChange={setIsSettingsDialogOpen}
          activeTab={settingsActiveTab}
          onActiveTabChange={setSettingsActiveTab}
        />
        <UserAvatar onOpenLoginDialog={handleOpenLoginDialog} onOpenProfileSettings={handleOpenProfileSettings} onReportError={onReportError} />
      </div>
      <LoginDialog open={isLoginDialogOpen} onOpenChange={setIsLoginDialogOpen} onReportError={onReportError} onReportNotice={onReportNotice} />
    </header>
  );

  // Mobile fullscreen search panel - rendered outside header to avoid stacking context issues
  const mobileSearchPanel = isMobileSearchOpen && (
    <div className="fixed inset-0 z-[100] bg-background md:hidden flex flex-col">
      {/* Search header */}
      <div className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleCloseMobileSearch} aria-label="Close search">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search tools..."
            className="w-full text-sm pl-9 pr-4 bg-muted/50 border-border focus:border-primary/50"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleCloseMobileSearch();
              else handleSearchKeyDown(e);
            }}
            ref={mobileSearchInputRef}
            autoFocus
          />
        </div>
      </div>
      {/* Search results */}
      <div className="flex-1 overflow-auto">
        {visibleTools.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            {searchQuery ? "No tools found." : "Type to search tools..."}
          </div>
        ) : (
          <div className="py-2">
            {visibleTools.map((tool, index) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleSelectSearchTool(tool.id)}
                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between gap-3 ${index === highlightedIndex ? "bg-muted/80" : "active:bg-muted/70"}`}
              >
                <span className="font-medium text-foreground truncate">{tool.name}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {[tool.namespace, tool.category].filter(Boolean).join(" / ") || "Unassigned"}
                </span>
              </button>
            ))}
          </div>
        )}
        {hasMoreResults && !showAllResults && (
          <button
            type="button"
            onClick={() => setShowAllResults(true)}
            className="w-full text-sm px-4 py-3 border-t border-border bg-muted/40 active:bg-muted/60 text-muted-foreground"
          >
            Show all {matchedTools.length} results
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {headerContent}
      {mobileSearchPanel}
    </>
  );
}
