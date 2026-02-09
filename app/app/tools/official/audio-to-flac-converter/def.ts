import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToFlacConverter: Tool = {
  id         : "official-audio-to-flac-converter",
  uid        : "uid-official-audio-to-flac-converter",
  name       : "Audio to FLAC Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to FLAC in the browser with ffmpeg.wasm. Choose compression level, bit depth, channel layout, and optional sample rate overrides, then download all converted files with previews.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
