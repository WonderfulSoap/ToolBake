import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolEd25519KeypairGenerator: Tool = {
  id         : "official-ed25519-keypair-generator",
  uid        : "uid-official-ed25519-keypair-generator",
  name       : "ED25519 Key Pair Generator",
  namespace  : "OFFICIAL",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Generate ED25519 public and private key pairs locally in your browser. Export PKCS#8 PEM private keys and PEM/OpenSSH public keys instantly with optional password protection and download links.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
