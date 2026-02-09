import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolFfmpegCodecList: Tool = {
  id         : "official-ffmpeg-codec-list",
  uid        : "uid-official-ffmpeg-codec-list",
  name       : "FFmpeg Audio/Video Codec List",
  namespace  : "🎞️ Video Tools",
  category   : "⚡ FFmpeg Wasm",
  isOfficial : true,
  description: "List all audio and video encoders/decoders supported by ffmpeg.wasm directly in the browser, with categorized summaries and raw codec output for quick capability checks.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
