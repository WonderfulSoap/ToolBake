import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolVideoFormatConverterAdvanced: Tool = {
  id         : "official-video-format-converter-advanced",
  uid        : "uid-official-video-format-converter-advanced",
  name       : "Video Format Converter (Advanced)",
  namespace  : "🎞️ Video Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple videos with ffmpeg.wasm using optional custom arguments, preview each generated command per file, and download the converted outputs with inline previews.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
