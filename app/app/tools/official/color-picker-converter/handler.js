/**
 * @param {InputUIWidgets} inputWidgets
 * @param {ChangedUIWidget} changedWidgetIds
 * @returns {Promise<HandlerReturnWidgets>}
 */
async function handler(inputWidgets, changedWidgetIds) {
  const Color = await requirePackage("colorjs.io");

  let sourceValue = "";

  // 1. Determine which widget triggered the change to get the source value
  if (changedWidgetIds === "color_picker") {
    sourceValue = inputWidgets.color_picker;
  } else if (changedWidgetIds === "color_text") {
    sourceValue = inputWidgets.color_text;
  } else if (changedWidgetIds?.startsWith("conversions.")) {
    const field = changedWidgetIds.split(".")[1];
    sourceValue = inputWidgets.conversions[field];
  } else {
    // Default fallback (e.g., initial load)
    sourceValue = inputWidgets.color_text || "#0EA5E9";
  }

  // 2. Parse the color
  const colorObj = new Color(sourceValue);

  // 3. Define custom formats for standard integer-based RGB/RGBA
  const rgbIntFormat = {
    name  : "rgb",
    coords: ["<number>[0, 255]", "<number>[0, 255]", "<number>[0, 255]"],
    commas: true
  };

  const rgbaIntFormat = {
    name  : "rgba",
    coords: ["<number>[0, 255]", "<number>[0, 255]", "<number>[0, 255]"],
    commas: true,
    alpha : true
  };

  // 4. Manually calculate HEX and HEXA for fixed lengths
  const srgb = colorObj.to("srgb");
  const toHex = (val) => {
    const int = Math.max(0, Math.min(255, Math.round(val * 255)));
    return int.toString(16).padStart(2, "0").toUpperCase();
  };

  const r = toHex(srgb.coords[0]);
  const g = toHex(srgb.coords[1]);
  const b = toHex(srgb.coords[2]);
  const a = toHex(srgb.alpha);

  const hex6 = `#${r}${g}${b}`;
  const hex8 = `#${r}${g}${b}${a}`;

  // 5. Build results
  const results = {};

  // Update color_picker if it wasn't the trigger
  if (changedWidgetIds !== "color_picker") {
    results.color_picker = srgb.alpha < 1 ? hex8 : hex6;
  }

  // Generate conversion outputs
  results.conversions = {
    hex     : hex6,
    hexa    : hex8,
    rgb_int : srgb.toString({ format: rgbIntFormat }),
    rgba_int: srgb.toString({ format: rgbaIntFormat }),
    rgb_pct : srgb.toString({ format: "rgb" }),
    rgba_pct: srgb.toString({ format: "rgba" }),
    hsl     : colorObj.to("hsl").toString({ precision: 3 }),
    oklch   : colorObj.to("oklch").toString({ precision: 4 }),
    lab     : colorObj.to("lab").toString({ precision: 4 }),
    p3      : colorObj.to("p3").toString({ format: "color" })
  };

  // Note: results.color_text is intentionally OMITTED to ensure it's only modified by user input.
  return results;
}