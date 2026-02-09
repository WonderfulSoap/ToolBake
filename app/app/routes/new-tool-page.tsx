import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { CreatorMode } from "~/components/views/creator-mode";
import { useActiveToolOverride } from "~/contexts/active-tool-context";
import { useAuthContext } from "~/contexts/auth-context";
import { useToastContext } from "~/contexts/toast-context";
import { cloneTool, type Tool } from "~/entity/tool";
import { sampleTool } from "~/tools/sample/sample-tool";
import { ErrorHandler } from "~/error/error-checker";
import { useToolList, useCreateUserTool } from "~/hooks/use-tools";

/**
 * Create a new tool based on the sample template.
 */
function createNewTool(): Tool {
  const base = cloneTool(sampleTool);
  const uniqueSuffix = Date.now().toString(36);
  return {
    ...base,
    id        : `new-tool-${uniqueSuffix}`,
    name      : `New Tool ${uniqueSuffix}`,
    isOfficial: false,
    uid       : undefined,
  };
}

/**
 * New tool route - create a new tool from scratch.
 */
export default function NewToolPage() {
  const navigate = useNavigate();
  const { data: toolList = [] } = useToolList();
  const createToolMutation = useCreateUserTool();
  const { reportError, reportNotice } = useToastContext();
  const { setOverrideTool } = useActiveToolOverride();
  const { mode } = useAuthContext();

  // Initialize with a new tool template
  const [newTool, setNewTool] = useState<Tool>(() => createNewTool());
  const [sessionKey, setSessionKey] = useState(0);

  // Show guest mode warning notice on first load
  useEffect(() => {
    if (mode === "local") {
      reportNotice("guest-mode", "You are in guest mode: All changes will besaved locally only");
    }
    return () => { reportNotice("guest-mode", undefined); };
  }, [mode, reportNotice]);

  // Sync new tool to header display via override context
  useEffect(() => {
    setOverrideTool(newTool);
    return () => { setOverrideTool(null); };
  }, [newTool, setOverrideTool]);

  const handleSave = useCallback(async () => {
    try {
      const nextTools = await createToolMutation.mutateAsync(newTool);
      const savedTool = nextTools.find((tool) => tool.id === newTool.id);
      reportError("user-tools", undefined);
      void navigate(`/t/${savedTool?.id ?? newTool.id}/edit`, { replace: true });
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to create tool";
      reportError("user-tools", message, error, true);
    }
  }, [newTool, createToolMutation, reportError, navigate]);

  const handleClose = useCallback(() => {
    // Navigate back to the first tool or home
    const fallbackId = toolList[0]?.id;
    if (fallbackId) {
      void navigate(`/t/${fallbackId}`);
    } else {
      void navigate("/");
    }
  }, [navigate, toolList]);

  const handleToolChange = useCallback((nextTool: Tool) => {
    setNewTool(nextTool);
  }, []);

  // For a new tool, delete just closes the editor
  const handleDeleteTool = useCallback(() => {
    handleClose();
  }, [handleClose]);

  return (
    <CreatorMode
      tool={newTool}
      sessionKey={sessionKey}
      onClose={handleClose}
      onSave={() => { void handleSave(); }}
      onToolChange={handleToolChange}
      isSaving={createToolMutation.isPending}
      onDeleteTool={handleDeleteTool}
      isDeletingTool={false}
      allTools={toolList}
      userTools={toolList.filter((t) => !t.isOfficial)}
      originalToolId={null}
      isActive={true}
    />
  );
}
