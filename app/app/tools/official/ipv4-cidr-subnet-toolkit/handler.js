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
  const netmaskInput = normalizeInput(inputWidgets.netmask_input);
  const testIpInput = normalizeInput(inputWidgets.test_ip_input);
  const emptyResult = buildEmptyResult();
  if (!cidrInput && (!ipInput || !netmaskInput)) return emptyResult;

  const { Address4 } = await requirePackage("ip-address");
  let address;
  let prefix;
  try {
    if (cidrInput) {
      address = new Address4(cidrInput);
      prefix = address.subnetMask;
    } else {
      const maskBits = parseNetmaskToBits(netmaskInput);
      if (maskBits === null) return emptyResult;
      prefix = maskBits;
      address = new Address4(`${ipInput}/${maskBits}`);
    }
  } catch (error) {
    return emptyResult;
  }

  const networkAddress = address.startAddress().correctForm();
  const broadcastAddress = address.endAddress().correctForm();
  const firstAddress = prefix >= 31 ? networkAddress : address.startAddressExclusive().correctForm();
  const lastAddress = prefix >= 31 ? broadcastAddress : address.endAddressExclusive().correctForm();
  const networkMask = bitsToDottedDecimal(prefix);
  const testResult = resolveIpInCidr(Address4, testIpInput, networkAddress, prefix);

  return {
    result_values: {
      netmask          : `${networkAddress}/${prefix}`,
      network_address  : networkAddress,
      network_mask     : networkMask,
      cidr_notation    : `/${prefix}`,
      wildcard_mask    : maskToWildcard(networkMask),
      network_size     : String(2 ** (32 - prefix)),
      first_address    : firstAddress,
      last_address     : lastAddress,
      broadcast_address: broadcastAddress,
      ip_class         : resolveIpClass(networkAddress),
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

function parseNetmaskToBits(mask) {
  const parts = mask.split(".");
  if (parts.length !== 4) return null;
  let binary = "";
  for (const part of parts) {
    if (part.trim() === "") return null;
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    binary += value.toString(2).padStart(8, "0");
  }
  const firstZero = binary.indexOf("0");
  if (firstZero === -1) return 32;
  if (binary.slice(firstZero).includes("1")) return null;
  return firstZero;
}

function bitsToDottedDecimal(bits) {
  const binary = "1".repeat(bits).padEnd(32, "0");
  return binary.match(/.{8}/g).map((chunk) => String(parseInt(chunk, 2))).join(".");
}

function maskToWildcard(mask) {
  return mask.split(".").map((part) => String(255 - Number(part))).join(".");
}

function resolveIpClass(address) {
  const firstOctet = Number(address.split(".")[0]);
  if (firstOctet >= 0 && firstOctet <= 127) return "A";
  if (firstOctet <= 191) return "B";
  if (firstOctet <= 223) return "C";
  if (firstOctet <= 239) return "D";
  if (firstOctet <= 255) return "E";
  return "Unknown";
}

function buildEmptyValues() {
  return {
    netmask          : "",
    network_address  : "",
    network_mask     : "",
    cidr_notation    : "",
    wildcard_mask    : "",
    network_size     : "",
    first_address    : "",
    last_address     : "",
    broadcast_address: "",
    ip_class         : "",
  };
}

function resolveIpInCidr(Address4, testIp, networkAddress, prefix) {
  if (!testIp) return "";
  try {
    const testAddress = new Address4(testIp);
    const subnetAddress = new Address4(`${networkAddress}/${prefix}`);
    return testAddress.isInSubnet(subnetAddress) ? "Yes" : "No";
  } catch (error) {
    return "";
  }
}

function buildIpCheckHtml(result) {
  if (!result) {
    return "<span class='text-xs text-muted-foreground'>Enter an IP address to check if it is in the CIDR.</span>";
  }
  const isInside = result === "Yes";
  const badgeClass = isInside
    ? "bg-primary/10 text-primary border-primary/20"
    : "bg-destructive/10 text-destructive border-destructive/20";
  const text = isInside ? "Inside CIDR range" : "Outside CIDR range";
  return `<span class='inline-flex items-center rounded-sm border px-2 py-1 text-xs font-semibold ${badgeClass}'>${text}</span>`;
}

function buildCidrBinaryHtml(address, prefix) {
  const binary = addressToBinary(address);
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

function addressToBinary(address) {
  const parts = address.split(".");
  if (parts.length !== 4) return "";
  const binaries = parts.map((part) => {
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) return null;
    return value.toString(2).padStart(8, "0");
  });
  if (binaries.some((value) => value === null)) return "";
  return binaries.join("");
}

function bitsToBinary(bits) {
  return "1".repeat(bits).padEnd(32, "0");
}

function buildColoredBinary(binary, prefix) {
  let html = "";
  for (let i = 0; i < 4; i += 1) {
    const start = i * 8;
    const end = start + 8;
    const group = binary.slice(start, end);
    const maskCount = Math.min(Math.max(prefix - start, 0), 8);
    const masked = group.slice(0, maskCount);
    const host = group.slice(maskCount);
    if (masked) html += `<span class='text-foreground'>${masked}</span>`;
    if (host) html += `<span class='text-primary font-semibold'>${host}</span>`;
    if (i < 3) html += "<span class='text-muted-foreground'>.</span>";
  }
  return html;
}

function buildColoredMaskBinary(binary, prefix) {
  let html = "";
  for (let i = 0; i < 4; i += 1) {
    const start = i * 8;
    const end = start + 8;
    const group = binary.slice(start, end);
    const maskCount = Math.min(Math.max(prefix - start, 0), 8);
    const masked = group.slice(0, maskCount);
    const host = group.slice(maskCount);
    if (masked) html += `<span class='text-muted-foreground'>${masked}</span>`;
    if (host) html += `<span class='text-primary font-semibold'>${host}</span>`;
    if (i < 3) html += "<span class='text-muted-foreground'>.</span>";
  }
  return html;
}
