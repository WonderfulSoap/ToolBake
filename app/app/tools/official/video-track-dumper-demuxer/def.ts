import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolVideoTrackDumperDemuxer: Tool = {
  id         : "official-video-track-dumper-demuxer",
  uid        : "uid-official-video-track-dumper-demuxer",
  name       : "Video Track Dumper/Demuxer",
  namespace  : "🎞️ Video Tools",
  category   : "🎥 Demuxer/Muxer",
  isOfficial : true,
  description: "Demux every video, audio, subtitle, and attachment track from a single upload with ffprobe + ffmpeg.wasm, preview playable tracks, and download each stream with codec-aware filenames.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
