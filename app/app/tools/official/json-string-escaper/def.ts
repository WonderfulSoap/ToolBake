import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolJsonStringEscaper: Tool = {
  id         : "official-json-string-escaper",
  uid        : "uid-official-json-string-escaper",
  name       : "JSON String Escaper",
  namespace  : "🛠️ Devt Tools",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Convert any text into a properly escaped JSON string value. Display the escaped JSON in the format { \"data\": escaped_value } for easy integration into JSON structures.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
