/**
 * Some tips:
 * - Hover mouse on 'InputUIWidgets' and 'ChangedUIWidget' in the jsdoc to see the generated types
 * - Use 'inputWidgets["widgetId"]' or 'inputWidgets.widgetId' to access the value of a specific input widget value
 * - Use 'changedWidgetIds' to know which input widget triggered the execution
 * - Checks the 'uiWidgets' tab to check and modify the input/output UI widgets of this tool
 *
 * !! The jsdoc comment below describes the handler function signature, and provides type information for the editor. Don't remove it.
 *
 * @param {InputUIWidgets} inputWidgets When tool is executed, this object contains all the input widget values.
 * @param {ChangedUIWidget} changedWidgetIds When tool is executed, this string value tells you which input widget triggered the execution.
 * @param {HandlerCallback} callback Callback method to update ui inside handler. Useful for a long time task.
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds, callback) {
  console.log("exchange-rate trigger:", changedWidgetIds);

  const Decimal = await requirePackage("decimal.js");
  const providerId = resolveProviderId(inputWidgets.rate_provider);
  const cacheText = normalizeCacheText(inputWidgets.rate_cache);
  let rateEntity = cacheText ? parseRateCache(cacheText) : null;

  if (shouldRefreshRates(changedWidgetIds, rateEntity, providerId)) {
    rateEntity = await fetchRatesForProvider(providerId);
  }

  if (!rateEntity) {
    return { status_note: buildStatusNote(null, null, "Rates not loaded yet."), rate_cache: "" };
  }

  const currencyWidgets = getCurrencyWidgets();
  const source = resolveSourceValue(currencyWidgets, inputWidgets, changedWidgetIds, Decimal);
  const updates = { rate_cache: JSON.stringify(rateEntity, null, 2), status_note: "" };

  if (!source) {
    updates.status_note = buildStatusNote(rateEntity, null, "Enter a value in any currency field.");
    return updates;
  }

  const sourceRate = resolveRate(rateEntity.rates, source.code);
  if (!sourceRate) {
    updates.status_note = buildStatusNote(rateEntity, source.code, `Missing rate for ${source.code}.`);
    return updates;
  }

  const baseAmount = source.value.div(new Decimal(sourceRate));
  for (const widget of currencyWidgets) {
    if (widget.id === source.id) continue;
    const targetRate = resolveRate(rateEntity.rates, widget.code);
    if (!targetRate) continue;
    const converted = baseAmount.mul(targetRate);
    updates[widget.id] = formatDecimal(converted, 6);
  }

  updates.status_note = buildStatusNote(rateEntity, source.code, "Using cached rates.");
  return updates;
}

// Map currency widgets so we can resolve the edited input quickly.
function getCurrencyWidgets() {
  // Keep this list aligned with uiWidgets.json rows for predictable updates.
  return [
    { id: "currency_usd", code: "USD" },
    { id: "currency_eur", code: "EUR" },
    { id: "currency_cny", code: "CNY" },
    { id: "currency_jpy", code: "JPY" },
    { id: "currency_gbp", code: "GBP" },
    { id: "currency_aud", code: "AUD" },
    { id: "currency_cad", code: "CAD" },
    { id: "currency_chf", code: "CHF" },
    { id: "currency_hkd", code: "HKD" },
    { id: "currency_sgd", code: "SGD" },
    { id: "currency_krw", code: "KRW" },
    { id: "currency_inr", code: "INR" },
    { id: "currency_nzd", code: "NZD" },
    { id: "currency_sek", code: "SEK" },
    { id: "currency_nok", code: "NOK" },
    { id: "currency_dkk", code: "DKK" },
    { id: "currency_brl", code: "BRL" },
    { id: "currency_mxn", code: "MXN" },
    { id: "currency_zar", code: "ZAR" },
    { id: "currency_aed", code: "AED" },
  ];
}

// Normalize provider selection and fallback to the default provider.
function resolveProviderId(value) {
  const text = value ? String(value).trim() : "";
  return text || "open-er-api";
}

// Normalize cache text so empty values are treated as missing.
function normalizeCacheText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

// Decide when to refresh rates based on inputs and cache state.
function shouldRefreshRates(changedWidgetIds, rateEntity, providerId) {
  if (!rateEntity) return true;
  if (rateEntity.providerId !== providerId) return true;
  if (changedWidgetIds === undefined) return true;
  if (changedWidgetIds === "refresh_rates") return true;
  if (changedWidgetIds === "rate_provider") return true;
  return false;
}

// Fetch rates from the selected provider and return the normalized entity.
async function fetchRatesForProvider(providerId) {
  const provider = getProviderConfig(providerId);
  const endpoint = provider.buildEndpoint();
  console.log("fetching rates:", provider.id, endpoint);

  const response = await fetch(endpoint, { method: "GET" });
  if (!response.ok) throw new Error(`Rate request failed: ${response.status} ${response.statusText}`);
  const payload = await response.json();

  if (provider.id === "open-er-api") return parseOpenErApiRates(payload, provider, endpoint);
  throw new Error(`Unknown rate provider: '${providerId}'`);
}

// Define provider metadata to support future API additions.
function getProviderConfig(providerId) {
  if (providerId === "open-er-api") {
    return {
      id           : "open-er-api",
      name         : "open.er-api.com",
      buildEndpoint: function buildEndpoint() {
        return "https://open.er-api.com/v6/latest/USD";
      },
    };
  }
  throw new Error(`Unknown provider: '${providerId}'`);
}

// Parse the open.er-api.com payload into the shared rate entity.
function parseOpenErApiRates(payload, provider, endpoint) {
  if (!payload || payload.result !== "success") throw new Error("Exchange rate request failed.");
  const baseCode = normalizeCurrencyCode(payload.base_code, "USD");
  const rates = normalizeRatesMap(payload.rates || {});

  return buildRateEntity({
    providerId  : provider.id,
    providerName: provider.name,
    baseCode,
    rates,
    lastUpdate  : payload.time_last_update_utc ? String(payload.time_last_update_utc) : "",
    nextUpdate  : payload.time_next_update_utc ? String(payload.time_next_update_utc) : "",
    endpoint,
  });
}

// Build the shared exchange-rate entity for all providers.
function buildRateEntity(params) {
  return {
    providerId  : params.providerId,
    providerName: params.providerName,
    baseCode    : params.baseCode,
    rates       : params.rates,
    lastUpdate  : params.lastUpdate,
    nextUpdate  : params.nextUpdate,
    endpoint    : params.endpoint,
    fetchedAt   : new Date().toISOString(),
  };
}

// Parse the cached rate entity stored in the hidden input widget.
function parseRateCache(cacheText) {
  const parsed = JSON.parse(cacheText);
  return normalizeRateEntity(parsed);
}

// Normalize any cached payload into a valid rate entity or null.
function normalizeRateEntity(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (!payload.rates || typeof payload.rates !== "object") return null;
  return {
    providerId  : payload.providerId ? String(payload.providerId) : "",
    providerName: payload.providerName ? String(payload.providerName) : "",
    baseCode    : payload.baseCode ? String(payload.baseCode) : "",
    rates       : normalizeRatesMap(payload.rates),
    lastUpdate  : payload.lastUpdate ? String(payload.lastUpdate) : "",
    nextUpdate  : payload.nextUpdate ? String(payload.nextUpdate) : "",
    endpoint    : payload.endpoint ? String(payload.endpoint) : "",
    fetchedAt   : payload.fetchedAt ? String(payload.fetchedAt) : "",
  };
}

// Ensure the rates map only contains uppercase keys and numeric values.
function normalizeRatesMap(rates) {
  const normalized = {};
  for (const [key, value] of Object.entries(rates)) {
    const code = normalizeCurrencyCode(key, "");
    if (!code) continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) continue;
    normalized[code] = numeric;
  }
  return normalized;
}

// Resolve the source input for conversion based on the trigger and values.
function resolveSourceValue(currencyWidgets, inputWidgets, changedWidgetIds, Decimal) {
  if (changedWidgetIds) {
    const match = currencyWidgets.find(function findWidget(widget) {
      return widget.id === changedWidgetIds;
    });
    if (match) {
      const value = parseDecimalInput(inputWidgets[match.id], Decimal);
      if (value) return { id: match.id, code: match.code, value };
    }
  }

  for (const widget of currencyWidgets) {
    const value = parseDecimalInput(inputWidgets[widget.id], Decimal);
    if (value) return { id: widget.id, code: widget.code, value };
  }

  return null;
}

// Resolve a target currency rate from the cached map.
function resolveRate(rates, targetCode) {
  if (!rates) return null;
  const value = rates[targetCode];
  if (!Number.isFinite(value)) return null;
  return value;
}

// Build the HTML status note to guide the user.
function buildStatusNote(rateEntity, sourceCode, hint) {
  const provider = rateEntity ? rateEntity.providerName || rateEntity.providerId : "";
  const base = rateEntity ? rateEntity.baseCode : "";
  const lastUpdate = rateEntity ? rateEntity.lastUpdate || rateEntity.fetchedAt : "";
  const sourceLine = sourceCode ? `<div>Source: <span class='font-medium text-foreground'>${sourceCode}</span></div>` : "";
  const hintLine = hint ? `<div class='text-xs text-muted-foreground'>${hint}</div>` : "";

  return "<div class='space-y-1 text-sm leading-relaxed text-muted-foreground'>" +
    "<div class='flex items-center gap-2 text-foreground'>" +
    `<span class='font-semibold'>${provider || "Rate provider"}</span>` +
    "</div>" +
    `<div>Base: <span class='font-medium text-foreground'>${base || "USD"}</span></div>` +
    (lastUpdate ? `<div>Last update: ${lastUpdate}</div>` : "") +
    sourceLine +
    hintLine +
    "</div>";
}

// Parse decimal input without throwing by validating first.
function parseDecimalInput(value, Decimal) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (!isDecimalText(text)) return null;
  const decimalValue = new Decimal(text);
  if (!decimalValue.isFinite()) return null;
  return decimalValue;
}

// Validate decimal strings without using try/catch.
function isDecimalText(value) {
  return /^[+-]?(?:\d+\.?\d*|\d*\.\d+)$/.test(value);
}

// Format decimal values with trimmed trailing zeros.
function formatDecimal(value, decimals) {
  const rounded = value.toDecimalPlaces(decimals);
  return trimDecimalZeros(rounded.toFixed(decimals));
}

// Remove unnecessary trailing zeros from decimal strings.
function trimDecimalZeros(value) {
  if (value.indexOf(".") === -1) return value;
  const trimmed = value.replace(/\.?0+$/, "");
  return trimmed === "-0" ? "0" : trimmed;
}

// Normalize currency codes to uppercase with an optional fallback.
function normalizeCurrencyCode(value, fallback) {
  const trimmed = value ? String(value).trim() : "";
  return (trimmed || fallback || "").toUpperCase();
}
