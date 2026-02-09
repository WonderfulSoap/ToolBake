/**
 * Dynamic loader for official tools data.
 * This file is designed to be code-split into a separate chunk,
 * allowing the main bundle to stay small while tools data is loaded on demand.
 *
 * For browser: tools are loaded asynchronously after initial page render.
 * For SSG/prerender: tools are imported directly to generate static HTML.
 */

import type { Tool } from "~/entity/tool";

// Re-export the full tool list for dynamic import
export { officialTools } from "./official-tool-list";

/**
 * Dynamically load official tools data.
 * Returns a promise that resolves to the tool array.
 */
export async function loadOfficialTools(): Promise<Tool[]> {
  const { officialTools } = await import("./official-tool-list");
  return officialTools;
}
