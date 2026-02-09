import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToWavConverter: Tool = {
  id         : "official-audio-to-wav-converter",
  uid        : "uid-official-audio-to-wav-converter",
  name       : "Audio to WAV Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to WAV in the browser with ffmpeg.wasm. Preserves original filenames, shows conversion progress, and provides instant previews and downloads.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
