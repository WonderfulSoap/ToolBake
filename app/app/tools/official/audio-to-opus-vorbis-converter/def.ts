import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolAudioToOpusVorbisConverter: Tool = {
  id         : "official-audio-to-opus-vorbis-converter",
  uid        : "uid-official-audio-to-opus-vorbis-converter",
  name       : "Audio to Opus/Vorbis Converter",
  namespace  : "OFFICIAL",
  category   : "↔️ Format Converter",
  isOfficial : true,
  description: "Convert multiple audio files to Opus or Vorbis in the browser with ffmpeg.wasm. Tune Opus bitrate, VBR mode, and application, or use Vorbis quality, then download and preview the results.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
