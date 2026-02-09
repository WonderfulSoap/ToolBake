import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioFilterLab: Tool = {
  id         : "official-audio-filter-lab",
  uid        : "uid-official-audio-filter-lab",
  name       : "Audio Filter Lab",
  namespace  : "🎵 Audio Tools",
  category   : "🎛️ Mixer",
  isOfficial : true,
  description: "Apply common FFmpeg audio filters like compression, bass/treble boosts, echo, and loudness normalization to multiple files in the browser, with real-time progress and instant downloads.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
