import { AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";

interface ToolErrorStateProps {
  message?       : string;
  onNavigateHome?: () => void;
}

export function ToolErrorState({ message, onNavigateHome }: ToolErrorStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Tool error</h2>
        <p className="text-sm text-muted-foreground">
          {message ?? "We encountered an issue rendering this tool."}
        </p>
      </div>
      {onNavigateHome && (
        <Button onClick={onNavigateHome} size="sm">
          Go to first tool
        </Button>
      )}
    </div>
  );
}
