/**
 * Prettify SQL using sql-formatter.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const rawSql = inputWidgets["sql-input"] || "";
  if (!rawSql.trim()) return { "sql-output": "" };
  const { format } = await requirePackage("sql-formatter");
  const output = format(rawSql);
  return { "sql-output": output };
}
