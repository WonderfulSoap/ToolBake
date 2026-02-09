
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

let uuid;
async function handler(inputWidgets, changedWidgetIds) {
  const version = inputWidgets.uuid_version;
  const multi_num = inputWidgets.multi_num;
  const batch_format = inputWidgets.batch_format;
  const upper_case = inputWidgets.upper_case;
  const with_hyphen = inputWidgets.with_hyphen;

  uuid = await requirePackage("uuid");
  
  const uuids = [];
  for (let i = 0; i < multi_num; i++) {
    let uid = generateUUID(version);
    uid = upper_case ? uid.toUpperCase() : uid.toLowerCase();
    uid = !with_hyphen ? uid.replace(/-/g, "") : uid;
    uuids.push(uid);
  }

  let batch_result;
  switch (batch_format){
    case "lines":
      batch_result = uuids.join("\n");
      break;
    case "csv":
      batch_result = "num,uuid\n";
      for (const [idx, u] of uuids.entries()){
        batch_result += `${idx+1},${u}\n`;
      }
      break;
    case "json":
      batch_result = JSON.stringify(uuids, null, 2);
      break;
    default:
      throw new Error(`Unknow batch format: '${batch_format}'`);
  }

  return {
    "multi-result": batch_result
  };
}


function generateUUID(version){
  let resultUUID = "";
  switch (version) {
    case "v1":
      resultUUID = uuid.v1();
      break;
    case "v4":
      resultUUID = uuid.v4();
      break;
      // case 'v5':
      //   resultUUID = uuid.v5(name, namespace);
      //   break;
    case "v6":
      resultUUID = uuid.v6();
      break;
    case "v7":
      resultUUID = uuid.v7();
      break;
    default:
      throw Error(`Unsupported uuid version '${version}'`);
  }
  return resultUUID;
}