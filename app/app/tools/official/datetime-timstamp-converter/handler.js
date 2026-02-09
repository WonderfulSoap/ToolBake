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
 * @param {HandlerCallback} callback Callback method to update ui inside handler. Useful for a long time task.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  const dayjs = await requirePackage("dayjs");
  const relativeTime = await requirePackage("dayjs/plugin/relativeTime");
  dayjs.extend(relativeTime);

  let { in_string, in_timestamp_ms, in_timestamp_s, in_custom_format } = inputWidgets;
  in_string = (in_string || "").trim();
  in_timestamp_ms = (in_timestamp_ms || "").trim();
  in_timestamp_s = (in_timestamp_s || "").trim();

  // Mutually exclusive: use callback to immediately clear other input fields
  if (changedWidgetIds === "in_string" && in_string) {
    callback({ in_timestamp_s: "", in_timestamp_ms: "" });
    in_timestamp_s = "";
    in_timestamp_ms = "";
  } else if (changedWidgetIds === "in_timestamp_s" && in_timestamp_s) {
    callback({ in_string: "", in_timestamp_ms: "" });
    in_string = "";
    in_timestamp_ms = "";
  } else if (changedWidgetIds === "in_timestamp_ms" && in_timestamp_ms) {
    callback({ in_string: "", in_timestamp_s: "" });
    in_string = "";
    in_timestamp_s = "";
  }

  // Determine time based on which input has value: string > ms > s > now
  let t;
  if (in_string) {
    t = dayjs(in_string);
    console.log("Parsing date string:", in_string);
  } else if (in_timestamp_ms) {
    const ms = Number(in_timestamp_ms);
    t = dayjs(ms);
    console.log("Parsing timestamp ms:", in_timestamp_ms, "->", ms);
  } else if (in_timestamp_s) {
    const s = Number(in_timestamp_s);
    t = dayjs.unix(s);
    console.log("Parsing timestamp s:", in_timestamp_s, "->", s);
  } else {
    t = dayjs();
    console.log("Using current time");
  }

  return {
    out_timestamp    : t.unix(),
    out_timestamp_ms : t.valueOf(),
    out_date         : t.format("YYYY-MM-DD"),
    out_time         : t.format("HH:mm:ss"),
    out_datetime     : t.format("YYYY-MM-DD HH:mm:ss"),
    out_iso8601_tz   : t.format("YYYY-MM-DDTHH:mm:ssZ"),
    out_iso8601      : t.toISOString(),
    out_js_date      : t.toDate(),
    out_custom_format: t.format(in_custom_format),
    out_from_now     : t.fromNow(),
  };
}

