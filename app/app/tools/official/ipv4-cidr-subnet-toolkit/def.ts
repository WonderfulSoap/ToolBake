import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolIpv4SubnetCidrCalculator: Tool = {
  id         : "official-ipv4-subnet-cidr-calculator",
  uid        : "uid-official-ipv4-subnet-cidr-calculator",
  name       : "IPv4 CIDR Subnet Toolkit",
  namespace  : "🛠️ Devt Tools",
  category   : "🌐 Network Tools",
  isOfficial : true,
  description: "Analyze IPv4 CIDR or IP + netmask pairs, return subnet range, wildcard, class, binary view, and check if a test IP falls inside.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
