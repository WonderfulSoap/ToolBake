import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolMarkdownRenderer: Tool = {
  id         : "official-markdown-renderer",
  uid        : "uid-official-markdown-renderer",
  name       : "Markdown Renderer",
  namespace  : "🛠️ Devt Tools",
  category   : "📖 Markdown",
  isOfficial : true,
  description: "Render Markdown into HTML with a live preview powered by markdown-it, and optionally enable HTML parsing, auto-linking, typographer enhancements, and soft line break handling while viewing the generated HTML output.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
