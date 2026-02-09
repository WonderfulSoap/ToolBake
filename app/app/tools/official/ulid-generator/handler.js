

let ulid;

/**
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widgetId"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * - Checks the 'uiWidgets' tab to check and modify the input/output UI widgets of this tool
 * - The 'handler.d.ts' tab shows the full auto generated type definitions for the handler function
 * 
 * !! The jsdoc comment below describes the handler function signature, and provides type information for the editor. Don't remove it.
 *
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const multi_num = inputWidgets.multi_num;
  const batch_format = inputWidgets.batch_format;
  const time_seed = inputWidgets.seed ? inputWidgets.seed : Date.now();

  ulid = await requirePackage("ulid");
  
  const ulids = [];
  for (let i = 0; i < multi_num; i++) {
    ulids.push(ulid.ulid());
  }

  let batch_result;
  switch (batch_format){
    case "lines":
      batch_result = ulids.join("\n");
      break;
    case "csv":
      batch_result = "num,ulid\n";
      for (const [idx, u] of ulids.entries()){
        batch_result += `${idx+1},${u}\n`;
      }
      break;
    case "json":
      batch_result = JSON.stringify(ulids, null, 2);
      break;
    default:
      throw new Error(`Unknow batch format: '${batch_format}'`);
  }

  return {
    "multi-result": batch_result,
    seed          : time_seed,
  };
}


function generateulid(version){
  let resultulid = "";
  switch (version) {
    case "v1":
      resultulid = ulid.v1();
      break;
    case "v4":
      resultulid = ulid.v4();
      break;
      // case 'v5':
      //   resultulid = ulid.v5(name, namespace);
      //   break;
    case "v6":
      resultulid = ulid.v6();
      break;
    case "v7":
      resultulid = ulid.v7();
      break;
    default:
      throw Error(`Unsupported ulid version '${version}'`);
  }
  return resultulid;
}