/**
 * Convert CSV to JSON with selectable layouts and formats.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const { parse } = await requirePackage("csv-parse");
  const csvText = inputWidgets["csv_input"] || "";
  const csvLayout = inputWidgets["csv_layout"] || "row";
  const csvHasHeader = inputWidgets["csv_has_header"] !== false;
  const csvDelimiter = normalizeDelimiter(inputWidgets["csv_delimiter"]);
  const jsonFormat = inputWidgets["json_format"] || "auto";
  const jsonPath = inputWidgets["json_path"] || "";
  void changedWidgetIds;
  if (!csvText.trim()) return { json_output: "", json_download: "" };
  const rows = await parseCsv(parse, csvText, csvDelimiter);
  const model = csvToModel(rows, csvLayout, csvHasHeader);
  const jsonOutputFormat = jsonFormat === "auto" ? "array_objects" : jsonFormat;
  let jsonValue = buildJsonOutput(model.headers, model.items, jsonOutputFormat);
  if (jsonPath.trim()) {
    const { JSONPath } = await requirePackage("jsonpath-plus");
    const extracted = JSONPath({ path: jsonPath, json: jsonValue });
    jsonValue = extracted.length === 1 ? extracted[0] : extracted;
  }
  const jsonText = JSON.stringify(jsonValue, null, 2);
  return { json_output: jsonText, json_download: buildJsonDownloadLink(jsonText) };
}

function parseCsv(parse, text, delimiter) {
  return new Promise((resolve, reject) => {
    parse(text, { relax_column_count: true, skip_empty_lines: true, delimiter }, (error, records) => {
      if (error) reject(error);
      else resolve(Array.isArray(records) ? records : []);
    });
  });
}

function csvToModel(rows, layout, hasHeader) {
  if (!rows.length) return { headers: [], items: [] };
  if (layout === "column") return csvColumnsToModel(rows, hasHeader);
  return csvRowsToModel(rows, hasHeader);
}

function csvRowsToModel(rows, hasHeader) {
  const maxLen = getMaxRowLength(rows);
  const headers = normalizeHeaders(hasHeader ? rows[0] : [], maxLen);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const items = dataRows.map((row) => normalizeRow(row, maxLen));
  return { headers, items };
}

function csvColumnsToModel(rows, hasHeader) {
  const maxColumns = getMaxRowLength(rows);
  const dataStart = hasHeader ? 1 : 0;
  const headerColumn = hasHeader ? rows.map((row) => row[0]) : buildIndexHeaders(rows.length);
  const headers = normalizeHeaders(headerColumn, headerColumn.length);
  const items = [];
  for (let col = dataStart; col < maxColumns; col += 1) {
    const item = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      item.push(rows[rowIndex][col] ?? "");
    }
    items.push(item);
  }
  return { headers, items };
}

function buildJsonOutput(headers, items, format) {
  if (format === "array_arrays") return items;
  if (format === "object_columns") return buildObjectColumns(headers, items);
  return buildArrayObjects(headers, items);
}

function buildArrayObjects(headers, items) {
  return items.map((item) => {
    const entry = {};
    for (let index = 0; index < headers.length; index += 1) {
      entry[headers[index]] = item[index] ?? "";
    }
    return entry;
  });
}

function buildObjectColumns(headers, items) {
  const result = {};
  for (let index = 0; index < headers.length; index += 1) {
    result[headers[index]] = items.map((item) => item[index] ?? "");
  }
  return result;
}

function buildJsonDownloadLink(jsonText) {
  if (!jsonText || !String(jsonText).trim()) return "";
  const filename = "converted.json";
  const encoded = encodeURIComponent(jsonText);
  const dataUrl = `data:application/json;charset=utf-8,${encoded}`;
  return `<div class="text-sm leading-relaxed"><a href="${dataUrl}" download="${filename}" class="font-medium text-primary underline underline-offset-2">Download JSON</a></div>`;
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
