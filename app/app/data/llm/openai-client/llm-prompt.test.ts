import { describe, expect, it } from "vitest";
import { ToolBakePrompt } from "./llm-prompt";

describe("ToolBakePrompt", () => {
  it("should build system prompt with uiwidgets placeholder", () => {
    const prompt = new ToolBakePrompt().buildCreateUserToolSystemPrompt();
    expect(prompt).toContain("uiWidgets object reference");
    
  });
});
