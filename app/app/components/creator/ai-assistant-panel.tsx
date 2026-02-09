import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { OpenAIClient } from "~/data/llm/openai-client/openai-client";
import { OpenAIConversation } from "~/data/llm/openai-client/openai-conversation";
import { OpenAITool, OpenAITools } from "~/data/llm/openai-client/openai-func-call-tool";
import { useSettings } from "~/hooks/use-settings";
import { AiAssistantPanelInputBox, type ChatSendHandler } from "./ai-assistant-panel-input-box";
import type { ResponseOutputItem } from "openai/resources/responses/responses.mjs";
import z from "zod";
import { ToolBakePrompt } from "~/data/llm/openai-client/llm-prompt";

// Output item types for rendering in UI.
type AiOutputItem =
  | { type: "text"; text: string }
  | { type: "reasoning"; summary: string; content?: string }
  | { type: "function_call"; name: string; arguments: string }
  | { type: "function_result"; name: string; result: string };

interface AiAssistantChatMessage {
  id         : string;
  role       : "assistant" | "user" | "tool";    // tool = function call output (displayed on right like user)
  content    : string;
  outputs?   : AiOutputItem[];                   // Structured output items for assistant messages.
  images?    : string[];                         // Base64 image URLs for user messages.
  status?    : "success" | "error" | "loading";  // Response status for assistant messages.
  userText?  : string;                           // Original user text for retry on error.
  userImages?: string[];                         // Original images for retry on error.
  model?     : string;                           // Model name for assistant messages.
  toolName?  : string;                           // Tool name for tool role messages.
}

const INITIAL_MESSAGES: AiAssistantChatMessage[] = [
  { id: "m-1", role: "assistant", content: "Hi! Ask me about handler logic or UI widgets." },
];

// Parse OpenAI response output items into UI-renderable items.
function parseOutputItems(outputs: ResponseOutputItem[]): AiOutputItem[] {
  const items: AiOutputItem[] = [];
  for (const item of outputs) {
    if (item.type === "message" && item.content) {
      for (const part of item.content) {
        if (part.type === "output_text") items.push({ type: "text", text: part.text });
      }
    } else if (item.type === "reasoning") {
      // Extract summary text from reasoning item.
      const summaryTexts = item.summary?.map((s) => ("text" in s ? s.text : "")).filter(Boolean) ?? [];
      const contentTexts = item.content?.map((c) => ("text" in c ? c.text : "")).filter(Boolean) ?? [];
      items.push({ type: "reasoning", summary: summaryTexts.join("\n"), content: contentTexts.join("\n") || undefined });
    } else if (item.type === "function_call") {
      items.push({ type: "function_call", name: item.name, arguments: item.arguments });
    }
  }
  return items;
}

// Helper to extract plain text content for fallback display.
function getTextFromOutputItems(items: AiOutputItem[]): string {
  return items.filter((i) => i.type === "text").map((i) => (i as { text: string }).text).join("\n") || "(No response)";
}

// Collapsible block for reasoning output.
function AiOutputReasoningBlock({ summary, content }: { summary: string; content?: string }) {
  const [expanded, setExpanded] = useState(false);
  const displayText = content || summary;
  return (
    <div className="mt-1.5 border-l-2 border-yellow-500/50 pl-2">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1 text-[10px] text-yellow-600 dark:text-yellow-400 hover:underline">
        <span>{expanded ? "▼" : "▶"}</span>
        <span className="font-medium">Reasoning</span>
        {!displayText && <span className="opacity-50">(empty)</span>}
      </button>
      {expanded && <div className="mt-1 text-[11px] text-muted-foreground whitespace-pre-wrap">{displayText || "(No reasoning content)"}</div>}
    </div>
  );
}

// Collapsible block for function call request (AI requesting to call a function).
function AiOutputFunctionCallBlock({ name, arguments: args }: { name: string; arguments: string }) {
  const [expanded, setExpanded] = useState(false);
  let formattedArgs = args;
  try { formattedArgs = JSON.stringify(JSON.parse(args), null, 2); } catch { /* keep original */ }
  return (
    <div className="mt-1.5 border-l-2 border-blue-500/50 pl-2">
      <div className="text-[9px] text-muted-foreground/70 mb-0.5">Function Call Request</div>
      <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400">
        <span className="font-medium">⚡ {name}</span>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="hover:underline">({expanded ? "hide params" : "show params"})</button>
      </div>
      {expanded && <pre className="mt-1 text-[10px] text-muted-foreground bg-muted/50 rounded p-1.5 overflow-x-auto">{formattedArgs}</pre>}
    </div>
  );
}

// Block for function call result (displayed as tool response).
function AiOutputFunctionResultBlock({ name, result }: { name: string; result: string }) {
  return (
    <div className="mt-1.5 border-l-2 border-green-500/50 pl-2">
      <div className="text-[10px] text-green-600 dark:text-green-400 font-medium">↩ {name} result:</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground whitespace-pre-wrap">{result}</div>
    </div>
  );
}

// Render a single output item based on its type.
function AiOutputItemRenderer({ item }: { item: AiOutputItem }) {
  if (item.type === "text") return <div className="whitespace-pre-wrap">{item.text}</div>;
  if (item.type === "reasoning") return <AiOutputReasoningBlock summary={item.summary} content={item.content} />;
  if (item.type === "function_call") return <AiOutputFunctionCallBlock name={item.name} arguments={item.arguments} />;
  if (item.type === "function_result") return <AiOutputFunctionResultBlock name={item.name} result={item.result} />;
  return null;
}

import type { CodeEditorInfoGetters } from "./code-editor";

interface AiAssistantPanelProps {
  /** Getter/setter functions for editor state and tool meta. */
  editorGetters?: CodeEditorInfoGetters;
}

// Standalone chat UI with internal OpenAI client state.
export function AiAssistantPanel({ editorGetters }: AiAssistantPanelProps) {
  const { data: settings } = useSettings();
  const [messages, setMessages] = useState<AiAssistantChatMessage[]>(() => INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [openAiClient, setOpenAiClient] = useState<OpenAIClient | null>(null);
  const conversationRef = useRef<OpenAIConversation>(new OpenAIConversation());
  const sendHandlerRef = useRef<ChatSendHandler | null>(null);
  const [showRawConversation, setShowRawConversation] = useState(false);

  // Keep ref to access latest getters in function tools without recreating them.
  const editorGettersRef = useRef(editorGetters);
  useEffect(() => { editorGettersRef.current = editorGetters; }, [editorGetters]);

  // Check if model is configured.
  const configuredModel = (settings?.otherInfo?.openaiModel ?? "").trim();
  const isModelMissing = !configuredModel;

  // AI function tools for updating handler source code and UI widgets.
  const aiTools = useMemo(() => {
    const updateHandlerTool = new OpenAITool({
      name       : "update_handler",
      description: "Update the tool's handler source code",
      func_params: z.object({ source: z.string().describe("The complete handler JavaScript source code") }),
      func       : (input) => {
        const getters = editorGettersRef.current;
        if (!getters) throw new Error("Editor getters not available");
        getters.setHandlerSource(input.source);
        return "ok";
      }
    });
    const updateUiWidgetsTool = new OpenAITool({
      name       : "update_ui_widgets",
      description: "Update the tool's UI widgets configuration json",
      func_params: z.object({ ui_widgets: z.string().describe("The complete uiWidgets JSON array string") }),
      func       : (input) => {
        const getters = editorGettersRef.current;
        if (!getters) throw new Error("Editor getters not available");
        const result = getters.setUiWidgetsJson(input.ui_widgets);
        return result.success ? "ok" : `error: ${result.error}`;
      }
    });
    // Tool to update tool meta fields (id, name, namespace, category, description, execInterval).
    const updateToolMetaTool = new OpenAITool({
      name       : "update_tool_meta",
      description: "Update the tool's meta fields. Only the specified fields will be updated.",
      func_params: z.object({
        id         : z.string().describe("The tool's unique identifier"),
        name       : z.string().describe("The tool's display name"),
        namespace  : z.string().describe("The namespace/group for the tool"),
        category   : z.string().describe("The category of the tool"),
        description: z.string().describe("A brief description of what the tool does"),
      }),
      func: (input) => {
        const getters = editorGettersRef.current;
        if (!getters) throw new Error("Editor getters not available");
        getters.setToolMeta(input);
        return "ok";
      }
    });
    // Tool to get current handler source and/or UI widgets JSON from editor.
    const getEditorInfoTool = new OpenAITool({
      name       : "get_handler_and_ui_widgets",
      description: "Get the current handler source code and/or UI widgets JSON from the editor. At least one of handler or ui_widgets must be true.",
      func_params: z.object({
        handler   : z.boolean().describe("Set true to get the current handler source code"),
        ui_widgets: z.boolean().describe("Set true to get the current UI widgets JSON"),
      }),
      func: (input) => {
        const getters = editorGettersRef.current;
        if (!input.handler && !input.ui_widgets) return JSON.stringify({ error: "At least one of handler or ui_widgets must be specified" });
        if (!getters) {
          throw new Error("Unexpected error: Editor getters not available");
        }
        return JSON.stringify({
          handler   : input.handler ? getters.getHandlerSource() : undefined,
          ui_widgets: input.ui_widgets ? getters.getUiWidgetsJson() : undefined,
        });
      }
    });
    return new OpenAITools([updateHandlerTool, updateUiWidgetsTool, updateToolMetaTool, getEditorInfoTool]);
  }, []);

  
  useEffect(() => {
    const userToolGenerationPrompt = new ToolBakePrompt().buildCreateUserToolSystemPrompt();
    conversationRef.current.addInput({
      role   : "system",
      content: userToolGenerationPrompt,
    });
  }, []);

  // Build the OpenAI client when settings are available.
  useEffect(() => {
    const otherInfo = settings?.otherInfo ?? {};
    const apiKey = (otherInfo.openaiApiKey ?? "").trim();
    const apiUrl = (otherInfo.openaiApiUrl ?? "").trim() || "https://api.openai.com/v1";
    if (!apiKey) {
      setOpenAiClient(null);
      return;
    }
    setOpenAiClient(new OpenAIClient(apiKey, apiUrl));
  }, [settings]);

  // Core function to send request to OpenAI API.
  async function requestAI(userText: string, images: string[] = []) {
    if (!openAiClient) return;

    // Build content array with text and images.
    const contentParts: Array<{ type: "input_text"; text: string } | { type: "input_image"; detail: "auto"; image_url: string }> = [];
    if (userText) contentParts.push({ type: "input_text", text: userText });
    for (const img of images) contentParts.push({ type: "input_image", detail: "auto", image_url: img });

    // Add user input to conversation history.
    conversationRef.current.addInput({
      role   : "user",
      content: contentParts.length > 0 ? contentParts : [{ type: "input_text", text: "" }],
    });

    // Add loading placeholder message.
    const loadingMsgId = `m-${Date.now()}`;
    setMessages((prev) => [...prev, { id: loadingMsgId, role: "assistant", content: "Thinking...", status: "loading", userText, userImages: images.length > 0 ? images : undefined, model: configuredModel }]);
    setIsLoading(true);

    try {
      const toolDefs = aiTools.toOpenAIApiRawToolDefinitions();
      let response = await openAiClient.responsesCreate(configuredModel, conversationRef.current.toOpenAIRequestInputs(), toolDefs);
      conversationRef.current.addOutputs(response.output);

      // Parse first response outputs.
      let outputItems = parseOutputItems(response.output);
      let functionCalls = conversationRef.current.dumpFunctionCalls(response.output);

      // If there are function calls, show first AI response then process function calls.
      if (functionCalls && functionCalls.length > 0) {
        // Replace loading message with first AI response (reasoning + function_call).
        const firstText = getTextFromOutputItems(outputItems);
        setMessages((prev) => prev.map((m) => m.id === loadingMsgId ? { ...m, content: firstText, outputs: outputItems, status: "success", model: configuredModel } : m));

        // Process function calls in a loop.
        while (functionCalls && functionCalls.length > 0) {
          const funcResults = aiTools.handleFunctionCalls(functionCalls);
          conversationRef.current.addInputs(funcResults);

          // Add tool messages (function_call_output) displayed on right side.
          const toolMessages: AiAssistantChatMessage[] = funcResults.map((fr, i) => ({
            id      : `tool-${Date.now()}-${i}`,
            role    : "tool" as const,
            content : fr.output,
            toolName: functionCalls![i].funcName,
          }));
          setMessages((prev) => [...prev, ...toolMessages]);

          // Add new loading message for next AI response.
          const nextLoadingId = `m-${Date.now()}`;
          setMessages((prev) => [...prev, { id: nextLoadingId, role: "assistant", content: "Thinking...", status: "loading", model: configuredModel }]);

          // Request again with function results.
          response = await openAiClient.responsesCreate(configuredModel, conversationRef.current.toOpenAIRequestInputs(), toolDefs);
          conversationRef.current.addOutputs(response.output);
          outputItems = parseOutputItems(response.output);
          functionCalls = conversationRef.current.dumpFunctionCalls(response.output);

          // Replace loading message with new AI response.
          const nextText = getTextFromOutputItems(outputItems);
          setMessages((prev) => prev.map((m) => m.id === nextLoadingId ? { ...m, content: nextText, outputs: outputItems, status: "success", model: configuredModel } : m));
        }
      } else {
        // No function calls - just replace loading message with response.
        const assistantText = getTextFromOutputItems(outputItems);
        setMessages((prev) => prev.map((m) => m.id === loadingMsgId ? { ...m, content: assistantText, outputs: outputItems, status: "success", model: configuredModel } : m));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      // Replace loading message with error.
      setMessages((prev) => prev.map((m) => m.id === loadingMsgId ? { ...m, content: `Error: ${errMsg}`, status: "error" } : m));
    } finally {
      setIsLoading(false);
    }
  }

  // Handle send from ChatInputBox via ref.
  function handleSend(userText: string, userImages: string[]) {
    if (isLoading || !openAiClient || isModelMissing) return;
    if (!userText && userImages.length === 0) return;
    // Add user message to chat.
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: userText, images: userImages.length > 0 ? userImages : undefined }]);
    void requestAI(userText, userImages);
  }

  // Register send handler to ref for ChatInputBox.
  sendHandlerRef.current = { send: handleSend };

  // Retry a failed request using the original user text and images.
  async function handleRetry(msgId: string, userText: string, userImages?: string[]) {
    if (!openAiClient || isLoading) return;
    // Remove the failed message before retrying.
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    await requestAI(userText, userImages ?? []);
  }

  // Compute status message for ChatInputBox.
  const statusMessage = !openAiClient ? "Configure API key in settings" : isModelMissing ? "Configure model in settings" : `Using ${configuredModel}`;
  const statusError = !openAiClient || isModelMissing;
  const inputDisabled = isLoading || !openAiClient || isModelMissing;

  // Get formatted raw conversation JSON.
  function getRawConversationJson(): string {
    try { return JSON.stringify(JSON.parse(conversationRef.current.toJSON()), null, 2); }
    catch { return conversationRef.current.toJSON(); }
  }

  return (
    <div className="flex-1 p-4 flex flex-col gap-4 min-h-0">
      <style>{"@keyframes subtle-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }"}</style>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">Chat with AI to draft handler logic and UI ideas.</div>
        <button type="button" onClick={() => setShowRawConversation(true)} className="text-[10px] text-muted-foreground hover:text-foreground hover:underline">
          Show Raw
        </button>
      </div>
      <Dialog open={showRawConversation} onOpenChange={setShowRawConversation}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Raw Conversation</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded border border-border bg-muted/30 p-3">
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-all">{getRawConversationJson()}</pre>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex-1 rounded-lg border border-border bg-muted/20 p-4 overflow-y-auto space-y-3">
        {messages.map((message) => (
          <div key={message.id} className={cn("flex", message.role === "assistant" ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[75%] rounded-lg border px-3 py-2 text-xs leading-relaxed",
                message.role === "assistant"
                  ? message.status === "error"
                    ? "bg-destructive/10 border-destructive/40 text-foreground"
                    : message.status === "loading"
                      ? "bg-muted/50 border-border text-muted-foreground"
                      : "bg-background border-border text-foreground"
                  : message.role === "tool"
                    ? "bg-green-500/20 text-foreground border-green-500/40"
                    : "bg-primary text-primary-foreground border-primary/40"
              )}
              style={message.status === "loading" ? { animation: "subtle-blink 2s ease-in-out infinite" } : undefined}
            >
              <div className="text-[10px] tracking-wide opacity-70 mb-1">
                {message.role === "assistant" ? (message.model || "assistant") : message.role === "tool" ? "Function Call Output" : "you"}
              </div>
              {message.role === "tool" && <div className="text-[9px] text-green-600/70 dark:text-green-400/70 mb-1">↩ {message.toolName}</div>}
              {/* Display user images as thumbnails */}
              {message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {message.images.map((img, idx) => (
                    <img key={idx} src={img} alt={`attachment ${idx + 1}`} className="h-16 w-16 object-cover rounded border border-primary-foreground/30" />
                  ))}
                </div>
              )}
              {/* Render structured outputs if available, otherwise fallback to content */}
              {message.outputs && message.outputs.length > 0
                ? message.outputs.map((item, idx) => <AiOutputItemRenderer key={idx} item={item} />)
                : <div className="whitespace-pre-wrap">{message.content}</div>}
              {message.status === "error" && (message.userText || message.userImages) && (
                <Button
                  variant="outline" size="sm"
                  className="mt-2 h-6 text-[10px]"
                  disabled={isLoading}
                  onClick={() => { void handleRetry(message.id, message.userText ?? "", message.userImages); }}
                >
                  {isLoading ? "Retrying..." : "Retry"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <AiAssistantPanelInputBox
        sendHandlerRef={sendHandlerRef}
        disabled={inputDisabled}
        statusMessage={statusMessage}
        statusError={statusError}
      />
    </div>
  );
}
