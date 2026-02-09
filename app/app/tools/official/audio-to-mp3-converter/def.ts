import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToMp3Converter: Tool = {
  id         : "official-audio-to-mp3-converter",
  uid        : "uid-official-audio-to-mp3-converter",
  name       : "Audio to MP3 Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to MP3 in the browser with ffmpeg.wasm. Choose CBR, VBR, or ABR encoding modes with dedicated parameters, then preview and download all converted tracks.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
