import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolArchiveFileList: Tool = {
  id         : "official-archive-file-list",
  uid        : "uid-official-archive-file-list",
  name       : "Archive File Lister",
  namespace  : "🗄️ Archive Tools",
  category   : "📁 Files",
  isOfficial : true,
  description: "List every file inside ZIP, 7Z, RAR, TAR, and other archives instantly in your browser. Upload a single archive to view its full file tree, detect whether a password is required, and switch filename encodings to fix garbled names. No server upload required - everything runs locally with 7-Zip WASM.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
