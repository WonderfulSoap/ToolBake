import { ChevronRight, ArrowUpDown, Lock, Box, Plus, Target } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";
import { useEffect, useMemo, useRef, useState, Fragment, type ReactNode } from "react";
import type { Tool } from "~/entity/tool";
import emojiRegex from "emoji-regex";

/** Instant tooltip that appears immediately on hover, rendered via portal */
function InstantTooltip({ children, content }: { children: ReactNode; content: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseEnter() {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    }
    setShow(true);
  }

  return (
    <div ref={ref} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div
          className="fixed z-[9999] whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md border border-border -translate-y-1/2"
          style={{ top: pos.top, left: pos.left }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

interface ToolCategory {
  id   : string;
  name : string;
  tools: Tool[];
}

interface ToolSection {
  id        : string;
  title     : string;
  isOfficial: boolean;
  categories: ToolCategory[];
}

type SidebarProps = {
  isVisible?   : boolean;
  tools?       : Tool[];
  onToolSelect?: (toolId: string) => void;
  onCreateTool?: () => void;
};

function buildSidebarSections(toolList: Tool[]): ToolSection[] {
  // Group tools by (namespace + isOfficial), then by category.
  // This ensures user tools are never mixed with official tools even if they share the same namespace.
  const namespaceSections = new Map<string, { isOfficial: boolean; displayName: string; categories: Map<string, ToolCategory> }>();

  toolList.forEach((tool) => {
    const namespace = tool.namespace?.trim() || (tool.isOfficial ? "Official" : "Workspace");
    // Composite key: separate official vs user tools even with same namespace
    const sectionKey = `${tool.isOfficial ? "official" : "user"}:${namespace}`;
    if (!namespaceSections.has(sectionKey)) {
      namespaceSections.set(sectionKey, { isOfficial: tool.isOfficial, displayName: namespace, categories: new Map() });
    }
    const section = namespaceSections.get(sectionKey)!;
    const categoryKey = tool.category?.trim() || "General";
    if (!section.categories.has(categoryKey)) {
      section.categories.set(categoryKey, {
        id   : `cat:${sectionKey}:${categoryKey}`,
        name : categoryKey,
        tools: [],
      });
    }
    section.categories.get(categoryKey)!.tools.push(tool);
  });

  // Sort: official namespaces first, then user namespaces
  const officialSections: ToolSection[] = [];
  const userSections: ToolSection[] = [];
  namespaceSections.forEach((data, sectionKey) => {
    const section: ToolSection = {
      id        : `ns:${sectionKey}`,
      title     : data.displayName,
      isOfficial: data.isOfficial,
      categories: Array.from(data.categories.values()),
    };
    if (data.isOfficial) officialSections.push(section);
    else userSections.push(section);
  });

  return [...officialSections, ...userSections];
}

function getDefaultOpenCategoryIds(sections: ToolSection[]): string[] {
  return sections.flatMap((section) => section.categories.map((category) => category.id));
}

function getFirstEmoji(text: string): string | null {
  // Prefer the first emoji so variation selectors are preserved (e.g. 🛠️).
  const match = text.match(emojiRegex());
  return match?.[0] ?? null;
}

export function Sidebar({
  isVisible = true,
  tools = [],
  onToolSelect,
  onCreateTool,
}: SidebarProps) {
  const activeToolButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastScrolledActiveToolIdRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const toolSections = useMemo(
    () => buildSidebarSections(tools),
    [tools]
  );
  const activeToolId = useMemo(
    () => tools.find((tool) => tool.isActive)?.id ?? null,
    [tools]
  );
  const activeSectionId = useMemo(() => {
    if (!activeToolId) return null;
    for (const section of toolSections) {
      const hasActiveTool = section.categories.some((category) =>
        category.tools.some((tool) => tool.id === activeToolId)
      );
      if (hasActiveTool) return section.id;
    }
    return null;
  }, [activeToolId, toolSections]);
  const [openCategories, setOpenCategories] = useState<string[]>(
    () => getDefaultOpenCategoryIds(toolSections)
  );

  /** Scroll to a specific namespace section with highlight effect */
  function scrollToSection(sectionId: string) {
    const sectionEl = sectionRefs.current.get(sectionId);
    if (sectionEl && scrollContainerRef.current) {
      sectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
      // Trigger highlight effect
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      setHighlightedSectionId(sectionId);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedSectionId(null);
      }, 1500); // Highlight duration in ms
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const nextIds = getDefaultOpenCategoryIds(toolSections);
    setOpenCategories((prev) => {
      const merged = new Set(prev.filter((id) => nextIds.includes(id)));
      nextIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  }, [toolSections]);

  useEffect(() => {
    if (!isVisible || !activeToolId) return;
    // Scroll when the active tool changes so selection stays visible.
    if (lastScrolledActiveToolIdRef.current === activeToolId) return;
    let isCancelled = false;
    const scrollToActive = () => {
      if (isCancelled) return;
      const activeButton = activeToolButtonRef.current;
      if (!activeButton) return;
      activeButton.scrollIntoView({ block: "center" });
      lastScrolledActiveToolIdRef.current = activeToolId;
    };
    const rafId = requestAnimationFrame(() => requestAnimationFrame(scrollToActive));
    const timeoutId = window.setTimeout(scrollToActive, 180);
    return () => {
      isCancelled = true;
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [activeToolId, isVisible, openCategories]);

  function toggleCategory(categoryId: string) {
    setOpenCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  }

  function handleToolSelect(toolId: string) {
    onToolSelect?.(toolId);
  }

  function handleLocateActiveTool() {
    if (activeToolButtonRef.current) {
      activeToolButtonRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <aside
      className={cn(
        "w-[340px] h-full bg-background border-r border-border flex select-none shrink-0 z-20 transition-[width,border] duration-300",
        !isVisible && "w-0 overflow-hidden border-0"
      )}
      style={{
        "--highlight-pulse": "0s",
      } as React.CSSProperties & { "--highlight-pulse": string }}
    >
      {/* Namespace quick nav bar */}
      <div className="w-14 border-r border-border/50 flex flex-col items-center bg-muted/30 shrink-0 py-2 gap-3">
        {toolSections.map((section, index) => {
          const isFirstUserSection = !section.isOfficial && (index === 0 || toolSections[index - 1]?.isOfficial);
          const firstEmoji = getFirstEmoji(section.title);
          const fallbackLabel = Array.from(section.title)[0] || "?";
          return (
            <Fragment key={section.id}>
              {isFirstUserSection && (
                <div className="w-full h-px bg-border my-1"></div>
              )}
              <InstantTooltip content={section.isOfficial ? `OFFICIAL - ${section.title}` : section.title}>
                <button
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground bg-background hover:bg-muted/50 transition-all border border-border/50 hover:border-border rounded-lg shadow-sm hover:shadow-md shrink-0"
                >
                  <span className="text-xl font-semibold">{firstEmoji ?? fallbackLabel}</span>
                </button>
              </InstantTooltip>
            </Fragment>
          );
        })}
      </div>

      {/* Main sidebar content */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-3 border-b border-border/50 flex justify-between items-center h-10">
          <span className="text-[10px] font-semibold text-muted-foreground tracking-wider uppercase pl-2">
            Explorer
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleLocateActiveTool} disabled={!activeToolId} title="Locate active tool">
              <Target className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden h-6 w-6 text-muted-foreground hover:text-foreground" aria-hidden="true" tabIndex={-1}>
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2 space-y-4">
          <style>{`
            @keyframes pulse-highlight {
              0%, 100% { background-color: var(--highlight-start); border-color: var(--highlight-border-start); }
              50% { background-color: var(--highlight-end); border-color: var(--highlight-border-end); }
            }
            .animate-pulse-highlight {
              animation: pulse-highlight 0.6s ease-in-out 2 !important;
            }
          `}</style>
          {toolSections.map((section) => {
            const isHighlighted = highlightedSectionId === section.id;
            return (
              <div
                key={section.id}
                ref={(el) => { if (el) sectionRefs.current.set(section.id, el); }}
                className={cn(
                  "rounded-lg border overflow-hidden transition-all duration-300",
                  activeSectionId === section.id
                    ? "bg-primary/7 border border-primary/25"
                    : "bg-muted/50 border border-border/50",
                  isHighlighted && "animate-pulse-highlight"
                )}
                style={isHighlighted ? {
                  "--highlight-start"       : "rgba(var(--primary-rgb, 249, 115, 22), 0.07)",
                  "--highlight-end"         : "rgba(var(--primary-rgb, 249, 115, 22), 0.15)",
                  "--highlight-border-start": "rgba(var(--primary-rgb, 249, 115, 22), 0.25)",
                  "--highlight-border-end"  : "rgba(var(--primary-rgb, 249, 115, 22), 0.4)",
                } as React.CSSProperties : undefined}
              >
                <div className="px-3 py-2 flex items-center justify-between text-xs font-semibold text-muted-foreground tracking-wider uppercase bg-muted/70 border-b border-border/50">
                  <span>{section.title}</span>
                  {section.isOfficial ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">OFFICIAL</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">YOUR OWN TOOLS</span>
                  )}
                </div>

                <div className="p-1.5">
                  {section.categories.map((category) => {
                    const isOpen = openCategories.includes(category.id);
                    return (
                      <Collapsible
                        key={category.id}
                        open={isOpen}
                        onOpenChange={() => toggleCategory(category.id)}
                        className="group mt-1"
                      >
                        <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50 w-full">
                          <ChevronRight className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
                          <span className="text-xs font-medium">{category.name}</span>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="mt-1 space-y-0.5 ml-3 border-l border-border pl-3">
                          {category.tools.map((tool) => (
                            <button
                              key={tool.id}
                              type="button"
                              onClick={() => handleToolSelect(tool.id)}
                              ref={tool.isActive ? activeToolButtonRef : null}
                              className={cn(
                                "relative w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between group/tool border border-transparent hover:border-border",
                                tool.isActive
                                  ? "bg-accent text-accent-foreground border-border"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              {tool.isActive && (
                                <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-r"></div>
                              )}
                              <div className="flex items-center gap-2">
                                {!tool.isOfficial && tool.isActive && <Box className="h-3 w-3 text-primary" />}
                                <span>{tool.name}</span>
                              </div>
                              {tool.isOfficial && <Lock className="h-3 w-3 text-muted-foreground/50 opacity-50" />}
                            </button>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-border bg-background">
          <Button className="w-full gap-2 shadow hover:shadow-lg" size="sm" onClick={onCreateTool}>
            <Plus className="h-4 w-4" /> Create your own tool
          </Button>
        </div>
      </div>
    </aside>
  );
}
