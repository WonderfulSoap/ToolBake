import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToPcmConverter: Tool = {
  id         : "official-audio-to-pcm-converter",
  uid        : "uid-official-audio-to-pcm-converter",
  name       : "Audio to PCM Converter",
  namespace  : "🎵 Audio Tools",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to raw PCM in the browser with ffmpeg.wasm. Choose sample format, sample rate, and channel count, then download the converted outputs.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
