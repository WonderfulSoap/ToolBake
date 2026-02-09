import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolFfmpegFilterList: Tool = {
  id         : "official-ffmpeg-filter-list",
  uid        : "uid-official-ffmpeg-filter-list",
  name       : "FFmpeg.wasm Filter List",
  namespace  : "🎞️ Video Tools",
  category   : "⚡ FFmpeg Wasm",
  isOfficial : true,
  description: "List every audio, video, and source/sink filter supported by ffmpeg.wasm in the browser, with grouped summaries and raw filter output for quick reference.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
