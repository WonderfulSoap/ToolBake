import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolTimeCalculator: Tool = {
  id         : "official-time-calculator",
  uid        : "uid-official-time-calculator",
  name       : "Time Calculator",
  namespace  : "🏠 Life",
  category   : "⏱️ Time",
  isOfficial : true,
  description: "Advanced time calculator for precise date and time arithmetic. Add or subtract time intervals (milliseconds, seconds, minutes, hours, days, weeks, months, years) from any date. Supports ISO 8601 format input, automatic current time detection, and dual output formats (readable and ISO 8601). Perfect for scheduling, deadline calculation, event planning, time zone conversions, and project timeline management. Handles complex time calculations with support for negative offsets and multiple time units in a single operation. Ideal for developers, project managers, students, and professionals needing accurate time computations without external dependencies.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
