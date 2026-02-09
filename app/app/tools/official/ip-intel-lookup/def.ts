import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolIpInfoLookup: Tool = {
  id         : "official-ip-info-lookup",
  uid        : "uid-official-ip-info-lookup",
  name       : "IP Information Lookup",
  namespace  : "🛠️ Devt Tools",
  category   : "🌐 Network Tools",
  isOfficial : true,
  description: "Query your public IP or a custom IP through ipapi.co, ip-api, and ipify. Compare provider limits, review normalized IP metadata, and inspect raw JSON responses with one-click lookup.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
