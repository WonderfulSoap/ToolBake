import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToAacConverter: Tool = {
  id         : "official-audio-to-aac-converter",
  uid        : "uid-official-audio-to-aac-converter",
  name       : "Audio to AAC Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to AAC in the browser with ffmpeg.wasm. Choose CBR, VBR, or ABR modes, tune quality settings, and optionally select AAC profiles before downloading the results.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
