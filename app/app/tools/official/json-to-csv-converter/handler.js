/**
 * Convert JSON to CSV with selectable layouts and formats.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const jsonText = inputWidgets["json_input"] || "";
  const csvLayout = inputWidgets["csv_layout"] || "row";
  const csvHasHeader = inputWidgets["csv_has_header"] !== false;
  const csvDelimiter = normalizeDelimiter(inputWidgets["csv_delimiter"]);
  const jsonFormat = inputWidgets["json_format"] || "auto";
  const jsonPath = inputWidgets["json_path"] || "";
  void changedWidgetIds;
  if (!jsonText.trim()) return { csv_output: "", csv_download: "" };
  let data = JSON.parse(jsonText);
  if (jsonPath.trim()) {
    const { JSONPath } = await requirePackage("jsonpath-plus");
    const extracted = JSONPath({ path: jsonPath, json: data });
    data = extracted.length === 1 ? extracted[0] : extracted;
  }
  const model = parseJsonToModel(data, jsonFormat);
  const csvOutput = buildCsvOutput(model.headers, model.items, csvLayout, csvHasHeader, csvDelimiter);
  return { csv_output: csvOutput, csv_download: buildCsvDownloadLink(csvOutput) };
}

function parseJsonToModel(data, format) {
  const resolvedFormat = format === "auto" ? detectJsonFormat(data) : format;
  if (resolvedFormat === "object_columns") return modelFromObjectColumns(data);
  if (resolvedFormat === "array_arrays") return modelFromArrayArrays(data);
  return modelFromArrayObjects(data);
}

function detectJsonFormat(data) {
  if (Array.isArray(data)) {
    if (data.length === 0) return "array_objects";
    if (data.every(Array.isArray)) return "array_arrays";
    if (data.every(isPlainObject)) return "array_objects";
    return "array_arrays";
  }
  if (isPlainObject(data)) {
    const values = Object.values(data);
    if (values.length && values.every(Array.isArray)) return "object_columns";
    return "array_objects";
  }
  return "array_arrays";
}

function modelFromArrayObjects(data) {
  const items = Array.isArray(data) ? data : [data];
  const normalized = items.map((item) => (isPlainObject(item) ? item : { index_1: item }));
  const headers = collectHeaders(normalized);
  const values = normalized.map((item) => headers.map((header) => item[header] ?? ""));
  return { headers, items: values };
}

function modelFromArrayArrays(data) {
  const items = Array.isArray(data) ? data : [data];
  const rows = items.map((item) => (Array.isArray(item) ? item : [item]));
  const maxLen = getMaxRowLength(rows);
  const headers = buildIndexHeaders(maxLen);
  const values = rows.map((row) => normalizeRow(row, maxLen));
  return { headers, items: values };
}

function modelFromObjectColumns(data) {
  const obj = isPlainObject(data) ? data : {};
  const headers = Object.keys(obj);
  const columns = headers.map((key) => (Array.isArray(obj[key]) ? obj[key] : [obj[key]]));
  const maxLen = getMaxRowLength(columns);
  const items = [];
  for (let index = 0; index < maxLen; index += 1) {
    const row = headers.map((_, colIndex) => columns[colIndex][index] ?? "");
    items.push(row);
  }
  return { headers, items };
}

function buildCsvOutput(headers, items, layout, hasHeader, delimiter) {
  const normalizedHeaders = headers.length ? headers : buildIndexHeaders(getMaxRowLength(items));
  if (layout === "column") return buildColumnCsv(normalizedHeaders, items, hasHeader, delimiter);
  return buildRowCsv(normalizedHeaders, items, hasHeader, delimiter);
}

function buildRowCsv(headers, items, hasHeader, delimiter) {
  const maxLen = Math.max(headers.length, getMaxRowLength(items));
  const normalizedHeaders = normalizeHeaders(headers, maxLen);
  const rows = [];
  if (hasHeader) rows.push(normalizedHeaders);
  for (const item of items) {
    rows.push(normalizeRow(item, maxLen));
  }
  return renderCsv(rows, delimiter);
}

function buildColumnCsv(headers, items, hasHeader, delimiter) {
  const rowCount = Math.max(headers.length, getMaxRowLength(items));
  const normalizedHeaders = normalizeHeaders(headers, rowCount);
  const rows = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = [];
    if (hasHeader) row.push(normalizedHeaders[rowIndex]);
    for (const item of items) {
      row.push(item[rowIndex] ?? "");
    }
    rows.push(row);
  }
  return renderCsv(rows, delimiter);
}

function renderCsv(rows, delimiter) {
  return rows.map((row) => row.map((cell) => formatCsvCell(cell, delimiter)).join(delimiter)).join("\n");
}

function formatCsvCell(value, delimiter) {
  const raw = value === null || value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
  if (!raw) return "";
  if (new RegExp(`["\\n\\r${escapeRegExp(delimiter)}]`).test(raw)) return `"${raw.replace(/"/g, "\"\"")}"`;
  return raw;
}

function buildCsvDownloadLink(csvText) {
  if (!csvText || !String(csvText).trim()) return "";
  const filename = "converted.csv";
  const encoded = encodeURIComponent(csvText);
  const dataUrl = `data:text/csv;charset=utf-8,${encoded}`;
  return `<div class="text-sm leading-relaxed"><a href="${dataUrl}" download="${filename}" class="font-medium text-primary underline underline-offset-2">Download CSV</a></div>`;
}

function normalizeDelimiter(value) {
  if (typeof value === "string") {
    if (!value) return ",";
    if (value.toLowerCase() === "tab") return "\t";
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return ",";
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHeaders(headers, count) {
  const values = [];
  const fallback = buildIndexHeaders(count);
  for (let index = 0; index < count; index += 1) {
    const value = headers[index];
    values.push(value && String(value).trim() ? String(value) : fallback[index]);
  }
  return values;
}

function normalizeRow(row, count) {
  const values = [];
  for (let index = 0; index < count; index += 1) values.push(row[index] ?? "");
  return values;
}

function buildIndexHeaders(count) {
  const headers = [];
  for (let index = 0; index < count; index += 1) headers.push(`index_${index + 1}`);
  return headers;
}

function getMaxRowLength(rows) {
  let max = 0;
  for (const row of rows) max = Math.max(max, row.length || 0);
  return max;
}

function collectHeaders(items) {
  const headers = [];
  const seen = new Set();
  for (const item of items) {
    for (const key of Object.keys(item || {})) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  return headers.length ? headers : ["index_1"];
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}
