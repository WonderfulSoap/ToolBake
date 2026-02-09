import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolSqlPrettify: Tool = {
  id         : "official-sql-prettify",
  uid        : "uid-official-sql-prettify",
  name       : "SQL Prettify",
  namespace  : "🛠️ Devt Tools",
  category   : "🔄 Converter",
  isOfficial : true,
  description: "Prettify SQL instantly with a clean in-browser formatter. Paste raw queries to get readable, well-indented SQL for faster debugging, reviews, and documentation.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
