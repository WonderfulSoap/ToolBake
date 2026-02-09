import type { Tool } from "~/entity/tool";
import { sampleGlobalScriptSourceCode } from "../../tools/sample/sample-global-script";
import type { AccessToken } from "../interface/i-auth-repository";
import type { IToolRepository, UserToolMutation } from "../interface/i-tool-repository";

export const USER_TOOLS_STORAGE_KEY = "toolbake.userTools";
export const GLOBAL_SCRIPT_STORAGE_KEY = "toolbake.globalScript";

export class LocalToolRepository implements IToolRepository {
  private cachedUserTools   : Tool[] | null = null;
  private cachedGlobalScript: string | null = null;
  constructor(
    private readonly storageKey: string = USER_TOOLS_STORAGE_KEY,
    private readonly globalScriptStorageKey: string = GLOBAL_SCRIPT_STORAGE_KEY
  ) { }

  private isBrowserEnvironment(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  private readUserToolsFromStorage(): Tool[] | null {
    if (this.cachedUserTools) return this.cachedUserTools;
    if (!this.isBrowserEnvironment()) return null;
    try {
      const payload = window.localStorage.getItem(this.storageKey);
      if (!payload) return null;
      const parsed = JSON.parse(payload);
      if (!Array.isArray(parsed)) return null;
      this.cachedUserTools = (parsed as Tool[]).map((tool) => ({
        ...tool,
        description: typeof tool.description === "string" ? tool.description : "",
        category   : typeof tool.category === "string" ? tool.category : "",
        extraInfo  : tool.extraInfo && typeof tool.extraInfo === "object" ? tool.extraInfo : {},
      }));
      return this.cachedUserTools;
    } catch (error) {
      console.error("Failed to parse stored user tools", error);
      return null;
    }
  }

  private persistUserTools(tools: Tool[]) {
    this.cachedUserTools = tools;
    if (!this.isBrowserEnvironment()) return;
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(tools));
    } catch (error) {
      console.error("Failed to persist user tools", error);
    }
  }

  private readGlobalScriptFromStorage(): string | null {
    if (typeof this.cachedGlobalScript === "string") return this.cachedGlobalScript;
    if (!this.isBrowserEnvironment()) return null;
    try {
      return window.localStorage.getItem(this.globalScriptStorageKey);
    } catch (error) {
      console.error("Failed to read stored global script", error);
      return null;
    }
  }

  private persistGlobalScript(script: string) {
    this.cachedGlobalScript = script;
    if (!this.isBrowserEnvironment()) return;
    try {
      window.localStorage.setItem(this.globalScriptStorageKey, script);
    } catch (error) {
      console.error("Failed to persist global script", error);
    }
  }

  private ensureUserToolsInitialized(): Tool[] {
    const stored = this.readUserToolsFromStorage();
    if (stored) return stored;
    this.cachedUserTools = [];
    return [];
  }

  private sanitizeUserToolPayload(payload: UserToolMutation): Tool {
    return { ...payload, isOfficial: false, uid: payload.uid || this.generateUid() };
  }

  private generateUid(): string {
    return `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private resolveGlobalScriptValue(rawScript?: string | null): string {
    if (rawScript && rawScript.trim().length > 0) return rawScript;
    return sampleGlobalScriptSourceCode;
  }

  async fetchOfficialTools(_accessToken?: AccessToken): Promise<Tool[]> {
    // Dynamic import to enable code splitting - official tools loaded on demand
    const { officialTools } = await import("../../tools/official-tool-list");
    return officialTools;
  }

  async fetchUserTools(_accessToken?: AccessToken): Promise<Tool[]> {
    const tools = this.ensureUserToolsInitialized();
    return tools.map((tool) => ({ ...tool }));
  }

  async fetchAllTools(accessToken?: AccessToken): Promise<{ tools: Tool[]; userToolsError?: unknown; }> {
    const official = await this.fetchOfficialTools(accessToken);
    try {
      const user = await this.fetchUserTools(accessToken);
      return { tools: [...official, ...user] };
    } catch (error) {
      console.error("Failed to fetch user tools", error);
      return { tools: official, userToolsError: error };
    }
  }

  async createUserTool(payload: UserToolMutation): Promise<Tool[]> {
    const current = this.ensureUserToolsInitialized();
    if (current.some((tool) => tool.id === payload.id)) throw new Error(`Tool with id "${payload.id}" already exists.`);
    const nextTools = [...current, this.sanitizeUserToolPayload(payload)];
    this.persistUserTools(nextTools);
    return nextTools.map((tool) => ({ ...tool }));
  }

  async updateUserTool(toolUid: string, updates: Partial<UserToolMutation>): Promise<Tool[]> {
    const current = this.ensureUserToolsInitialized();
    const index = current.findIndex((tool) => tool.uid === toolUid);
    if (index === -1) throw new Error(`Tool with uid "${toolUid}" does not exist.`);
    const nextTools = [...current];
    const existingTool = nextTools[index];
    nextTools[index] = this.sanitizeUserToolPayload({ ...existingTool, ...updates, uid: toolUid });
    this.persistUserTools(nextTools);
    return nextTools.map((tool) => ({ ...tool }));
  }

  async deleteUserTool(toolUid: string): Promise<Tool[]> {
    const current = this.ensureUserToolsInitialized();
    const nextTools = current.filter((tool) => tool.uid !== toolUid);
    if (nextTools.length === current.length) throw new Error(`Tool with uid "${toolUid}" does not exist.`);
    this.persistUserTools(nextTools);
    return nextTools.map((tool) => ({ ...tool }));
  }

  async resetUserTools(tools?: UserToolMutation[]): Promise<Tool[]> {
    const sanitized = (tools ?? []).map((tool) => this.sanitizeUserToolPayload(tool));
    this.persistUserTools(sanitized);
    return sanitized.map((tool) => ({ ...tool }));
  }

  async fetchGlobalScript(_accessToken?: AccessToken): Promise<string> {
    const stored = this.readGlobalScriptFromStorage();
    const resolved = this.resolveGlobalScriptValue(stored);
    this.cachedGlobalScript = resolved;
    return resolved;
  }

  async saveGlobalScript(script: string): Promise<string> {
    const persisted = typeof script === "string" ? script : "";
    const resolved = this.resolveGlobalScriptValue(persisted);
    this.persistGlobalScript(persisted);
    this.cachedGlobalScript = resolved;
    return resolved;
  }
}
