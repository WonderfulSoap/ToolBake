import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolJpegTargetSizeCompressor: Tool = {
  id         : "official-jpeg-target-size-compressor",
  uid        : "uid-official-jpeg-target-size-compressor",
  name       : "Compress JPEG To Target Size",
  namespace  : "🖼️ Image Tools",
  category   : "🗜️ Compressor",
  isOfficial : true,
  description: "Compress multiple JPEG images to a target file size in the browser with ImageMagick, adjusting quality, metadata stripping, 4:2:0 sampling, and interlaced output.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
