import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

// Tool definition for uploading audio and slicing it into editable segments.
export const OfficialToolAudioCutStudio: Tool = {
  id         : "official-audio-cut-studio",
  uid        : "uid-official-audio-cut-studio",
  name       : "Audio Cut Studio",
  namespace  : "🎵 Audio Tools",
  category   : "✂️ Merger/Spliter",
  isOfficial : true,
  description: "Upload audio in the browser and edit it with a waveform slicer. Cut and rearrange segments, apply fades, preview changes instantly, then export your clips.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
