import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioMetaArtworkEditor: Tool = {
  id         : "official-audio-meta-artwork-editor",
  uid        : "uid-official-audio-meta-artwork-editor",
  name       : "Audio Metadata & Artwork Editor",
  namespace  : "🎵 Audio Tools",
  category   : "🏷️ Audio Metadata",
  isOfficial : true,
  description: "Inspect audio files to extract metadata tags and embedded artwork (front, back, disc, artist, icon) using ffprobe. Supports single or multi-file uploads and outputs tags in KEY: VALUE format for quick comparison.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
