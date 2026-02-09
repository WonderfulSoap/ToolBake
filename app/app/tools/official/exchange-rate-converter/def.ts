import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolExchangeRateConverter: Tool = {
  id        : "official-exchange-rate-converter",
  uid       : "uid-official-exchange-rate-converter",
  name      : "Exchange Rate Converter",
  namespace : "🏠 Life",
  category  : "🏦 Finance",
  isOfficial: true,
  description:
    "Convert between common currencies by typing in any field. Rates are fetched once on demand and reused locally for fast multi-currency updates.",
  extraInfo: {},
  uiWidgets: uiWidgets as Tool["uiWidgets"],
  source   : handlerSource,
};
