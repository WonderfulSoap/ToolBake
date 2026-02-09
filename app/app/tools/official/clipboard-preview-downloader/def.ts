import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolClipboardPreviewDownloader: Tool = {
  id         : "official-clipboard-preview-downloader",
  uid        : "uid-official-clipboard-preview-downloader",
  name       : "Clipboard Preview & Download",
  namespace  : "🛠️ Devt Tools",
  category   : "👀 Preview/Visualizer",
  isOfficial : true,
  description: "Paste clipboard content into the uploader to preview and download instantly. Supports text, images, audio, video, and PDFs with live previews and one-click export.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
