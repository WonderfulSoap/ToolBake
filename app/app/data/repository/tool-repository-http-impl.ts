import type { Client } from "~/data/generated-http-client/client";
import { deleteApiV1ToolsByToolUid, getApiV1GlobalScript, getApiV1Tools, postApiV1ToolsCreate, putApiV1GlobalScript, putApiV1ToolsByToolUid, type ToolsCreateToolRequestDto, type ToolsToolDto, type ToolsUpdateToolRequestDto } from "~/data/generated-http-client";
import { getApiV1GlobalScriptResponseTransformer, getApiV1ToolsResponseTransformer } from "~/data/generated-http-client/transformers.gen";
import { officialTools } from "../../tools/official-tool-list";
import type { Tool, ToolUIRows } from "~/entity/tool";
import type { IToolRepository, UserToolMutation } from "../interface/i-tool-repository";
import type { IAuthHelper } from "../interface/i-auth-helper";
import { httpClient as sharedHttpClient, HttpClient } from "../http-client/http-client";
import { logAndThrow } from "~/lib/utils";
import { ErrorHandler } from "~/error/error-checker";
import { sampleGlobalScriptSourceCode } from "../../tools/sample/sample-global-script";

export class HttpToolRepository implements IToolRepository {
  private readonly client    : Client;
  private readonly httpClient: HttpClient;
  private readonly authHelper: IAuthHelper;

  constructor(authHelper: IAuthHelper, httpClient: HttpClient = sharedHttpClient) {
    this.client = httpClient.client;
    this.httpClient = httpClient;
    this.authHelper = authHelper;
  }

  async fetchOfficialTools(): Promise<Tool[]> {
    return officialTools;
  }

  async fetchUserTools(): Promise<Tool[]> {
    return this.authHelper.executeWithAccessToken(async (headers) => {
      const response = await getApiV1Tools({
        client             : this.client,
        headers,
        throwOnError       : true,
        responseTransformer: getApiV1ToolsResponseTransformer,
      });
      const payload = response.data?.data?.tools ?? [];
      return payload.map((tool) => mapDtoToTool(tool));
    });
  }

  async fetchAllTools(): Promise<{ tools: Tool[]; userToolsError?: unknown; }> {
    const official = await this.fetchOfficialTools();
    try {
      const user = await this.fetchUserTools();
      return { tools: [...official, ...user] };
    } catch (error) {
      ErrorHandler.processError(error); // rethrow logout/refresh errors before falling back
      console.error("Failed to fetch user tools", error);
      return { tools: official, userToolsError: error };
    }
  }

  async createUserTool(payload: UserToolMutation): Promise<Tool[]> {
    const sanitized = sanitizeUserToolPayload(payload);
    return this.authHelper.executeWithAccessToken(async (headers) => {
      await postApiV1ToolsCreate({
        client       : this.client,
        headers,
        body         : buildCreateRequestPayload(sanitized),
        responseStyle: "data",
        throwOnError : true,
      });
      const response = await getApiV1Tools({
        client             : this.client,
        headers,
        throwOnError       : true,
        responseTransformer: getApiV1ToolsResponseTransformer,
      });
      const payload = response.data?.data?.tools ?? [];
      return payload.map((tool) => mapDtoToTool(tool));
    });
  }

  async updateUserTool(toolUid: string, updates: Partial<UserToolMutation>): Promise<Tool[]> {
    if (!toolUid) logAndThrow("Tool uid is required.");
    return this.authHelper.executeWithAccessToken(async (headers) => {
      const currentToolsResponse = await getApiV1Tools({
        client             : this.client,
        headers,
        throwOnError       : true,
        responseTransformer: getApiV1ToolsResponseTransformer,
      });
      const currentTools = currentToolsResponse.data?.data?.tools ?? [];
      const existing = currentTools.map((tool) => mapDtoToTool(tool)).find((tool) => tool.uid === toolUid);
      if (!existing) logAndThrow(`Tool with uid "${toolUid}" does not exist.`);
      const merged = sanitizeUserToolPayload({ ...existing, ...updates, uid: toolUid });
      await putApiV1ToolsByToolUid({
        client       : this.client,
        headers,
        path         : { tool_uid: toolUid },
        body         : buildUpdateRequestPayload(merged),
        responseStyle: "data",
        throwOnError : true,
      });
      const response = await getApiV1Tools({
        client             : this.client,
        headers,
        throwOnError       : true,
        responseTransformer: getApiV1ToolsResponseTransformer,
      });
      const payload = response.data?.data?.tools ?? [];
      return payload.map((tool) => mapDtoToTool(tool));
    });
  }

  async deleteUserTool(toolUid: string): Promise<Tool[]> {
    if (!toolUid) logAndThrow("Tool uid is required.");
    return this.authHelper.executeWithAccessToken(async (headers) => {
      await deleteApiV1ToolsByToolUid({ client: this.client, headers, path: { tool_uid: toolUid }, responseStyle: "data", throwOnError: true });
      const response = await getApiV1Tools({
        client             : this.client,
        headers,
        throwOnError       : true,
        responseTransformer: getApiV1ToolsResponseTransformer,
      });
      const payload = response.data?.data?.tools ?? [];
      return payload.map((tool) => mapDtoToTool(tool));
    });
  }

  async resetUserTools(_: UserToolMutation[] = []): Promise<Tool[]> {
    throw new Error("Reset user tools is not supported when you are logined.");
  }

  async fetchGlobalScript(): Promise<string> {
    let globalScript: string;
    try{
      globalScript = await this.authHelper.executeWithAccessToken(async (headers) => {
        const response = await getApiV1GlobalScript({
          client             : this.client,
          headers,
          throwOnError       : true,
          responseTransformer: getApiV1GlobalScriptResponseTransformer,
        });
        const script = response.data.data.global_script;
        return typeof script === "string" ? script : "";
      });
    } catch (error) {
      ErrorHandler.processError(error); // surface auth-triggered logout before local fallback
      // if no global script found, return sample global script
      if (ErrorHandler.isFileNotFound(error)){
        globalScript = sampleGlobalScriptSourceCode;
      }else{
        throw error;
      }

    }

    return globalScript;

  }

  async saveGlobalScript(script: string): Promise<string> {
    return this.authHelper.executeWithAccessToken(async (headers) => {
      const payload = typeof script === "string" ? script : "";
      await putApiV1GlobalScript({
        client       : this.client,
        headers,
        body         : { global_script: payload },
        responseStyle: "data",
        throwOnError : true,
      });
      const response = await getApiV1GlobalScript({
        client             : this.client,
        headers,
        throwOnError       : true,
        responseTransformer: getApiV1GlobalScriptResponseTransformer,
      });
      const saved = response.data?.data?.global_script;
      return typeof saved === "string" ? saved : payload;
    });
  }

}

function mapDtoToTool(dto: ToolsToolDto): Tool {
  return {
    id               : dto.tool_id,
    uid              : dto.uid,
    name             : dto.name,
    namespace        : dto.namespace,
    category         : dto.category,
    isOfficial       : false,
    isActive         : dto.is_activate,
    realtimeExecution: dto.realtime_execution,
    description      : dto.description ?? "",
    extraInfo        : dto.extra_info ?? {},
    uiWidgets        : parseUiWidgets(dto.ui_widgets),
    source           : dto.source,
  };
}

function buildCreateRequestPayload(tool: UserToolMutation): ToolsCreateToolRequestDto {
  return buildToolRequestPayload(tool);
}

function buildUpdateRequestPayload(tool: UserToolMutation): ToolsUpdateToolRequestDto {
  return buildToolRequestPayload(tool);
}

function buildToolRequestPayload(tool: UserToolMutation): ToolsCreateToolRequestDto {
  const id = tool.id?.trim();
  if (!id) logAndThrow("Tool id is required.");
  const name = tool.name?.trim();
  if (!name) logAndThrow("Tool name is required.");
  const source = typeof tool.source === "string" ? tool.source : "";
  const namespace = typeof tool.namespace === "string" ? tool.namespace.trim() : "";
  const category = typeof tool.category === "string" ? tool.category.trim() : "";
  const description = typeof tool.description === "string" ? tool.description : "";
  const extraInfo = tool.extraInfo && typeof tool.extraInfo === "object" ? tool.extraInfo : {};
  return {
    id,
    name,
    namespace         : namespace || "default",
    category,
    source,
    description,
    extra_info        : extraInfo,
    ui_widgets        : serializeUiWidgets(tool.uiWidgets),
    is_activate       : tool.isActive ?? true,
    realtime_execution: tool.realtimeExecution ?? false,
  };
}

function sanitizeUserToolPayload(payload: UserToolMutation): UserToolMutation {
  return { ...payload, isOfficial: false };
}

function parseUiWidgets(raw?: string | null): ToolUIRows {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ToolUIRows) : [];
  } catch (error) {
    console.error("Failed to parse tool uiWidgets", error);
    return [];
  }
}

function serializeUiWidgets(rows?: ToolUIRows): string {
  try {
    return JSON.stringify(rows ?? []);
  } catch (error) {
    console.error("Failed to serialize tool uiWidgets", error);
    return "[]";
  }
}
