import { CodeEditor } from "~/components/creator/code-editor";
import { PreviewPanel } from "~/components/creator/preview-panel";
import { useEffect, useState } from "react";
import type { Tool } from "~/entity/tool";
import { ToolLogProvider } from "~/components/tool/log-context";

interface CreatorModeProps {
  onClose?       : () => void;
  onSave?        : () => void;
  tool?          : Tool;
  sessionKey?    : number;
  onToolChange?  : (tool: Tool) => void;
  isSaving?      : boolean;
  onDeleteTool?  : () => void | Promise<void>;
  isDeletingTool?: boolean;
  allTools?      : Tool[];
  userTools?     : Tool[];
  originalToolId?: string | null;
  isActive?      : boolean;
}

export function CreatorMode({ onClose, onSave, tool, sessionKey, onToolChange, isSaving, onDeleteTool, isDeletingTool, allTools, userTools, originalToolId, isActive = true }: CreatorModeProps) {
  const [uiSchemaError, setUiSchemaError] = useState<string | null>(null);

  // Clear uiSchemaError when session changes
  useEffect(() => {
    setUiSchemaError(null);
  }, [sessionKey]);

  const handleUiSchemaError = (message?: string) => {
    setUiSchemaError(message ?? null);
  };

  return (
    <ToolLogProvider defaultExpanded resetKey={sessionKey}>
      <div className="absolute inset-0 flex w-full h-full bg-background min-w-0 min-h-0 flex-col md:flex-row">
        {/* Left: Code Editor */}
        <CodeEditor
          onExit={onClose}
          onSave={onSave}
          tool={tool}
          sessionKey={sessionKey}
          onToolChange={onToolChange}
          isSaving={isSaving}
          onUiSchemaErrorChange={handleUiSchemaError}
          onDeleteTool={onDeleteTool}
          isDeletingTool={isDeletingTool}
          allTools={allTools}
          userTools={userTools}
          originalToolId={originalToolId}
        />

        {/* Right: Preview / Reference Panel */}
        <PreviewPanel
          tool={tool}
          uiWidgets={tool?.uiWidgets}
          uiSchemaError={uiSchemaError}
          resetKey={sessionKey}
          isActive={isActive}
        />
      </div>
    </ToolLogProvider>
  );
}
