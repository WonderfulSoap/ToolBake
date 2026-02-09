import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolUUIDGenerator: Tool = {
  id         : "official-uuid-generator",
  uid        : "uid-official-uuid-generator",
  name       : "UUID Generator",
  namespace  : "🛠️ Devt Tools",
  category   : "🎲 Generator",
  isOfficial : true,
  description: "Generate universally unique identifiers (UUIDs) in various versions including UUIDv1, UUIDv4, UUIDv6, and UUIDv7. Customize options such as namespace and name for UUIDv5 generation. Ideal for developers needing unique IDs for databases, sessions, or distributed systems.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
