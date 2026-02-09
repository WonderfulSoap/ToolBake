import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolHashFile: Tool = {
  id         : "official-hash-file",
  uid        : "uid-official-hash-file",
  name       : "File Hash Generator",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Generate common cryptographic hashes (MD5, SHA variants, RIPEMD160) from uploaded files with selectable output encodings.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
