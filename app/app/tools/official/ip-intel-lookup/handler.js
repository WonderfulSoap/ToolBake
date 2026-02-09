
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
  const providerId = resolveProviderId(inputWidgets.provider);
  const customIp = normalizeIpInput(inputWidgets.custom_ip);
  const endpoint = resolveEndpoint(providerId, customIp);
  const shouldFetch = !changedWidgetIds || changedWidgetIds === "lookup_ip" || (changedWidgetIds === "provider" && !customIp);
  if (!shouldFetch) return { provider_note: buildProviderNote(providerId, endpoint) };
  const response = await fetch(endpoint, { method: "GET" });
  if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  const data = await response.json();
  if (providerId === "ip-api" && data && data.status === "fail") throw new Error(data.message || "ip-api request failed");
  return {
    provider_note: buildProviderNote(providerId, endpoint),
    ip_summary   : buildCommonInfo(providerId, data),
    raw_response : JSON.stringify(data, null, 2),
  };
}

function resolveProviderId(value) {
  return value || "ipapi";
}

function getProviderMeta(providerId) {
  if (providerId === "ipapi") return { id: "ipapi", name: "ipapi.co", badge: "free tier", limit: "Free tier up to 1,000 requests per day.", notes: "Returns IP, location, ASN, and ISP details. Supports custom IP lookup.", baseEndpoint: "https://ipapi.co" };
  if (providerId === "ip-api") return { id: "ip-api", name: "ip-api", badge: "free tier", limit: "Free endpoint limited to 45 requests per minute.", notes: "Returns IP, geolocation, and network data. Supports custom IP lookup.", baseEndpoint: "http://ip-api.com" };
  if (providerId === "ipify") return { id: "ipify", name: "ipify", badge: "public", limit: "No published rate limit for the public endpoint.", notes: "Returns your public IP only. Custom IP lookup is not supported.", baseEndpoint: "https://api.ipify.org" };
  throw new Error(`Unknown provider: '${providerId}'`);
}

function resolveEndpoint(providerId, customIp) {
  const meta = getProviderMeta(providerId);
  if (providerId === "ipapi") return customIp ? `${meta.baseEndpoint}/${encodeURIComponent(customIp)}/json/` : `${meta.baseEndpoint}/json/`;
  if (providerId === "ip-api") return customIp ? `${meta.baseEndpoint}/json/${encodeURIComponent(customIp)}` : `${meta.baseEndpoint}/json`;
  if (providerId === "ipify") return `${meta.baseEndpoint}?format=json`;
  throw new Error(`Unknown provider: '${providerId}'`);
}

function buildProviderNote(providerId, endpoint) {
  const meta = getProviderMeta(providerId);
  return `<div class='space-y-1 text-sm leading-relaxed text-muted-foreground'><div class='flex items-center gap-2 text-foreground'><span class='font-semibold'>${meta.name}</span><span class='inline-flex items-center gap-1 rounded-sm bg-muted/60 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground'>${meta.badge}</span></div><ul class='list-disc pl-4 space-y-1'><li>Endpoint: <code class='rounded bg-muted px-1 py-0.5 text-[12px] font-mono'>${endpoint}</code></li><li>Limit: ${meta.limit}</li><li>${meta.notes}</li></ul></div>`;
}

function buildCommonInfo(providerId, data) {
  const empty = { ip: "", country: "", region: "", city: "", timezone: "", isp: "", organization: "", asn: "" };
  if (!data) return empty;
  if (providerId === "ipapi") {
    return {
      ip          : data.ip ? String(data.ip) : "",
      country     : data.country_name ? String(data.country_name) : data.country ? String(data.country) : "",
      region      : data.region ? String(data.region) : "",
      city        : data.city ? String(data.city) : "",
      timezone    : data.timezone ? String(data.timezone) : "",
      isp         : data.org ? String(data.org) : data.isp ? String(data.isp) : "",
      organization: data.org ? String(data.org) : "",
      asn         : data.asn ? String(data.asn) : data.asn_org ? String(data.asn_org) : "",
    };
  }
  if (providerId === "ip-api") {
    return {
      ip          : data.query ? String(data.query) : "",
      country     : data.country ? String(data.country) : "",
      region      : data.regionName ? String(data.regionName) : "",
      city        : data.city ? String(data.city) : "",
      timezone    : data.timezone ? String(data.timezone) : "",
      isp         : data.isp ? String(data.isp) : "",
      organization: data.org ? String(data.org) : "",
      asn         : data.as ? String(data.as) : "",
    };
  }
  if (providerId === "ipify") {
    return { ...empty, ip: data.ip ? String(data.ip) : "" };
  }
  return empty;
}

function normalizeIpInput(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  return trimmed;
}
