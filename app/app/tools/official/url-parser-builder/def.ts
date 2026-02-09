import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolUrlParserBuilder: Tool = {
  id         : "official-url-parser-builder",
  uid        : "uid-official-url-parser-builder",
  name       : "URL Parser & Builder",
  namespace  : "🛠️ Devt Tools",
  category   : "🚀 API Tools",
  isOfficial : true,
  description: "Parse URLs into their component parts (protocol, username, password, hostname, port, pathname, search, hash) and edit them individually to rebuild URLs. Supports bidirectional conversion with optional URL decoding for query parameters. Perfect for debugging APIs, analyzing URLs, and constructing complex query strings.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};

