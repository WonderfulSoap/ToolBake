import { GitBranch } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import type { Tool } from "~/entity/tool";

interface CodePreviewModalProps {
  open        : boolean;
  tool?       : Tool | null;
  onOpenChange: (open: boolean) => void;
  onFork?     : () => void;
}

export function CodePreviewModal({
  open,
  tool,
  onOpenChange,
  onFork,
}: CodePreviewModalProps) {
  const toolName = tool?.name ?? "Tool Source";
  const badgeLabel = tool?.isOfficial ? "Read-Only" : "Workspace";
  const widgetConfig = tool?.uiWidgets;
  const widgetPreview =
    widgetConfig && widgetConfig.length > 0
      ? JSON.stringify(widgetConfig, null, 2)
      : "// UI widgets unavailable for this tool.";
  const rawSource = tool?.source ?? "";
  const sourcePreview =
    rawSource.trim().length > 0
      ? rawSource.trimStart()
      : "// Source code unavailable for this tool.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <DialogTitle>{toolName}</DialogTitle>
            <Badge variant="outline" className="text-[10px]">
              {badgeLabel}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            View UI widgets and source definition of this tool
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 bg-muted/20 p-6 overflow-auto min-h-[300px]">
          <div className="space-y-4">
            <div className="bg-background/60 border border-border rounded-lg p-4 code-font text-sm text-foreground">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                UI Widgets
              </p>
              <textarea
                className="w-full h-[280px] bg-transparent border border-border/60 rounded-md p-2 text-foreground font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                readOnly
                value={widgetPreview}
                spellCheck={false}
              />
            </div>
            <div className="bg-background/60 border border-border rounded-lg p-4 code-font text-sm text-foreground">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
                Source Code
              </p>
              <textarea
                className="w-full h-[280px] bg-transparent border border-border/60 rounded-md p-2 text-foreground font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                readOnly
                value={sourcePreview}
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Need to customize this tool?
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={onFork} className="gap-2">
              <GitBranch className="h-4 w-4" />
              Fork to Workspace
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
