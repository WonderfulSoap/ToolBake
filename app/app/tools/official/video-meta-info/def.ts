import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolVideoMetaInfo: Tool = {
  id         : "official-video-meta-info",
  uid        : "uid-official-video-meta-info",
  name       : "Video Metadata Viewer",
  namespace  : "🎞️ Video Tools",
  category   : "🏷️ Video Metadata",
  isOfficial : true,
  description: "Inspect video files in the browser with ffprobe.wasm to reveal container details, stream codecs, resolution, duration, and raw JSON metadata for quick diagnostics.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
