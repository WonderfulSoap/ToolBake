/**
 * Convert between JSON, XML, and YAML with shared data model.
 *
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const { XMLParser, XMLBuilder } = await requirePackage("fast-xml-parser");
  const yaml = await requirePackage("js-yaml");
  const yamlText = inputWidgets["yaml-input"] || "";
  const toml = await requirePackage("toml");
  const jsonText = inputWidgets["json-input"] || "";
  const tomlText = inputWidgets["toml-input"] || "";
  const xmlText = inputWidgets["xml-input"] || "";
  const activeId = changedWidgetIds || pickFirstNonEmpty(jsonText, yamlText, tomlText, xmlText);
  if (!activeId) return {};
  const activeText = getTextById(activeId, jsonText, yamlText, tomlText, xmlText);
  if (!activeText.trim()) return buildEmptyOutputs(activeId);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@_", format: true, suppressEmptyNode: true });
  const data = parseByActiveId(activeId, activeText, parser, yaml, toml);
  if (data === undefined) return buildEmptyOutputs(activeId);
  return buildOutputs(activeId, data, builder, yaml, toml);
}

function pickFirstNonEmpty(jsonText, yamlText, tomlText, xmlText) {
  if (jsonText.trim()) return "json-input";
  if (yamlText.trim()) return "yaml-input";
  if (tomlText.trim()) return "toml-input";
  if (xmlText.trim()) return "xml-input";
  return "";
}

function getTextById(activeId, jsonText, yamlText, tomlText, xmlText) {
  if (activeId === "json-input") return jsonText;
  if (activeId === "yaml-input") return yamlText;
  if (activeId === "toml-input") return tomlText;
  return xmlText;
}

function buildEmptyOutputs(activeId) {
  const result = {};
  if (activeId !== "json-input") result["json-input"] = "";
  if (activeId !== "yaml-input") result["yaml-input"] = "";
  if (activeId !== "toml-input") result["toml-input"] = "";
  if (activeId !== "xml-input") result["xml-input"] = "";
  return result;
}

function parseByActiveId(activeId, text, xmlParser, yaml, toml) {
  if (activeId === "json-input") return parseJson(text);
  if (activeId === "yaml-input") return parseYaml(text, yaml);
  if (activeId === "toml-input") return parseToml(text, toml);
  if (activeId === "xml-input") return parseXml(text, xmlParser);
  return parseYaml(text, yaml);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Invalid JSON input.");
  }
}

function parseXml(text, parser) {
  try {
    return parser.parse(text);
  } catch (error) {
    throw new Error("Invalid XML input.");
  }
}

function parseYaml(text, yaml) {
  try {
    return yaml.load(text);
  } catch (error) {
    throw new Error("Invalid YAML input.");
  }
}

function parseToml(text, toml) {
  try {
    return toml.parse(text);
  } catch (error) {
    throw new Error("Invalid TOML input.");
  }
}

function buildOutputs(activeId, data, builder, yaml, toml) {
  const result = {};
  if (activeId !== "json-input") result["json-input"] = JSON.stringify(data, null, 2);
  if (activeId !== "yaml-input") result["yaml-input"] = yaml.dump(data, { lineWidth: -1, noRefs: true });
  if (activeId !== "toml-input") result["toml-input"] = stringifyToml(normalizeTomlRoot(data));
  if (activeId !== "xml-input") result["xml-input"] = builder.build(normalizeXmlRoot(data));
  return result;
}

function normalizeXmlRoot(data) {
  if (data === null || data === undefined) return { root: "" };
  if (Array.isArray(data)) return { root: data };
  if (typeof data !== "object") return { root: data };
  const keys = Object.keys(data);
  if (keys.length === 1) return data;
  return { root: data };
}

function normalizeTomlRoot(data) {
  if (data === null || data === undefined) return { value: "" };
  if (Array.isArray(data)) return { value: data };
  if (typeof data !== "object") return { value: data };
  return data;
}

function stringifyToml(data) {
  const lines = [];
  renderTomlTable(data, [], lines);
  return lines.join("\n").trim();
}

function renderTomlTable(obj, path, lines) {
  const entries = Object.entries(obj || {});
  const plainPairs = [];
  const tablePairs = [];
  const arrayTablePairs = [];
  for (const [key, value] of entries) {
    if (isArrayTable(value)) arrayTablePairs.push([key, value]);
    else if (isPlainObject(value)) tablePairs.push([key, value]);
    else plainPairs.push([key, value]);
  }
  for (const [key, value] of plainPairs) {
    lines.push(`${formatTomlKey(key)} = ${formatTomlValue(value)}`);
  }
  for (const [key, value] of tablePairs) {
    const nextPath = path.concat(key);
    lines.push("");
    lines.push(`[${formatTomlPath(nextPath)}]`);
    renderTomlTable(value, nextPath, lines);
  }
  for (const [key, value] of arrayTablePairs) {
    const nextPath = path.concat(key);
    for (const item of value) {
      lines.push("");
      lines.push(`[[${formatTomlPath(nextPath)}]]`);
      renderTomlTable(item, nextPath, lines);
    }
  }
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

function isPrimitive(value) {
  return value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date;
}

function isArrayTable(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isPlainObject);
}

function formatTomlKey(key) {
  return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
}

function formatTomlPath(parts) {
  return parts.map(formatTomlKey).join(".");
}

function formatTomlValue(value) {
  if (value === null || value === undefined) return "\"\"";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "\"\"";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return formatTomlArray(value);
  if (isPlainObject(value)) return "{}";
  return "\"\"";
}

function formatTomlArray(value) {
  if (value.length === 0) return "[]";
  if (value.every(isPlainObject)) return "[]";
  const items = value.map((item) => formatTomlValue(item));
  return `[${items.join(", ")}]`;
}
