import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Play, BookOpen, Search, Code as CodeIcon, AlertTriangle, ChevronDown } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ToolUIArea } from "~/components/tool/tool-ui-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { sampleTool } from "~/tools/sample/sample-tool";
import { ToolInteractionProvider } from "~/components/input-widgets/tool-interaction-context";
import { PackageLoadingIndicator } from "~/components/tool/package-loading-indicator";
import { cloneTool, type Tool, type ToolUIRows } from "~/entity/tool";
import { MonacoCodeEditor } from "~/components/creator/monaco-code-editor";
import { useGlobalScript, useSaveGlobalScript } from "~/hooks/use-global-script";
import { ToolLogProvider } from "~/components/tool/log-context";
import { LogPanel, type LogPanelHandle } from "~/components/tool/log-panel";
import { generateToolWidgets } from "../input-widgets/input-types";
import { cn } from "~/lib/utils";

const defaultPreviewUiWidgets = sampleTool.uiWidgets;

function PreviewErrorMessage({ message }: { message?: string }) {
  return (
    <div className="p-4 text-xs bg-destructive/10 border border-destructive/30 rounded-md overflow-auto max-h-[50vh]">
      <div className="font-medium text-destructive mb-2">Preview Error</div>
      <pre className="text-muted-foreground whitespace-pre-wrap break-words font-mono">
        {message ?? "Unknown error"}
      </pre>
    </div>
  );
}

interface PreviewPanelProps {
  tool?         : Tool;
  uiWidgets?    : ToolUIRows;
  uiSchemaError?: string | null;
  isActive?     : boolean;
  /** Reset key to clear internal error state when tool/session changes */
  resetKey?     : string | number;
}

interface PreviewErrorBoundaryProps {
  resetKey: string;
  onError?: (message?: string) => void;
  children: ReactNode;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

class PreviewErrorBoundary extends Component<
  PreviewErrorBoundaryProps,
  PreviewErrorBoundaryState
> {
  state: PreviewErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error.message);
  }

  componentDidUpdate(prevProps: PreviewErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: undefined });
      this.props.onError?.(undefined);
    }
  }

  render() {
    if (this.state.hasError) {
      return <PreviewErrorMessage message={this.state.message} />;
    }
    return this.props.children;
  }
}

function getDefaultPreviewOpen() {
  if (typeof window === "undefined") return true;
  return !window.matchMedia("(max-width: 767px)").matches;
}

export function PreviewPanel({ tool, uiWidgets, uiSchemaError, isActive = true, resetKey }: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState("preview");
  const [openToolCategory, setOpenToolCategory] = useState("data-processing");
  const [globalScriptValue, setGlobalScriptValue] = useState("");
  const [isGlobalScriptDirty, setIsGlobalScriptDirty] = useState(false);
  // Default to collapsed preview on small screens to prioritize editor space.
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(getDefaultPreviewOpen);
  const logPanelRef = useRef<LogPanelHandle>(null!);

  // Internal runtime error state (from ErrorBoundary or ToolUIArea)
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Clear runtime error when tool/session changes
  useEffect(() => {
    setRuntimeError(null);
  }, [resetKey]);
  
  // Maintain a live preview copy of the tool that updates in real-time as code/UI changes
  // Use cloneTool to create an independent copy, preventing accidental mutation of the original tool
  const [previewTool, setPreviewTool] = useState<Tool | undefined>(() => tool ? cloneTool(tool) : undefined);
  
  // Update preview tool when the tool prop changes, always creating a new independent copy
  useEffect(() => {
    setPreviewTool(tool ? cloneTool(tool) : undefined);
  }, [tool]);
  
  const widgets = uiWidgets && uiWidgets.length ? uiWidgets : defaultPreviewUiWidgets;

  // Generate widgets and capture any validation/conversion errors locally
  let widgetGenerationError: string | undefined;
  let generatedWidgets: ReturnType<typeof generateToolWidgets> = [];
  try {
    generatedWidgets = generateToolWidgets(widgets);
  } catch (error) {
    widgetGenerationError = error instanceof Error ? error.message : "Failed to convert uiWidgets json to uiWidgets objects.";
  }

  // Combine all error sources: uiSchemaError (JSON parse), widgetGenerationError (validation), runtimeError (ErrorBoundary/ToolUIArea)
  const previewIssue = uiSchemaError ?? widgetGenerationError ?? runtimeError ?? null;
  
  // Generate a key based on both widgets and source code to trigger reload on any change
  const previewKey = useMemo(() => {
    const widgetsKey = JSON.stringify(widgets);
    const sourceKey = previewTool?.source ?? "";
    return `${widgetsKey}-${sourceKey.length}-${sourceKey.slice(0, 100)}`;
  }, [widgets, previewTool?.source]);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    if (media.matches) setIsMobilePreviewOpen(false);
    const handleChange = (event: MediaQueryListEvent) => {
      if (!event.matches) setIsMobilePreviewOpen(true);
    };
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);
  // Keep Global Script UI wired but hidden for now, so it can be re-enabled later without rework.
  const isGlobalScriptVisible = false;
  const isApiReferenceVisible = false;
  const { data: globalScript = "", isLoading: isGlobalScriptLoading, error: globalScriptQueryError } = useGlobalScript();
  const saveGlobalScriptMutation = useSaveGlobalScript();
  const globalScriptError = globalScriptQueryError ? String(globalScriptQueryError) : undefined;
  const isSavingGlobalScript = saveGlobalScriptMutation.isPending;
  const tabGridClass = isGlobalScriptVisible
    ? isApiReferenceVisible
      ? "grid-cols-3"
      : "grid-cols-2"
    : isApiReferenceVisible
      ? "grid-cols-2"
      : "grid-cols-1";

  useEffect(() => {
    setGlobalScriptValue(globalScript);
    setIsGlobalScriptDirty(false);
  }, [globalScript]);

  const handleGlobalScriptChange = useCallback((value?: string) => {
    setGlobalScriptValue(value ?? "");
    setIsGlobalScriptDirty(true);
  }, []);

  const handleGlobalScriptSave = useCallback(async () => {
    const saved = await saveGlobalScriptMutation.mutateAsync(globalScriptValue);
    if (typeof saved === "string") setIsGlobalScriptDirty(false);
  }, [globalScriptValue, saveGlobalScriptMutation]);

  const handleRuntimeError = useCallback((message?: string) => {
    setRuntimeError(message ?? null);
  }, []);

  // Collapse should shrink the whole panel height on mobile, not just hide inner content.
  const previewPanelClassName = cn(
    "flex flex-col bg-card border-t md:border-t-0 md:border-l border-border shadow-xl z-20 shrink max-w-full w-full md:w-[clamp(320px,40vw,640px)] fixed bottom-0 left-0 right-0 md:static overflow-hidden",
    isMobilePreviewOpen ? "h-[70vh] max-h-[70vh]" : "h-auto max-h-none",
    "md:h-auto md:max-h-none"
  );

  return (
    <div className={previewPanelClassName}>
      <Collapsible open={isMobilePreviewOpen} onOpenChange={setIsMobilePreviewOpen} className="flex flex-col flex-1 min-h-0">
        {/* Mobile-only toggle bar for preview. */}
        <div className="border-b border-border bg-background md:hidden h-14">
          <CollapsibleTrigger asChild>
            <button type="button" className="w-full h-14 flex items-center justify-between px-4 text-sm font-medium">
              <span className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                <span>Live Preview</span>
                {previewIssue && (
                  <span
                    className="text-destructive"
                    title={previewIssue}
                    role="img"
                    aria-label="Preview error"
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                )}
              </span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", isMobilePreviewOpen && "rotate-180")} />
            </button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="flex flex-col flex-1 min-h-0 data-[state=closed]:hidden">
          {/* Tabs */}
          <div className="h-10 border-b border-border items-center bg-background shrink-0 hidden md:flex">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
              <TabsList className={`h-10 w-full bg-transparent rounded-none p-0 grid ${tabGridClass}`}>
                <TabsTrigger
                  value="preview"
                  className="h-10 rounded-none border-b-2 data-[state=active]:border-primary data-[state=active]:bg-muted data-[state=active]:text-foreground gap-2"
                >
                  <Play className="h-3 w-3" />
                  <span className="text-xs font-medium flex items-center gap-1">
                    Live Preview
                    {previewIssue && (
                      <span
                        className="text-destructive"
                        title={previewIssue}
                        role="img"
                        aria-label="Preview error"
                      >
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                </TabsTrigger>
                {isGlobalScriptVisible && (
                  <TabsTrigger
                    value="global-script"
                    className="h-10 rounded-none border-b-2 data-[state=active]:border-primary data-[state=active]:bg-muted data-[state=active]:text-foreground gap-2"
                  >
                    <CodeIcon className="h-3 w-3" />
                    <span className="text-xs font-medium">Global Script</span>
                  </TabsTrigger>
                )}
                {isApiReferenceVisible && (
                  <TabsTrigger
                    value="reference"
                    className="h-10 rounded-none border-b-2 data-[state=active]:border-primary data-[state=active]:bg-muted data-[state=active]:text-foreground gap-2"
                  >
                    <BookOpen className="h-3 w-3" />
                    <span className="text-xs font-medium">API Reference</span>
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-h-0 bg-background">
            {/* Preview Container */}
            {activeTab === "preview" && (
              <ToolLogProvider key={`preview-${previewTool?.id ?? "no-tool"}-${previewKey}`}>
                <div className="flex flex-col h-full min-h-0 bg-background">
                  {/* Preview content area */}
                  <div className="flex-1 overflow-y-auto p-4 min-h-0 overscroll-contain touch-pan-y">
                    {previewIssue ? (
                      <PreviewErrorMessage message={previewIssue} />
                    ) : !previewTool ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        No tool selected for preview
                      </div>
                    ) : (
                      <PreviewErrorBoundary resetKey={previewKey} onError={handleRuntimeError}>
                        <ToolInteractionProvider>
                          <PackageLoadingIndicator />
                          <ToolUIArea
                            key={`preview-${previewTool.id}-${previewKey}`}
                            tool={previewTool}
                            uiWidgets={generatedWidgets}
                            onError={handleRuntimeError}
                            logPanelRef={logPanelRef}
                          />
                        </ToolInteractionProvider>
                      </PreviewErrorBoundary>
                    )}
                  </div>
              
                  {/* Log Panel */}
                  <LogPanel ref={logPanelRef} />
                </div>
              </ToolLogProvider>
            )}

            {/* Global Script */}
            {isGlobalScriptVisible && activeTab === "global-script" && (
              <div className="flex flex-col h-full min-h-0 bg-background">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border text-[11px] text-muted-foreground bg-background/90">
                  <div>Code here runs before every tool handler execution.</div>
                  <div className="flex items-center gap-2">
                    {globalScriptError && <span className="text-destructive">{globalScriptError}</span>}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3"
                      onClick={() => {
                        void handleGlobalScriptSave();
                      }}
                      disabled={!isGlobalScriptDirty || isSavingGlobalScript}
                    >
                      {isSavingGlobalScript ? "Saving..." : isGlobalScriptDirty ? "Save Script" : "Saved"}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-h-0 min-w-0 relative">
                  {isGlobalScriptLoading && !isGlobalScriptDirty ? (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">Loading global script...</div>
                  ) : (
                    <MonacoCodeEditor
                      defaultLanguage="javascript"
                      language="javascript"
                      value={globalScriptValue}
                      onChange={handleGlobalScriptChange}
                      onSave={void handleGlobalScriptSave}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Reference Container */}
            {isApiReferenceVisible && activeTab === "reference" && (
              <div className="h-full overflow-y-auto flex flex-col">
                {/* Search */}
                <div className="p-3 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3 w-3" />
                    <Input
                      type="text"
                      placeholder="Search API references..."
                      className="w-full bg-muted/50 border-border pl-8 pr-3 text-xs"
                    />
                  </div>
                </div>

                {/* Tool List */}
                <div className="flex-1 p-2 space-y-6">
                  <div>
                    <div className="px-2 mb-2 flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                      <span>Standard Library</span>
                    </div>

                    <Collapsible
                      open={openToolCategory === "data-processing"}
                      onOpenChange={() =>
                        setOpenToolCategory(
                          openToolCategory === "data-processing"
                            ? ""
                            : "data-processing"
                        )
                      }
                    >
                      <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1.5 cursor-pointer text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/50 w-full">
                        <span className="text-xs font-medium">Data Processing</span>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="pl-3 mt-1 space-y-2 ml-1 border-l border-border">
                        {/* Tool Item */}
                        <Collapsible>
                          <div className="bg-card/30 border border-border rounded-md overflow-hidden">
                            <CollapsibleTrigger className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50 transition-colors w-full">
                              <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center text-blue-400 text-[10px] border border-blue-500/10">
                                <CodeIcon className="h-3 w-3" />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-xs font-medium text-foreground truncate">
                                  JSON Formatter
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="p-2 border-t border-border bg-background">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] text-muted-foreground">
                                  ID
                                </span>
                                <code className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-foreground select-all border border-border code-font">
                                  @official/json_formatter
                                </code>
                              </div>
                              <div className="space-y-2 mb-2">
                                <div className="text-[9px] text-muted-foreground code-font pl-1 border-l-2 border-border">
                                  <div className="flex gap-1 mb-0.5">
                                    <span className="text-primary">jsonStr</span>:
                                    string
                                  </div>
                                  <div className="flex gap-1">
                                    <span className="text-primary">indent</span>: int
                                    (opt)
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-7 text-[10px] gap-1"
                              >
                                <CodeIcon className="h-3 w-3" /> Copy Snippet
                              </Button>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>

                        {/* Tool Item 2 */}
                        <div className="bg-card/30 border border-border rounded-md p-2">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center text-blue-400 text-[10px] border border-blue-500/10">
                              <CodeIcon className="h-3 w-3" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-foreground truncate">
                                XML Parser
                              </div>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
