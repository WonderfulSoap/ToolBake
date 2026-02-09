import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolDeviceScreenInfo: Tool = {
  id         : "official-device-screen-info",
  uid        : "uid-official-device-screen-info",
  name       : "Device Screen Info",
  namespace  : "🛠️ Devt Tools",
  category   : "⚙️ Device",
  isOfficial : true,
  description: "Instantly view detailed information about your device's screen resolution, viewport size, pixel density (DPR), color depth, and aspect ratio. Useful for developers and designers to check responsive layouts.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
