import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolTextBinaryEncoderDecoder: Tool = {
  id         : "official-text-binary-encoder-decoder",
  uid        : "uid-official-text-binary-encoder-decoder",
  name       : "Text ↔ Binary Encoder/Decoder",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Convert text to binary, octal, decimal, and hexadecimal formats instantly with this powerful online base converter. This bidirectional converter allows developers, programmers, and students to easily translate characters to binary representation or convert between different number bases (base 2, 8, 10, 16). Simply enter text or paste binary, decimal, or hexadecimal codes to see real-time conversions. Supports full ASCII character encoding (0-255) with built-in input validation for each number system. Perfect for character encoding, programming tasks, and learning number systems. Free online tool with no registration or download required.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
