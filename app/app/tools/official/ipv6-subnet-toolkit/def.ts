import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolIpv6SubnetToolkit: Tool = {
  id         : "official-ipv6-subnet-toolkit",
  uid        : "uid-official-ipv6-subnet-toolkit",
  name       : "IPv6 CIDR Subnet Toolkit",
  namespace  : "🛠️ Devt Tools",
  category   : "🌐 Network Tools",
  isOfficial : true,
  description: "Analyze IPv6 CIDR blocks or IP + prefix pairs, return subnet range, size, type, scope, binary view, and check if a test IP falls inside.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
