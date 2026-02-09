/**
 * Script to generate official-tool-generate-guide.md with the official tool prompt.
 * Usage: vite-node scripts/gen-official-tool-prompt-doc.ts
 */
import fs from "node:fs";
import path from "node:path";
import { ToolBakePrompt } from "~/data/llm/openai-client/llm-prompt";

const OUTPUT_PATH = path.resolve(import.meta.dirname, "../prompt/official-tool-generate-guide.md");

function main() {
  const prompt = new ToolBakePrompt().buildCreateOfficialToolSystemPrompt();

  fs.writeFileSync(OUTPUT_PATH, prompt, "utf-8");
  console.log(`Generated: ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main();
