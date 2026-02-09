import type { Tool } from "~/entity/tool";
import handlerSource from "./handler.js?raw";
import uiWidgets from "./uiWidgets.json";

export const OfficialToolBlockrainTetris: Tool = {
  id         : "official-blockrain-tetris",
  uid        : "uid-official-blockrain-tetris",
  name       : "Tetris",
  namespace  : "🎮 Game",
  category   : "👾 Simple Games",
  isOfficial : true,
  description: "Play Blockrain Tetris in the browser with theme, difficulty, and autoplay controls powered by Blockrain.js.",
  extraInfo  : {},
  uiWidgets  : uiWidgets as Tool["uiWidgets"],
  source     : handlerSource,
};
