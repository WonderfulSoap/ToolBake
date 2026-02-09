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
  if (typeof window === "undefined" || typeof window.screen === "undefined") {
    return {};
  }

  const screen = window.screen;
  const dpr = window.devicePixelRatio || 1;
  
  const width = screen.width;
  const height = screen.height;
  const availWidth = screen.availWidth;
  const availHeight = screen.availHeight;
  
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  const colorDepth = screen.colorDepth;
  const pixelDepth = screen.pixelDepth;

  const physicalWidth = Math.round(width * dpr);
  const physicalHeight = Math.round(height * dpr);
  
  // Aspect Ratio
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  const arW = width / divisor;
  const arH = height / divisor;
  const aspectRatio = `${arW}:${arH}`;
  
  // Resolution Category (check physical width if available)
  const checkWidth = physicalWidth > width ? physicalWidth : width;
  let category = "";
  if (checkWidth >= 7680) category = "8K UHD";
  else if (checkWidth >= 3840) category = "4K UHD";
  else if (checkWidth >= 2560) category = "QHD / 2K";
  else if (checkWidth >= 1920) category = "Full HD";
  else if (checkWidth >= 1280) category = "HD";
  else category = "Standard Definition";
  
  let orientation = "";
  if (arW > arH) orientation = "(Landscape)";
  else if (arW < arH) orientation = "(Portrait)";
  else orientation = "(Square)";

  let type = "";
  if (arW / arH >= 1.7) type = ", Widescreen";

  const formatValue = (val) => `<span class="font-mono font-medium text-foreground">${val}</span>`;
  const formatDim = (w, h) => `<span class="font-mono font-medium text-foreground">${w} x ${h}</span>`;

  const categoryHtml = `<span class="font-medium text-primary">${category}</span> <span class="text-xs text-muted-foreground">${orientation}${type}</span>`;

  return {
    device_res  : formatDim(width, height),
    physical_res: formatDim(physicalWidth, physicalHeight),
    inner_res   : formatDim(availWidth, availHeight),
    dpr         : formatValue(dpr),
    color_depth : formatValue(colorDepth),
    pixel_depth : formatValue(pixelDepth),
    aspect_ratio: formatValue(aspectRatio),
    res_category: categoryHtml,
    viewport    : formatDim(viewportWidth, viewportHeight)
  };
}
