import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolVideoFormatConverter: Tool = {
  id         : "official-video-format-converter",
  uid        : "uid-official-video-format-converter",
  name       : "Video Format Converter",
  namespace  : "🎞️ Video Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple videos to any ffmpeg-supported format directly in the browser, preview each converted file, and download outputs with the original names.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
