import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolPrivateKeyToPublicKey: Tool = {
  id         : "official-private-key-to-public-key",
  uid        : "uid-official-private-key-to-public-key",
  name       : "Private Key to Public Key",
  namespace  : "OFFICIAL",
  category   : "🧬 Encoder/Decoder",
  isOfficial : true,
  description: "Generate an RSA public key from a PEM private key directly in the browser. Upload a .pem/.key file, extract the public key, and download the PEM output instantly. Ideal for developers needing quick key derivation without server-side tooling.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
