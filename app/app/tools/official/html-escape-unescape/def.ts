import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolHtmlEscapeUnescape: Tool = {
  id         : "official-html-escape-unescape",
  uid        : "uid-official-html-escape-unescape",
  name       : "HTML Escape/Unescape",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Escape and unescape HTML text instantly. Convert special characters like <, >, &, \", and ' to their HTML entity equivalents. Customize escaping for additional characters like spaces, forward slashes, and backticks with optional toggles.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};

