import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolColorPickerConverter: Tool = {
  id         : "official-color-picker-converter",
  uid        : "uid-official-color-picker-converter",
  name       : "Color Picker Converter",
  namespace  : "🛠️ Devt Tools",
  category   : "🎨 Color",
  isOfficial : true,
  description: "Ultimate web-based Color Converter powered by Color.js, designed for developers and designers to seamlessly parse and transform colors between modern CSS formats. Effortlessly convert between HEX, RGB, HSL, OKLCH, Lab, and Display P3 with support for alpha channels and wide-gamut color spaces, ensuring precision and compatibility for high-end digital design and front-end development.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
