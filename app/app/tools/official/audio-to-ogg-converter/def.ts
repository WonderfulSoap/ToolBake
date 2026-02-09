import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToOggConverter: Tool = {
  id         : "official-audio-to-ogg-converter",
  uid        : "uid-official-audio-to-ogg-converter",
  name       : "Audio to OGG Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to OGG (Vorbis) in the browser with ffmpeg.wasm. Pick quality or bitrate encoding, keep metadata when possible, and download all converted tracks with previews.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
