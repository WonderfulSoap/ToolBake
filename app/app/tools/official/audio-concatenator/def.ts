import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioConcatenator: Tool = {
  id         : "official-audio-concatenator",
  uid        : "uid-official-audio-concatenator",
  name       : "Audio Concatenator/Merger",
  namespace  : "🎵 Audio Tools",
  category   : "✂️ Merger/Spliter",
  isOfficial : true,
  description: "Concatenate multiple audio files in the browser with ffmpeg.wasm. Validates identical formats, lets you reorder tracks via a sortable list, inserts optional silence gaps, and produces a downloadable merged file with progress feedback.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
