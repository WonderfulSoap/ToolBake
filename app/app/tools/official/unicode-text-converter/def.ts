import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolUnicodeTextEncoderDecoder: Tool = {
  id         : "official-unicode-text-encoder-decoder",
  uid        : "uid-official-unicode-text-encoder-decoder",
  name       : "Unicode Text Encoder/Decoder",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Convert plain text into Unicode code points, HTML numeric character references (decimal/hex), and Unicode escape sequences, or decode any of these formats back to readable text. Supports U+XXXX notation, &#DDDD;/&#xHHHH; references, and both \\u{...} and \\uXXXX escape styles for developers working with encoding and Unicode data.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
