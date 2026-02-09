import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolJsonMediaDataVisualizer: Tool = {
  id         : "official-json-media-data-visualizer",
  uid        : "uid-official-json-media-data-visualizer",
  name       : "Media Data In JSON Visualizer",
  namespace  : "🛠️ Devt Tools",
  category   : "👀 Preview/Visualizer",
  isOfficial : true,
  description: "Parse JSON and visualize embedded Base64 Data URIs with live media previews. Supports images, audio, video, PDF, and text content. Automatically prettifies JSON and provides download links for each detected Data URI field.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
