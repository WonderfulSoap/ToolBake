import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolFileBinaryEncoderDecoder: Tool = {
  id         : "official-file-binary-encoder-decoder",
  uid        : "uid-official-file-binary-encoder-decoder",
  name       : "File ↔ Binary Encoder/Decoder",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Convert files to binary, octal, decimal, and hexadecimal formats instantly with this powerful bidirectional file converter. Upload any file up to 20MB and instantly see its binary representation (base 2), octal (base 8), decimal (base 10), and hexadecimal (base 16) representations. Perfect for developers, programmers, and students who need to analyze file structure, debug binary data, or learn about file encoding. This free online file converter supports seamless conversion between all base formats - convert files to binary, then back to original format with one click. Features real-time conversion, input validation for each base system, and easy file download with Data URL support. No file upload to server, no registration required - process files directly in your browser.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
