import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolULIDGenerator: Tool = {
  id         : "official-ulid-generator",
  uid        : "uid-official-ulid-generator",
  name       : "ULID Generator",
  namespace  : "🛠️ Devt Tools",
  category   : "🎲 Generator",
  isOfficial : true,
  description: "Generate Universally Unique Lexicographically Sortable Identifiers (ULIDs) with this online tool. ULIDs are 26-character alphanumeric strings that provide a unique identifier while maintaining chronological order. This tool allows you to create ULIDs for use in databases, distributed systems, and applications requiring unique IDs. Perfect for developers and engineers looking for a reliable and efficient way to generate sortable unique identifiers.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
