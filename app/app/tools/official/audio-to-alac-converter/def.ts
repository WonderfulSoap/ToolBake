import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToAlacConverter: Tool = {
  id         : "official-audio-to-alac-converter",
  uid        : "uid-official-audio-to-alac-converter",
  name       : "Audio to ALAC Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to Apple Lossless (ALAC) in the browser with ffmpeg.wasm. Choose M4A or CAF containers with bit depth selection and download all converted files with previews.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
