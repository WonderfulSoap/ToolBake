/**
 * Lightweight metadata for official tools used for SEO meta tags.
 * This file imports the full tool list but only extracts meta fields (id, name, description).
 *
 * Note: This import happens at build/prerender time, not at browser runtime.
 * The browser loads tools via dynamic import in LocalToolRepository.
 */

import { officialTools } from "./official-tool-list";

export interface ToolMeta {
  id         : string;
  name       : string;
  description: string;
  namespace  : string;
  category?  : string;
}

/**
 * Map of tool ID to lightweight meta info for SEO purposes.
 * Dynamically generated from officialTools array.
 */
export const officialToolsMeta: Record<string, ToolMeta> = Object.fromEntries(
  officialTools.map((tool) => [
    tool.id,
    { id: tool.id, name: tool.name, description: tool.description, namespace: tool.namespace, category: tool.category },
  ])
);
