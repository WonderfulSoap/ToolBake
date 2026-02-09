import { buildUiWidgetsReferenceMarkdown } from "~/components/input-widgets/input-types";
import promptMd from "./prompts/prompt.md?raw";
import commonPromptMd from "./prompts/common-prompt.md?raw";
import officialToolPromptMd from "./prompts/official-tool-prompt.md?raw";
import { getEmbeddedPackageDTsDef } from "~/config/embedded-packages";

/** Map of filename to content for {#filename#} placeholder resolution */
const promptFiles: Record<string, string> = { 
  "common-prompt.md"       : commonPromptMd, 
  "official-tool-prompt.md": officialToolPromptMd 
};

/** Replaces {#filename#} placeholders with file contents */
function resolveFileIncludes(content: string): string {
  let result = content;
  for (const [filename, fileContent] of Object.entries(promptFiles)) {
    result = result.replaceAll(`{#${filename}#}`, fileContent);
  }
  return result;
}

/**
 * Provides system prompt for ToolBake AI assistant.
 * The prompt content is loaded from prompt.md at build time via Vite's ?raw import.
 */
export class ToolBakePrompt {
  /**
   * Builds and returns the system prompt string.
   * Supports {#filename.md#} syntax to include files from prompts directory.
   */
  public buildCreateUserToolSystemPrompt(): string {
    const widgetsReferenceMarkdown = buildUiWidgetsReferenceMarkdown(3);
    const embededPackageDTS = getEmbeddedPackageDTsDef();
    return resolveFileIncludes(promptMd)
      .replace("{#uiwidgets#}", widgetsReferenceMarkdown)
      .replace("{#embeded_packages#}", embededPackageDTS);
  }

  public buildCreateOfficialToolSystemPrompt(): string {
    const widgetsReferenceMarkdown = buildUiWidgetsReferenceMarkdown(3);
    const embededPackageDTS = getEmbeddedPackageDTsDef();
    return resolveFileIncludes(officialToolPromptMd)
      .replace("{#uiwidgets#}", widgetsReferenceMarkdown)
      .replace("{#embeded_packages#}", embededPackageDTS);
  }
  
}