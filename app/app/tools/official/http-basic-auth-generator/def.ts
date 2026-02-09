import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolHttpBasicAuthGenerator: Tool = {
  id         : "official-http-basic-auth-generator",
  uid        : "uid-official-http-basic-auth-generator",
  name       : "HTTP Basic Auth Header Generator",
  namespace  : "🛠️ Devt Tools",
  category   : "🚀 API Tools",
  isOfficial : true,
  description: "Generate HTTP Basic Authorization headers from username and password. Computes the Base64 encoded credentials required for Basic Authentication.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
