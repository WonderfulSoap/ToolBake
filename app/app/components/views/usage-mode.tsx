import { AlertCircle, Code, Edit, GitBranch, Trash2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { ToolUIArea } from "~/components/tool/tool-ui-area";
import { LogPanel, type LogPanelHandle } from "~/components/tool/log-panel";
import type { Tool } from "~/entity/tool";
import { Button } from "~/components/ui/button";
import { ToolLogProvider } from "~/components/tool/log-context";
import { PackageLoadingIndicator, type PackageLoadingIndicatorHandle } from "~/components/tool/package-loading-indicator";
import { ExecutionIndicator, type ExecutionIndicatorHandle } from "~/components/tool/execution-indicator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import { generateToolWidgets } from "../input-widgets/input-types";

interface UsageModeProps {
  tool              : Tool;
  onEditClick       : () => void;
  onViewCodeClick   : () => void;
  onForkClick       : () => void;
  onDeleteTool      : () => void | Promise<void>;
  isDeletingTool    : boolean;
  onDisplayError    : (source: string, message?: string) => void;
  isExecutionEnabled: boolean;
  /** Runtime error message to display in content area while keeping toolbar accessible */
  errorMessage?     : string | null;
}

interface OfficialTooltipWrapperProps {
  children: ReactNode;
  message : string;
}

function OfficialTooltipWrapper({ children, message }: OfficialTooltipWrapperProps) {
  return (
    <div className="relative inline-flex group cursor-not-allowed">
      {children}
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[10px] text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
        {message}
      </div>
    </div>
  );
}

export function UsageMode({
  tool,
  onEditClick,
  onViewCodeClick,
  onForkClick,
  onDeleteTool,
  isDeletingTool,
  onDisplayError,
  isExecutionEnabled,
  errorMessage,
}: UsageModeProps) {
  const toolName = tool.name;
  const toolId = tool.id;
  const groupingLabel = [tool.namespace, tool.category].filter(Boolean).join(" / ");
  const isOfficial = tool.isOfficial ?? false;
  const namespaceBadgeLabel = tool.namespace?.trim() || (isOfficial ? "Official" : "Workspace");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, unknown>>({});
  const logPanelRef = useRef<LogPanelHandle>(null!);
  const executionIndicatorRef = useRef<ExecutionIndicatorHandle>(null!);
  const packageLoadingIndicatorRef = useRef<PackageLoadingIndicatorHandle>(null!);
  // const { registerInput, setValue } = useToolInputCollectorContext();
  const officialTooltipMessage = "Official tools can only be forked before editing.";
  
  // Generate widgets with error capture; widgetError is used directly for display (not via parent state)
  const { uiWidgets, widgetError } = useMemo(() => {
    try {
      return { uiWidgets: generateToolWidgets(tool.uiWidgets ?? []), widgetError: null };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to convert uiWidgets json to uiWidgets objects.";
      return { uiWidgets: [], widgetError: msg };
    }
  }, [tool.uiWidgets]);

  // Report widget generation error for toast notification (display is handled by widgetError directly)
  useEffect(() => {
    if (widgetError) onDisplayError("usage.parameters", widgetError);
  }, [widgetError, onDisplayError]);

  // Combine errors: widgetError takes priority (immediate), then parent's errorMessage (runtime errors)
  const displayError = widgetError || errorMessage;
  const handleConfirmDelete = useCallback(async () => {
    if (isOfficial) return;
    await Promise.resolve(onDeleteTool());
    setIsDeleteDialogOpen(false);
  }, [isOfficial, onDeleteTool]);

  const handleParametersError = useCallback(
    (message?: string) => {
      onDisplayError("usage.parameters", message);
    },
    [onDisplayError]
  );

  return (
    <ToolLogProvider key={tool.id}>
      <div className="absolute inset-0 flex flex-col w-full h-full bg-background">
        {/* Toolbar */}
        <div className="min-h-14 py-2 border-b border-border flex items-center justify-between px-4 md:px-8 glass-effect shrink-0">
          {/* Left: Tool info */}
          <div className="min-w-0 flex-1 mr-2">
            <h1 className="text-sm md:text-base font-semibold text-foreground flex items-center gap-2 md:gap-3">
              <span className="truncate">{toolName}</span>
              <Badge variant={isOfficial ? "info" : "success"} className="text-[10px] shrink-0">
                {namespaceBadgeLabel}
              </Badge>
            </h1>
            {/* Mobile: two lines / Desktop: single line */}
            <div className="text-[10px] text-muted-foreground mt-0.5 code-font">
              <p className="truncate">
                ID: <span className="text-foreground">{toolId}</span>
                {/* Desktop: show grouping inline */}
                {groupingLabel ? <span className="hidden sm:inline"> • <span className="text-foreground">{groupingLabel}</span></span> : null}
                <span className="hidden md:inline"> • Updated 10m ago</span>
              </p>
              {/* Mobile: show grouping on second line */}
              {groupingLabel ? <p className="truncate sm:hidden"><span className="text-foreground">{groupingLabel}</span></p> : null}
            </div>
          </div>
          {/* Right: Action buttons */}
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 md:w-auto md:px-3 gap-2"
              onClick={onViewCodeClick}
            >
              <Code className="h-3.5 w-3.5 md:h-3 md:w-3" />
              <span className="hidden md:inline text-xs">Source</span>
            </Button>
            <div className="hidden md:block h-4 w-px bg-border mx-1"></div>
            {isOfficial ? (
              <OfficialTooltipWrapper message={officialTooltipMessage}>
                <Button variant="default" size="sm" className="h-7 w-7 md:w-auto md:px-4 gap-2" onClick={onEditClick} disabled>
                  <Edit className="h-3.5 w-3.5 md:h-3 md:w-3" />
                  <span className="hidden md:inline text-xs">Edit</span>
                </Button>
              </OfficialTooltipWrapper>
            ) : (
              <Button variant="default" size="sm" className="h-7 w-7 md:w-auto md:px-4 gap-2" onClick={onEditClick}>
                <Edit className="h-3.5 w-3.5 md:h-3 md:w-3" />
                <span className="hidden md:inline text-xs">Edit</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 md:w-auto md:px-4 gap-2"
              onClick={onForkClick}
            >
              <GitBranch className="h-3.5 w-3.5 md:h-3 md:w-3" />
              <span className="hidden md:inline text-xs">Fork</span>
            </Button>
            {isOfficial ? (
              <OfficialTooltipWrapper message={officialTooltipMessage}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </OfficialTooltipWrapper>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isDeletingTool}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Execution status indicator */}
        <ExecutionIndicator ref={executionIndicatorRef} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-16 bg-dotted-pattern">
          {displayError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold text-foreground">Tool error</h2>
                <p className="text-sm text-muted-foreground max-w-md">{displayError}</p>
              </div>
              <p className="text-xs text-muted-foreground">Use the toolbar above to edit or fork this tool.</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Input Parameters */}
              <PackageLoadingIndicator ref={packageLoadingIndicatorRef} />
              <ToolUIArea
                key={`usage-mode-${tool.id}`}
                tool={tool}
                uiWidgets={uiWidgets}
                onError={handleParametersError}
                logPanelRef={logPanelRef}
                executionIndicatorRef={executionIndicatorRef}
                packageLoadingIndicatorRef={packageLoadingIndicatorRef}
              />
              {tool.description ? (
                <div className="rounded-lg border border-border bg-card shadow-sm">
                  {/* Label the description block to clarify its purpose. */}
                  <div className="border-b border-border px-4 py-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Description</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{tool.description}</p>
                  </div>
                </div>
              ) : null}

              <div className="h-8"></div>
            </div>
          )}
        </div>

        {/* Log Panel */}
        <LogPanel ref={logPanelRef} />
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this tool?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The tool will be removed from your workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-end sm:space-x-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeletingTool}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={()=>{void handleConfirmDelete();}}
              disabled={isOfficial || isDeletingTool}
            >
              {isDeletingTool ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ToolLogProvider>
  );
}
