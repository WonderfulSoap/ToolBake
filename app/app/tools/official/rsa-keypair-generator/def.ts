import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolRsaKeypairGenerator: Tool = {
  id         : "official-rsa-keypair-generator",
  uid        : "uid-official-rsa-keypair-generator",
  name       : "RSA Key Pair Generator",
  namespace  : "OFFICIAL",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Generate RSA public and private key pairs locally in your browser with configurable key sizes. Produce PEM-formatted keys instantly and download them for secure development and testing workflows.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
