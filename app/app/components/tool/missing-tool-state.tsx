import { AlertTriangle } from "lucide-react";
import { Button } from "~/components/ui/button";

interface MissingToolStateProps {
  toolId?        : string;
  onNavigateHome?: () => void;
}

export function MissingToolState({ toolId, onNavigateHome }: MissingToolStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Tool unavailable</h2>
        <p className="text-sm text-muted-foreground">
          We could not find a tool with id <span className="font-mono text-foreground">{toolId ?? "unknown"}</span>.
        </p>
      </div>
      <Button onClick={onNavigateHome} size="sm">
        Go to first tool
      </Button>
    </div>
  );
}
