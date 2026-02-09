import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolVideoTrackMerger: Tool = {
  id         : "official-video-track-merger",
  uid        : "uid-official-video-track-merger",
  name       : "Video Track Merger/Muxer",
  namespace  : "🎞️ Video Tools",
  category   : "🎥 Demuxer/Muxer",
  isOfficial : true,
  description: "Merge a base video with extra audio, subtitle, and attachment tracks using ffprobe + ffmpeg.wasm. Customize the muxing command, keep every original stream, and download the merged output with an inline preview.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
