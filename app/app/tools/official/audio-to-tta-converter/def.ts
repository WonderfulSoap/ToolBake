import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToTtaConverter: Tool = {
  id         : "official-audio-to-tta-converter",
  uid        : "uid-official-audio-to-tta-converter",
  name       : "Audio to TTA Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to TTA (True Audio) in the browser with ffmpeg.wasm. Adjust channel layout or sample rate when needed, and download all converted tracks with previews.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
