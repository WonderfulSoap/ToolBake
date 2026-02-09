import type { Tool } from "~/entity/tool";

export type UserToolMutation = Omit<Tool, "isOfficial"> & { isOfficial?: boolean };

export interface IToolRepository {
  fetchOfficialTools(): Promise<Tool[]>;
  fetchUserTools(): Promise<Tool[]>;
  fetchAllTools(): Promise<{ tools: Tool[]; userToolsError?: unknown }>;
  createUserTool(payload: UserToolMutation): Promise<Tool[]>;
  updateUserTool(toolUid: string, updates: Partial<UserToolMutation>): Promise<Tool[]>;
  deleteUserTool(toolUid: string): Promise<Tool[]>;
  resetUserTools(tools?: UserToolMutation[]): Promise<Tool[]>;
  fetchGlobalScript(): Promise<string>;
  saveGlobalScript(script: string): Promise<string>;
}
