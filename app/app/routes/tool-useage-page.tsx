import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { MetaFunction } from "react-router";
import { UsageMode } from "~/components/views/usage-mode";
import { MissingToolState } from "~/components/tool/missing-tool-state";
import { CodePreviewModal } from "~/components/modals/code-preview-modal";
import { useToastContext } from "~/contexts/toast-context";
import { ErrorHandler } from "~/error/error-checker";
import { useToolList, useOfficialTools, useDeleteUserTool } from "~/hooks/use-tools";
import { officialToolsMeta } from "~/tools/official-tools-meta";

/**
 * Strip HTML tags and limit length for meta description
 */
function sanitizeMetaDescription(text: string, maxLength: number = 160): string {
  const stripped = text.replace(/<[^>]*>/g, "").trim();
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength - 3) + "...";
}

/**
 * Meta function to generate dynamic meta tags based on tool information.
 * Uses lightweight officialToolsMeta to avoid loading full tool data.
 * No loader needed - meta is generated from URL params and static meta data.
 */
export const meta: MetaFunction = ({ params }) => {
  const toolId = params.toolId;
  const toolMeta = toolId ? officialToolsMeta[toolId] : undefined;

  if (toolMeta) {
    const title = `${toolMeta.name} - ToolBake`;
    const description = sanitizeMetaDescription(toolMeta.description);
    return [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
  }

  // Fallback for user tools or unknown tools
  return [
    { title: "ToolBake - Tool Development Platform" },
    { name: "description", content: "Build and customize your own tools with AI assistance" },
  ];
};

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
 * Usage Mode route - displays a tool for normal use.
 * Handles tool lookup, missing state, and navigation to edit/fork.
 */
export default function ToolUsagePage() {
  const params = useParams<{ toolId: string }>();
  const navigate = useNavigate();
  const { data: toolList = [], isLoading } = useToolList();
  const { data: officialTools = [] } = useOfficialTools();
  const deleteToolMutation = useDeleteUserTool();
  const { reportError } = useToastContext();

  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [toolRuntimeError, setToolRuntimeError] = useState<string | null>(null);

  // Clear error state when switching tools
  useEffect(() => {
    setToolRuntimeError(null);
  }, [params.toolId]);

  // Find the selected tool by ID
  const selectedTool = useMemo(
    () => toolList.find((tool) => tool.id === params.toolId),
    [toolList, params.toolId]
  );

  // Determine if tool is missing (only after loading completes)
  const isMissing = !selectedTool && !isLoading && Boolean(params.toolId);

  // Fallback tool ID for navigation
  const fallbackToolId = toolList[0]?.id;

  const handleNavigateToFallback = useCallback(() => {
    if (fallbackToolId) {
      void navigate(`/t/${fallbackToolId}`);
    }
  }, [fallbackToolId, navigate]);

  const handleEditClick = useCallback(() => {
    if (params.toolId) {
      void navigate(`/t/${params.toolId}/edit`);
    }
  }, [navigate, params.toolId]);

  const handleForkClick = useCallback(() => {
    if (params.toolId) {
      void navigate(`/t/${params.toolId}/edit?fork=true`);
    }
  }, [navigate, params.toolId]);

  const handleViewCode = useCallback(() => {
    setCodeModalOpen(true);
  }, []);

  const handleToolRuntimeError = useCallback((source: string, message?: string) => {
    reportError(source, message);
    setToolRuntimeError(message ?? null);
  }, [reportError]);

  const handleDeleteTool = useCallback(async () => {
    if (!selectedTool?.uid) return;
    const isOfficialTool = officialTools.some((tool) => tool.id === selectedTool.id);
    if (isOfficialTool) return;

    try {
      await deleteToolMutation.mutateAsync(selectedTool.uid);
      const prevId = findPreviousToolId(toolList, selectedTool.id);
      const nextToolId = prevId ?? toolList.filter((t) => t.id !== selectedTool.id)[0]?.id;
      if (nextToolId) {
        void navigate(`/t/${nextToolId}`);
      }
      reportError("user-tools", undefined);
    } catch (error) {
      ErrorHandler.processError(error);
      const message = error instanceof Error ? error.message : "Failed to delete tool";
      reportError("user-tools", message, error, true);
    }
  }, [selectedTool, officialTools, deleteToolMutation, toolList, navigate, reportError]);

  // Show loading state while tool list is being fetched
  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">Loading tool...</span>
        </div>
      </div>
    );
  }

  // Show missing state if tool not found
  if (isMissing) {
    return <MissingToolState toolId={params.toolId} onNavigateHome={handleNavigateToFallback} />;
  }

  // Tool should exist at this point after loading completes
  if (!selectedTool) {
    return <MissingToolState toolId={params.toolId} onNavigateHome={handleNavigateToFallback} />;
  }

  return (
    <>
      <UsageMode
        tool={selectedTool}
        isExecutionEnabled={true}
        onEditClick={handleEditClick}
        onViewCodeClick={handleViewCode}
        onForkClick={handleForkClick}
        onDeleteTool={handleDeleteTool}
        isDeletingTool={deleteToolMutation.isPending}
        onDisplayError={handleToolRuntimeError}
        errorMessage={toolRuntimeError}
      />

      <CodePreviewModal
        open={codeModalOpen}
        tool={selectedTool}
        onOpenChange={setCodeModalOpen}
        onFork={handleForkClick}
      />
    </>
  );
}
