import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolDateTimeTimestampConverter: Tool = {
  id         : "official-datetime-timestamp-converter",
  uid        : "uid-official-datetime-timestamp-converter",
  name       : "Datetime Timestamp Converter",
  namespace  : "🛠️ Devt Tools",
  category   : "⏱️ Time",
  isOfficial : true,
  description: "A versatile online tool to effortlessly parse, format, and convert dates and times. Simply input a date string, a Unix timestamp, or leave it blank to use the current time.",
  extraInfo  : {
    execInterval: "1000",
  },
  uiWidgets: uiWidgets as Tool["uiWidgets"],
  source   : handlerSource,
};
