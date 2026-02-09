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
  const cidrInput = normalizeInput(inputWidgets.cidr_input);
  const ipInput = normalizeInput(inputWidgets.ip_input);
  const prefixInput = normalizeInput(inputWidgets.prefix_input);
  const testIpInput = normalizeInput(inputWidgets.test_ip_input);
  const emptyResult = buildEmptyResult();
  if (!cidrInput && (!ipInput || !prefixInput)) return emptyResult;

  const { Address6 } = await requirePackage("ip-address");
  let address;
  let prefix;
  try {
    if (cidrInput) {
      address = new Address6(cidrInput);
      prefix = address.subnetMask;
    } else {
      const prefixLength = parsePrefixLength(prefixInput);
      if (prefixLength === null) return emptyResult;
      prefix = prefixLength;
      address = new Address6(`${ipInput}/${prefixLength}`);
    }
  } catch (error) {
    return emptyResult;
  }

  const networkAddress = address.startAddress();
  const networkAddressText = networkAddress.correctForm();
  const firstAddress = prefix >= 127 ? networkAddressText : networkAddress.startAddressExclusive().correctForm();
  const lastAddress = prefix >= 127 ? address.endAddress().correctForm() : address.endAddressExclusive().correctForm();
  const networkSize = formatNetworkSize(prefix);
  const testResult = resolveIpInCidr(Address6, testIpInput, networkAddressText, prefix);

  return {
    result_values: {
      netmask        : `${networkAddressText}/${prefix}`,
      network_address: networkAddressText,
      cidr_notation  : `/${prefix}`,
      network_size   : networkSize,
      first_address  : firstAddress,
      last_address   : lastAddress,
      ip_type        : address.getType(),
      scope          : address.getScope(),
    },
    cidr_binary   : buildCidrBinaryHtml(networkAddress, prefix),
    test_ip_result: buildIpCheckHtml(testResult),
  };
}

function normalizeInput(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function buildEmptyResult() {
  return {
    result_values : buildEmptyValues(),
    cidr_binary   : "",
    test_ip_result: buildIpCheckHtml(""),
  };
}

function buildEmptyValues() {
  return {
    netmask        : "",
    network_address: "",
    cidr_notation  : "",
    network_size   : "",
    first_address  : "",
    last_address   : "",
    ip_type        : "",
    scope          : "",
  };
}

function parsePrefixLength(value) {
  if (!value) return null;
  const trimmed = value.startsWith("/") ? value.slice(1) : value;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 128) return null;
  return parsed;
}

function formatNetworkSize(prefix) {
  if (prefix < 0 || prefix > 128) return "";
  return (BigInt(2) ** BigInt(128 - prefix)).toString();
}

function resolveIpInCidr(Address6, testIp, networkAddress, prefix) {
  if (!testIp) return "";
  try {
    const testAddress = new Address6(testIp);
    const subnetAddress = new Address6(`${networkAddress}/${prefix}`);
    return testAddress.isInSubnet(subnetAddress) ? "Yes" : "No";
  } catch (error) {
    return "";
  }
}

function buildIpCheckHtml(result) {
  if (!result) {
    return "<span class='text-xs text-muted-foreground'>Enter an IP address to check membership.</span>";
  }
  const isInside = result === "Yes";
  const badgeClass = isInside
    ? "bg-primary/10 text-primary border-primary/20"
    : "bg-destructive/10 text-destructive border-destructive/20";
  const text = isInside ? "Inside CIDR range" : "Outside CIDR range";
  return `<span class='inline-flex items-center rounded-sm border px-2 py-1 text-xs font-semibold ${badgeClass}'>${text}</span>`;
}

function buildCidrBinaryHtml(address, prefix) {
  const binary = address.binaryZeroPad();
  if (!binary) return "";
  const maskBinary = bitsToBinary(prefix);
  const cidrBinary = buildColoredBinary(binary, prefix);
  const maskColored = buildColoredMaskBinary(maskBinary, prefix);
  return [
    "<div class='w-full overflow-x-auto'>",
    "<table class='w-full border-collapse text-sm'>",
    "<tbody class='divide-y divide-border'>",
    "<tr>",
    "<td class='py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap'>CIDR binary</td>",
    `<td class='py-2 font-mono text-[12px] leading-relaxed'>${cidrBinary}</td>`,
    "</tr>",
    "<tr>",
    "<td class='py-2 pr-3 align-top text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap'>Mask binary</td>",
    `<td class='py-2 font-mono text-[12px] leading-relaxed'>${maskColored}</td>`,
    "</tr>",
    "</tbody>",
    "</table>",
    "</div>",
  ].join("");
}

function bitsToBinary(bits) {
  return "1".repeat(bits).padEnd(128, "0");
}

function buildColoredBinary(binary, prefix) {
  return buildColoredBinaryRow(binary, prefix, true);
}

function buildColoredMaskBinary(binary, prefix) {
  return buildColoredBinaryRow(binary, prefix, false);
}

function buildColoredBinaryRow(binary, prefix, useForeground) {
  let html = "";
  for (let i = 0; i < 8; i += 1) {
    const start = i * 16;
    const end = start + 16;
    const group = binary.slice(start, end);
    const maskCount = Math.min(Math.max(prefix - start, 0), 16);
    const masked = group.slice(0, maskCount);
    const host = group.slice(maskCount);
    if (masked) {
      const maskedClass = useForeground ? "text-foreground" : "text-muted-foreground";
      html += `<span class='${maskedClass}'>${masked}</span>`;
    }
    if (host) html += `<span class='text-primary font-semibold'>${host}</span>`;
    if (i < 7) html += "<span class='text-muted-foreground'>:</span>";
  }
  return html;
}
