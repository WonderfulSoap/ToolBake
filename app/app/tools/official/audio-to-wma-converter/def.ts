import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToWmaConverter: Tool = {
  id         : "official-audio-to-wma-converter",
  uid        : "uid-official-audio-to-wma-converter",
  name       : "Audio to WMA Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to WMA in the browser with ffmpeg.wasm. Choose WMA Standard or WMA Pro profiles with target bitrate, and download all converted tracks with previews.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
