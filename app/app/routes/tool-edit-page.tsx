import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { CreatorMode } from "~/components/views/creator-mode";
import { useActiveToolOverride } from "~/contexts/active-tool-context";
import { useAuthContext } from "~/contexts/auth-context";
import { useToastContext } from "~/contexts/toast-context";
import { cloneTool, type Tool } from "~/entity/tool";
import { ErrorHandler } from "~/error/error-checker";
import { useToolList, useOfficialTools, useCreateUserTool, useUpdateUserTool, useDeleteUserTool } from "~/hooks/use-tools";

/**
 * Create a forked copy of a tool with unique ID and name.
 */
function createForkedTool(baseTool: Tool): Tool {
  const uniqueSuffix = Date.now().toString(36);
  const forkedTool = cloneTool(baseTool);
  const baseId = baseTool.isOfficial && baseTool.id.startsWith("official-")
    ? baseTool.id.replace(/^official-/, "forked-")
    : baseTool.id;
  // Use "custom-" prefix for official tools to avoid reusing "official-" in forked IDs.
  forkedTool.id = `${baseId}-${uniqueSuffix}`;
  forkedTool.name = `${baseTool.name}-${uniqueSuffix}`;
  forkedTool.isOfficial = false;
  forkedTool.uid = undefined;
  return forkedTool;
}

/**
 * Find the previous tool ID in the list for navigation after deletion.
 */
function findPreviousToolId(tools: { id: string }[], targetId: string): string | undefined {
  const index = tools.findIndex((tool) => tool.id === targetId);
  if (index === -1) return undefined;
  if (index > 0) return tools[index - 1]?.id;
  return undefined;
}

/**
 * Creator Mode route - edit or fork an existing tool.
 * Use ?fork=true query param to fork instead of edit.
 */
export default function ToolEditPage() {
  const params = useParams<{ toolId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: toolList = [] } = useToolList();
  const { data: officialTools = [] } = useOfficialTools();
  const createToolMutation = useCreateUserTool();
  const updateToolMutation = useUpdateUserTool();
  const deleteToolMutation = useDeleteUserTool();
  const { reportError, reportNotice } = useToastContext();
  const { setOverrideTool } = useActiveToolOverride();
  const { mode } = useAuthContext();

  // Show guest mode warning notice on first load
  useEffect(() => {
    if (mode === "local") {
      reportNotice("guest-mode", "Guest mode: Changes are saved locally only");
    }
    return () => { reportNotice("guest-mode", undefined); };
  }, [mode, reportNotice]);

  const isForkMode = searchParams.get("fork") === "true";

  // Find the base tool to edit/fork
  const baseTool = useMemo(
    () => toolList.find((t) => t.id === params.toolId),
    [toolList, params.toolId]
  );

  // Initialize editing tool state (fork creates a copy, edit clones directly)
  const [editingTool, setEditingTool] = useState<Tool | null>(() => {
    if (!baseTool) return null;
    return isForkMode ? createForkedTool(baseTool) : cloneTool(baseTool);
  });

  // Track the original tool's uid for update operations
  const [originalUid, setOriginalUid] = useState<string | null>(() => {
    if (isForkMode) return null;
    return baseTool?.uid ?? null;
  });

  // Session key for resetting editor state
  const [sessionKey, setSessionKey] = useState(0);

  // Update editing tool when base tool loads (e.g., on page refresh)
  useEffect(() => {
    if (!baseTool || editingTool) return;
    setEditingTool(isForkMode ? createForkedTool(baseTool) : cloneTool(baseTool));
    if (!isForkMode) setOriginalUid(baseTool.uid ?? null);
  }, [baseTool, editingTool, isForkMode]);

  // Sync editing tool to header display via override context
  useEffect(() => {
    setOverrideTool(editingTool);
    return () => { setOverrideTool(null); };
  }, [editingTool, setOverrideTool]);

  const handleSave = useCallback(async () => {
    if (!editingTool) return;
    try {
      let nextTools: Tool[];
      const isFirstSave = isForkMode || !originalUid;
      
      if (isFirstSave) {
        // Creating new tool (fork or first save)
        nextTools = await createToolMutation.mutateAsync(editingTool);
      } else {
        // Updating existing tool
        nextTools = await updateToolMutation.mutateAsync({ uid: originalUid, updates: editingTool });
      }

      // Find the saved tool to update state
      const savedTool = nextTools.find((tool) => tool.id === editingTool.id);
      if (savedTool) {
        setEditingTool(cloneTool(savedTool));
        setOriginalUid(savedTool.uid ?? null);
        setSessionKey((prev) => prev + 1);
      }

      reportError("user-tools", undefined);
      
      // If first save (fork or new tool), update URL to reflect the new tool ID
      // but stay in edit mode
      if (isFirstSave && savedTool && savedTool.id !== params.toolId) {
        void navigate(`/t/${savedTool.id}/edit`, { replace: true });
      }
      // Otherwise keep user in edit mode - they can close explicitly if desired
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to save tool";
      reportError("user-tools", message, error, true);
    }
  }, [editingTool, isForkMode, originalUid, createToolMutation, updateToolMutation, reportError, navigate, params.toolId]);

  const handleClose = useCallback(() => {
    void navigate(`/t/${params.toolId}`);
  }, [navigate, params.toolId]);

  const handleToolChange = useCallback((nextTool: Tool) => {
    setEditingTool(nextTool);
  }, []);

  const handleDeleteTool = useCallback(async () => {
    // If editing a new/forked tool that hasn't been saved yet, just close
    if (!originalUid || !editingTool) {
      handleClose();
      return;
    }

    // Cannot delete official tools
    const isOfficialTool = officialTools.some((tool) => tool.id === editingTool.id);
    if (isOfficialTool) return;

    try {
      await deleteToolMutation.mutateAsync(originalUid);
      const prevId = findPreviousToolId(toolList, editingTool.id);
      const remaining = toolList.filter((t) => t.id !== editingTool.id);
      const nextToolId = prevId ?? remaining[0]?.id;
      reportError("user-tools", undefined);
      if (nextToolId) {
        void navigate(`/t/${nextToolId}`);
      } else {
        void navigate("/");
      }
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to delete tool";
      reportError("user-tools", message, error, true);
    }
  }, [originalUid, editingTool, officialTools, deleteToolMutation, toolList, reportError, navigate, handleClose]);

  return (
    <CreatorMode
      tool={editingTool ?? undefined}
      sessionKey={sessionKey}
      onClose={handleClose}
      onSave={() => { void handleSave(); }}
      onToolChange={handleToolChange}
      isSaving={createToolMutation.isPending || updateToolMutation.isPending}
      onDeleteTool={handleDeleteTool}
      isDeletingTool={deleteToolMutation.isPending}
      allTools={toolList}
      userTools={toolList.filter((t) => !t.isOfficial)}
      originalToolId={isForkMode ? null : params.toolId}
      isActive={true}
    />
  );
}
