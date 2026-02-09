import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { ChevronsUpDown, Check as CheckIcon, Wand2, Check, Save, DoorOpen, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import type { Tool, ToolUIRows } from "~/entity/tool";
import { buildToolHandlerDts } from "~/entity/tool";
import { sampleTool, sampleToolSourceCode } from "~/tools/sample/sample-tool";
import { MonacoCodeEditor } from "./monaco-code-editor";
import { UiWidgetsGuidePanel } from "./ui-widgets-guide-panel";
import { LogPanel } from "~/components/tool/log-panel";
import { AiAssistantPanel } from "./ai-assistant-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useGlobalScript } from "~/hooks/use-global-script";

/** Tool meta fields that can be updated via setters. */
export interface ToolMetaFields {
  id?          : string;
  name?        : string;
  namespace?   : string;
  category?    : string;
  description? : string;
  execInterval?: string;
}

/** Result of setUiWidgetsJson operation. */
export interface SetUiWidgetsResult {
  success: boolean;
  error? : string;
}

/**
 * Getter/setter functions for AI assistant to access and modify editor state.
 * Using getters avoids re-renders when editor content changes frequently.
 */
export interface CodeEditorInfoGetters {
  /** Returns the current handler source code from the editor. */
  getHandlerSource(): string;
  /** Returns the current UI widgets JSON string from the editor. */
  getUiWidgetsJson(): string;
  /** Get current tool meta fields. */
  getToolMeta(): ToolMetaFields;
  /** Update one or more tool meta fields. */
  setToolMeta(fields: ToolMetaFields): void;
  /** Update handler source code. */
  setHandlerSource(source: string): void;
  /** Update UI widgets JSON. Returns error if JSON is invalid. */
  setUiWidgetsJson(json: string): SetUiWidgetsResult;
}

interface CodeEditorProps {
  onExit?               : () => void;
  onSave?               : () => void;
  tool?                 : Tool;
  sessionKey?           : number;
  onToolChange?         : (tool: Tool) => void;
  onUiSchemaErrorChange?: (message?: string) => void;
  isSaving?             : boolean;
  onDeleteTool?         : () => void | Promise<void>;
  isDeletingTool?       : boolean;
  /** All tools (official + workspace) for validation */
  allTools?             : Tool[];
  /** Workspace tools only for namespace/category suggestions */
  userTools?            : Tool[];
  /** Original tool id before editing (used to ignore self when validating id conflicts) */
  originalToolId?       : string | null;
}

const SAMPLE_SOURCE = sampleToolSourceCode;

const FALLBACK_WIDGETS = sampleTool.uiWidgets;
const MOBILE_PREVIEW_BAR_HEIGHT = 56;
const MOBILE_PREVIEW_SAFE_PADDING = MOBILE_PREVIEW_BAR_HEIGHT + 16;

export function parseExecIntervalMs(value?: string | null) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 100) return null;
  return parsed;
}

export function CodeEditor({
  onExit,
  onSave,
  tool,
  sessionKey,
  onToolChange,
  onUiSchemaErrorChange,
  isSaving,
  onDeleteTool,
  isDeletingTool,
  allTools,
  userTools,
  originalToolId,
}: CodeEditorProps) {
  const [activeTab, setActiveTab] = useState("source");
  const [sourceValue, setSourceValue] = useState(tool?.source ?? SAMPLE_SOURCE);
  const [uiSchemaValue, setUiSchemaValue] = useState(JSON.stringify(tool?.uiWidgets ?? FALLBACK_WIDGETS, null, 2));
  const [settings, setSettings] = useState({
    id          : tool?.id ?? "",
    name        : tool?.name ?? "",
    namespace   : (tool?.namespace ?? "").slice(0, 30),
    category    : (tool?.category ?? "").slice(0, 30),
    description : tool?.description ?? "",
    execInterval: tool?.extraInfo?.execInterval ?? "",
  });
  const [isNamespaceOpen, setIsNamespaceOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isUiGuideOpen, setIsUiGuideOpen] = useState(false);
  const { data: globalScript = "" } = useGlobalScript();
  const trimmedOriginalId = (originalToolId ?? "").trim();
  const isEditingUiSchemaRef = useRef(false);

  // Refs to store latest editor values for AI assistant getters.
  const sourceValueRef = useRef(sourceValue);
  const uiSchemaValueRef = useRef(uiSchemaValue);
  const settingsRef = useRef(settings);
  // Ref to store handleSettingsChange for use in useMemo (avoids stale closure).
  const handleSettingsChangeRef = useRef<(field: "id" | "name" | "namespace" | "category" | "description" | "execInterval", value: string) => void>(() => {});
  // Ref to store batch meta update function (avoids stale closure in useMemo).
  const batchUpdateToolMetaRef = useRef<(fields: ToolMetaFields) => void>(() => {});
  useEffect(() => { sourceValueRef.current = sourceValue; }, [sourceValue]);
  useEffect(() => { uiSchemaValueRef.current = uiSchemaValue; }, [uiSchemaValue]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const emitToolUpdate = useCallback(
    (partial: Partial<Tool>) => {
      if (!tool || !onToolChange) return;
      onToolChange({ ...tool, ...partial });
    },
    [tool, onToolChange]
  );

  useEffect(() => {
    if (!tool) return;
    setSourceValue(tool.source ?? SAMPLE_SOURCE);
    // Only reset uiSchemaValue if not currently being edited by user
    // This prevents the editor from resetting while the user is typing
    if (!isEditingUiSchemaRef.current) {
      setUiSchemaValue(JSON.stringify(tool.uiWidgets ?? FALLBACK_WIDGETS, null, 2));
    } else {
      isEditingUiSchemaRef.current = false;
    }
    setSettings({
      id          : tool.id ?? "",
      name        : tool.name ?? "",
      namespace   : (tool.namespace ?? "").slice(0, 30),
      category    : (tool.category ?? "").slice(0, 30),
      description : tool.description ?? "",
      execInterval: tool.extraInfo?.execInterval ?? "",
    });
  }, [sessionKey, tool]);

  const handleSourceChange = useCallback(
    (value?: string) => {
      const nextValue = value ?? "";
      setSourceValue(nextValue);
      emitToolUpdate({ source: nextValue });
    },
    [emitToolUpdate]
  );

  const handleUiSchemaChange = useCallback(
    (value?: string) => {
      const nextValue = value ?? "";
      isEditingUiSchemaRef.current = true;
      setUiSchemaValue(nextValue);
      if (!tool) return;
      try {
        const parsed = JSON.parse(nextValue) as ToolUIRows;
        onUiSchemaErrorChange?.(undefined);
        emitToolUpdate({ uiWidgets: parsed });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to parse uiWidgets";
        onUiSchemaErrorChange?.(message);
      }
    },
    [emitToolUpdate, onUiSchemaErrorChange, tool]
  );

  // Getter/setter functions for AI assistant to access and modify editor state.
  const editorGetters = useMemo<CodeEditorInfoGetters>(() => ({
    getHandlerSource: () => sourceValueRef.current,
    getUiWidgetsJson: () => uiSchemaValueRef.current,
    getToolMeta     : () => settingsRef.current,
    setToolMeta     : (fields: ToolMetaFields) => { batchUpdateToolMetaRef.current(fields); },
    setHandlerSource: (source: string) => { handleSourceChange(source); },
    setUiWidgetsJson: (json: string): SetUiWidgetsResult => {
      try {
        JSON.parse(json);
        handleUiSchemaChange(json);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Invalid JSON";
        return { success: false, error: message };
      }
    },
  }), [handleSourceChange, handleUiSchemaChange]);

  function buildNextExtraInfo(nextExecInterval: string) {
    if (!tool) return {};
    const next = tool.extraInfo && typeof tool.extraInfo === "object" ? { ...tool.extraInfo } : {};
    const trimmed = nextExecInterval.trim();
    if (trimmed) next.execInterval = trimmed;
    else delete next.execInterval;
    return next;
  }

  function handleSettingsChange(field: "id" | "name" | "namespace" | "category" | "description" | "execInterval", value: string) {
    if (field === "execInterval") {
      setSettings((prev) => ({ ...prev, execInterval: value }));
      emitToolUpdate({ extraInfo: buildNextExtraInfo(value) });
      return;
    }
    const next = field === "namespace" || field === "category" ? value.slice(0, 30) : value;
    setSettings((prev) => ({ ...prev, [field]: next }));
    if (field === "description" || field === "name") {
      emitToolUpdate({ [field]: next } as Partial<Tool>);
    } else {
      const trimmed = next.trim();
      emitToolUpdate({ [field]: trimmed } as Partial<Tool>);
    }
  }
  // Keep ref updated to latest handleSettingsChange.
  handleSettingsChangeRef.current = handleSettingsChange;

  // Batch update function for AI assistant - updates all fields in one go to avoid stale closure issues.
  batchUpdateToolMetaRef.current = (fields: ToolMetaFields) => {
    const settingsUpdate: Partial<typeof settings> = {};
    const toolUpdate: Partial<Tool> = {};
    if (fields.id !== undefined) {
      const trimmed = fields.id.trim();
      settingsUpdate.id = trimmed;
      toolUpdate.id = trimmed;
    }
    if (fields.name !== undefined) {
      settingsUpdate.name = fields.name;
      toolUpdate.name = fields.name;
    }
    if (fields.namespace !== undefined) {
      const val = fields.namespace.slice(0, 30);
      settingsUpdate.namespace = val;
      toolUpdate.namespace = val.trim();
    }
    if (fields.category !== undefined) {
      const val = fields.category.slice(0, 30);
      settingsUpdate.category = val;
      toolUpdate.category = val.trim();
    }
    if (fields.description !== undefined) {
      settingsUpdate.description = fields.description;
      toolUpdate.description = fields.description;
    }
    if (fields.execInterval !== undefined) {
      settingsUpdate.execInterval = fields.execInterval;
      toolUpdate.extraInfo = buildNextExtraInfo(fields.execInterval);
    }
    if (Object.keys(settingsUpdate).length > 0) {
      setSettings((prev) => ({ ...prev, ...settingsUpdate }));
    }
    if (Object.keys(toolUpdate).length > 0) {
      emitToolUpdate(toolUpdate);
    }
  };

  function handleNamespaceSelect(value: string) {
    setIsNamespaceOpen(false);
    handleSettingsChange("namespace", value);
  }

  function handleCategorySelect(value: string) {
    setIsCategoryOpen(false);
    handleSettingsChange("category", value);
  }

  const handlerAnnotationContent = useMemo(() => {
    const dts = buildToolHandlerDts(tool?.uiWidgets ?? FALLBACK_WIDGETS);
    console.debug("[handler.d.ts]", dts);
    return dts;
  }, [tool?.uiWidgets]);

  const handlerAnnotationPath = tool?.id ? `ts:tool-${tool.id}-handler.d.ts` : "ts:tool-handler.d.ts";

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const trimmedName = settings.name.trim();
  const trimmedId = settings.id.trim();
  const trimmedNamespace = settings.namespace.trim();
  const trimmedExecInterval = settings.execInterval.trim();
  const isNameInvalid = trimmedName.length === 0;
  const isIdInvalid = trimmedId.length === 0;
  const isNamespaceInvalid = trimmedNamespace.length === 0;
  const isExecIntervalInvalid = trimmedExecInterval.length > 0 && parseExecIntervalMs(trimmedExecInterval) === null;
  const isIdConflict = useMemo(() => {
    if (!trimmedId || !allTools?.length) return false;
    return allTools.some((existing) => {
      const existingId = (existing.id ?? "").trim();
      if (!existingId || existingId !== trimmedId) return false;
      if (trimmedOriginalId && existingId === trimmedOriginalId && trimmedId === trimmedOriginalId) return false;
      return true;
    });
  }, [allTools, trimmedId, trimmedOriginalId]);
  const hasSettingsErrors = isNameInvalid || isIdInvalid || isNamespaceInvalid || isIdConflict || isExecIntervalInvalid;
  const namespaceOptions = useMemo(() => {
    const set = new Set<string>();
    (userTools ?? []).forEach((t) => {
      const ns = (t.namespace ?? "").trim();
      if (ns) set.add(ns);
    });
    return Array.from(set).sort();
  }, [userTools]);
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (userTools ?? []).forEach((t) => {
      const cat = (t.category ?? "").trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort();
  }, [userTools]);

  const handleConfirmDelete = useCallback(async () => {
    if (!onDeleteTool) return;
    await Promise.resolve(onDeleteTool());
    setIsDeleteDialogOpen(false);
  }, [onDeleteTool]);

  // Global Ctrl+S shortcut listener for all tabs (including tool settings)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        onSave?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex-1 flex flex-col border-border min-w-0 min-h-0 w-full border-b md:border-b-0 md:border-r pb-14 md:pb-0"
    >
      {/* Mobile layout: stack tabs and actions, allow horizontal scrolling for tabs. */}
      <div className="bg-background border-b border-border flex flex-col md:flex-row md:items-center px-0">
        <TabsList className="h-10 bg-transparent rounded-none border-b md:border-b-0 md:border-r border-border p-0 flex w-full md:w-auto overflow-x-auto">
          <TabsTrigger
            value="source"
            className="h-10 rounded-none border-r border-border data-[state=active]:bg-muted data-[state=active]:text-foreground px-3 text-xs font-medium"
          >
            source.handler
          </TabsTrigger>
          <TabsTrigger
            value="handler"
            className="h-10 rounded-none border-r border-border data-[state=active]:bg-muted data-[state=active]:text-foreground px-3 text-xs font-medium"
          >
            handler.d.ts
          </TabsTrigger>
          <TabsTrigger
            value="ui"
            className="h-10 rounded-none border-r border-border data-[state=active]:bg-muted data-[state=active]:text-foreground px-3 text-xs font-medium"
          >
            uiWidgets
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="h-10 rounded-none px-3 text-xs font-medium data-[state=active]:bg-muted data-[state=active]:text-foreground"
          >
            tool settings
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2 px-2 md:px-4 py-2 md:py-0 flex-nowrap justify-end w-full md:w-auto md:ml-auto overflow-x-auto">
          <button
            className={cn(
              "h-10 px-4 text-xs font-medium flex items-center gap-1.5 transition-colors relative text-primary",
              activeTab === "assistant"
                ? "bg-muted border-l border-t border-r border-border rounded-t-md after:absolute after:-bottom-px after:left-0 after:right-0 after:h-px after:bg-muted"
                : "hover:bg-muted/50"
            )}
            onClick={() => setActiveTab("assistant")}
          >
            <Wand2 className="h-3 w-3" />
            <span>AI Assistant</span>
          </button>
          <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1.5">
            <Check className="h-3 w-3 text-success" /> Synced
          </span>
          <div className="w-px h-4 bg-border/60 hidden sm:block" />
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={onSave}
            disabled={isSaving || hasSettingsErrors}
          >
            <Save className="h-3 w-3" /> {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 gap-1.5"
            onClick={onExit}
          >
            <DoorOpen className="h-3 w-3" /> Exit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={!onDeleteTool || isDeletingTool}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 bg-background relative overflow-hidden flex flex-col min-w-0 min-h-0">
        <TabsContent
          value="source"
          className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden min-w-0 min-h-0"
        >
          <div className="flex-1 bg-background relative overflow-hidden flex min-w-0 min-h-0">
            <MonacoCodeEditor
              defaultLanguage="javascript"
              language="javascript"
              value={sourceValue}
              onChange={handleSourceChange}
              extraLibContent={handlerAnnotationContent}
              extraLibPath={handlerAnnotationPath}
              jsExtraLibContent={globalScript}
              jsExtraLibPath="ts:tool-global-script.js"
              onSave={onSave}
            />
          </div>
          {/* Keep execution status above the fixed mobile preview bar. Hidden on desktop as preview panel has its own LogPanel. */}
          <div className="md:hidden" style={{ marginBottom: MOBILE_PREVIEW_BAR_HEIGHT }}>
            <LogPanel />
          </div>
        </TabsContent>

        <TabsContent
          value="handler"
          className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden min-w-0 min-h-0"
        >
          <div className="flex-1 bg-background relative overflow-hidden flex min-w-0 min-h-0">
            <MonacoCodeEditor
              defaultLanguage="typescript"
              language="typescript"
              value={handlerAnnotationContent}
              extraLibContent={undefined}
              extraLibPath={handlerAnnotationPath}
              readOnly
              height="100%"
            />
          </div>
        </TabsContent>

        <TabsContent
          value="ui"
          className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden min-w-0 min-h-0"
        >
          {/* <div className="flex items-center justify-between px-4 py-2 border-b border-border text-xs text-muted-foreground">
            <span>Define the widget schema powering this tool UI.</span>
          </div> */}
          <div className="flex-1 bg-background relative overflow-hidden flex min-w-0 min-h-0">
            <div className="flex-1 min-w-0 min-h-0">
              <MonacoCodeEditor
                defaultLanguage="json"
                language="json"
                value={uiSchemaValue}
                onChange={handleUiSchemaChange}
                onSave={onSave}
              />
            </div>
            <div className="hidden md:block">
              <UiWidgetsGuidePanel />
            </div>
          </div>
          <div className="md:hidden border-t border-border bg-background" style={{ marginBottom: MOBILE_PREVIEW_BAR_HEIGHT }}>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">uiWidgets reference</span>
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded border border-border bg-muted/40 text-muted-foreground"
                onClick={() => setIsUiGuideOpen((prev) => !prev)}
              >
                {isUiGuideOpen ? "Hide" : "Show"}
              </button>
            </div>
            {isUiGuideOpen && (
              <div className="border-t border-border">
                {/* Keep the reference scrollable and avoid overlapping the fixed preview bar on mobile. */}
                <div className="h-[45vh] max-h-[45vh] overflow-hidden flex flex-col min-h-0">
                  <UiWidgetsGuidePanel
                    className="w-full h-full flex-1 min-h-0 border-l-0"
                    scrollStyle={{ paddingBottom: MOBILE_PREVIEW_SAFE_PADDING }}
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent
          value="assistant"
          forceMount
          className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden min-w-0 min-h-0"
        >
          <AiAssistantPanel editorGetters={editorGetters} />
        </TabsContent>

        <TabsContent
          value="settings"
          className="flex-1 flex flex-col mt-0 data-[state=inactive]:hidden min-w-0 min-h-0"
        >
          <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0">
            <div className="text-xs text-muted-foreground">Customize basic tool metadata.</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                <span className="block mb-1 leading-tight">Name</span>
                <Input
                  value={settings.name}
                  onChange={(event) => handleSettingsChange("name", event.target.value)}
                  className={cn("text-sm font-normal normal-case", isNameInvalid && "border-destructive focus-visible:ring-destructive/60")}
                />
                {isNameInvalid && <span className="mt-1 block text-[10px] text-destructive">Name is required.</span>}
              </label>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                <span className="block mb-1 leading-tight">ID</span>
                <Input
                  value={settings.id}
                  onChange={(event) => handleSettingsChange("id", event.target.value)}
                  className={cn("text-sm font-normal normal-case", (isIdInvalid || isIdConflict) && "border-destructive focus-visible:ring-destructive/60")}
                />
                {(isIdInvalid || isIdConflict) && (
                  <span className="mt-1 block text-[10px] text-destructive">
                    {isIdInvalid ? "ID is required." : "ID already exists. Please choose a different ID."}
                  </span>
                )}
              </label>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                <span className="block mb-1 leading-tight">Namespace</span>
                <Popover open={isNamespaceOpen} onOpenChange={setIsNamespaceOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-left shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                        isNamespaceInvalid && "border-destructive focus-visible:ring-destructive/60"
                      )}
                    >
                      <span className={cn("truncate", !settings.namespace && "text-muted-foreground")}>{settings.namespace || "Select or type namespace"}</span>
                      <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2 w-[240px]" align="start">
                    <div className="space-y-2">
                      <Input
                        value={settings.namespace}
                        onChange={(event) => handleSettingsChange("namespace", event.target.value)}
                        placeholder="Type namespace..."
                        className="h-8 text-xs"
                        maxLength={30}
                      />
                      {namespaceOptions.length > 0 && (
                        <div className="max-h-40 overflow-y-auto text-xs">
                          {namespaceOptions.map((ns) => (
                            <button
                              key={ns}
                              type="button"
                              onClick={() => handleNamespaceSelect(ns)}
                              className={cn(
                                "flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground",
                                settings.namespace.trim() === ns && "bg-accent text-accent-foreground"
                              )}
                            >
                              <span className="truncate">{ns}</span>
                              {settings.namespace.trim() === ns && <CheckIcon className="h-3 w-3" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {isNamespaceInvalid && <span className="mt-1 block text-[10px] text-destructive">Namespace is required.</span>}
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                <span className="block mb-1 leading-tight">Category</span>
                <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm font-normal text-left shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className={cn("truncate", !settings.category && "text-muted-foreground")}>{settings.category || "Select or type category"}</span>
                      <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="p-2 w-[240px]" align="start">
                    <div className="space-y-2">
                      <Input
                        value={settings.category}
                        onChange={(event) => handleSettingsChange("category", event.target.value)}
                        placeholder="Type category..."
                        className="h-8 text-xs"
                        maxLength={30}
                      />
                      {categoryOptions.length > 0 && (
                        <div className="max-h-40 overflow-y-auto text-xs">
                          {categoryOptions.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => handleCategorySelect(cat)}
                              className={cn(
                                "flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-accent hover:text-accent-foreground",
                                settings.category.trim() === cat && "bg-accent text-accent-foreground"
                              )}
                            >
                              <span className="truncate">{cat}</span>
                              {settings.category.trim() === cat && <CheckIcon className="h-3 w-3" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block">
              <span className="block mb-1 leading-tight">Description</span>
              <Textarea
                value={settings.description}
                onChange={(event) => handleSettingsChange("description", event.target.value)}
                className="text-sm font-normal normal-case min-h-[100px] resize-y"
                placeholder="Enter tool description..."
              />
            </label>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block">
              <span className="block mb-1 leading-tight">Execution Interval (ms)</span>
              <Input
                value={settings.execInterval}
                onChange={(event) => handleSettingsChange("execInterval", event.target.value)}
                placeholder="Leave empty to disable"
                className={cn("text-sm font-normal normal-case", isExecIntervalInvalid && "border-destructive focus-visible:ring-destructive/60")}
              />
              {isExecIntervalInvalid && <span className="mt-1 block text-[10px] text-destructive">Must be a number ≥ 100.</span>}
            </label>
            <div className="text-[11px] text-muted-foreground">
              Additional settings coming soon.
            </div>
          </div>
        </TabsContent>
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
              onClick={()=> {void handleConfirmDelete();}}
              disabled={!onDeleteTool || isDeletingTool}
            >
              {isDeletingTool ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
