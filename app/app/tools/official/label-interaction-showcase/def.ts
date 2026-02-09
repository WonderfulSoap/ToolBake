import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

// Official demo tool showcasing dynamic LabelInput rendering.
export const OfficialToolLabelInteractionShowcase: Tool = {
  id         : "official-label-interaction-showcase",
  uid        : "uid-official-label-interaction-showcase",
  name       : "Label Interaction Showcase",
  namespace  : "🐭 Demo/Showcase",
  category   : "🐕 LabelInput",
  isOfficial : true,
  description: "Showcase dynamic LabelInput rendering with rich HTML layouts, interactive tag chips, dialog-style overlays, and real-time status updates driven by tool inputs.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
