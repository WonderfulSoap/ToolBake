
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


  const dayjs = await requirePackage("dayjs");
  var duration = await requirePackage("dayjs/plugin/duration");
  dayjs.extend(duration);

  const in_time = inputWidgets.in_time?.trim();
  const in_delta = inputWidgets.in_delta?.trim();
  const result = {in_time: in_time, in_delta: in_delta};

  console.log(`in_time: ${in_time}, in_delta: ${in_delta}`);


  let time;
  if (in_time) {
    // Detect pure time format (HH:mm or HH:mm:ss) and prepend current date
    const timeOnlyRegex = /^\d{1,2}:\d{2}(:\d{2})?$/;
    if (timeOnlyRegex.test(in_time)) {
      const today = dayjs().format("YYYY-MM-DD");
      time = dayjs(`${today} ${in_time}`);
    } else {
      time = dayjs(in_time);
    }
    result.in_time = in_time;
    if (!time.isValid()) return { ...result, out_time: "Invalid input time" };
  } else {
    time = dayjs();
    result.in_time = time.format("YYYY-MM-DD HH:mm:ss");
  }

  if (!in_delta) return {...result, out_time: ""};

  const parsed_result = parseDurationString(in_delta);
  console.log(`parsed delta: ${JSON.stringify(parsed_result)}`);
  const result_time = dayjsAdd(time, parsed_result);

  result.out_time = result_time.format("YYYY-MM-DD HH:mm:ss");
  result.out_time2 = result_time.format("YYYY-MM-DDTHH:mm:ssZ");
  return result;

}



/**
 * Maps dayjs diff shorthands to full keys required by the duration object.
 * Note: 'm' means minutes and 'M' means months; this is case-sensitive.
 */
const SHORTHAND_TO_DURATION_KEY = {
  ms: "millisecond",
  s : "second",
  m : "minute",
  h : "hour",
  d : "day",
  w : "week",
  M : "month",
  y : "year"
};


function dayjsAdd(time, duration){
  for (const [key, value] of Object.entries(duration)){
    
    console.log(`call: time = time.add(${value}, ${key});`);
    time = time.add(value, key);
  }
  return time;
}

function parseDurationString(durationStr) {
  if (typeof durationStr !== "string" || !durationStr.trim()) {
    return {};
  }

  const durationObject = {};
  let strToParse = durationStr.trim();
  let multiplier = 1;

  // 1. Detect and handle a leading sign.
  if (strToParse.startsWith("-")) {
    multiplier = -1;
    strToParse = strToParse.slice(1); // Remove the leading '-' to simplify regex parsing.
  } else if (strToParse.startsWith("+")) {
    strToParse = strToParse.slice(1); // Remove the leading '+'.
  }

  const regex = /(\d+)([a-zA-Z]+)/g;
  let match;

  while ((match = regex.exec(strToParse)) !== null) {
    const rawValue = parseInt(match[1], 10);
    // 2. Apply the sign multiplier.
    const value = rawValue * multiplier; 
    
    const shorthand = match[2];
    const durationKey = SHORTHAND_TO_DURATION_KEY[shorthand];

    if (durationKey) {
      durationObject[durationKey] = (durationObject[durationKey] || 0) + value;
    } else {
      return undefined;
    }
  }

  return durationObject;
}
