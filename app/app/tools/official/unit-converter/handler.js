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
  console.log("unit-converter trigger:", changedWidgetIds);

  const Decimal = await requirePackage("decimal.js");
  const formatMode = "decimal";
  const groups = getUnitGroups();
  const updates = {};

  // Update only the affected group to keep calculations focused.
  for (const group of groups) {
    if (changedWidgetIds && !group.widgetIds.includes(changedWidgetIds)) continue;

    const source = resolveGroupSourceValue(group, inputWidgets, changedWidgetIds, Decimal);
    if (!source) continue;

    const baseValue = source.unit.toBase(source.value, Decimal);
    if (!isDecimalValid(baseValue, Decimal)) continue;

    for (const unit of group.units) {
      if (unit.id === "speed_pace" && changedWidgetIds === "speed_pace") continue;
      const nextValue = unit.fromBase(baseValue, Decimal);
      if (!isDecimalValid(nextValue, Decimal)) continue;
      const formatted = formatOutputValue(nextValue, unit, formatMode, Decimal);
      if (formatted === null) continue;
      updates[unit.id] = formatted;
    }
  }

  return updates;
}

function getUnitGroups() {
  // Group definitions keep conversions reusable as new categories are added.
  return [
    createLinearGroup("weight", [
      createFactorUnit("weight_kg", 1),
      createFactorUnit("weight_g", 0.001),
      createFactorUnit("weight_mg", 0.000001),
      createFactorUnit("weight_t", 1000),
      createFactorUnit("weight_lb", 0.45359237),
      createFactorUnit("weight_oz", 0.028349523125),
      createFactorUnit("weight_st", 6.35029318),
      createFactorUnit("weight_ct", 0.0002)
    ]),
    createLinearGroup("length", [
      createFactorUnit("length_m", 1),
      createFactorUnit("length_cm", 0.01),
      createFactorUnit("length_mm", 0.001),
      createFactorUnit("length_um", 0.000001),
      createFactorUnit("length_nm", 0.000000001),
      createFactorUnit("length_km", 1000),
      createFactorUnit("length_ft", 0.3048),
      createFactorUnit("length_in", 0.0254),
      createFactorUnit("length_yd", 0.9144),
      createFactorUnit("length_mi", 1609.344),
      createFactorUnit("length_nmi", 1852)
    ]),
    createLinearGroup("volume", [
      createFactorUnit("volume_l", 1),
      createFactorUnit("volume_ml", 0.001),
      createFactorUnit("volume_cm3", 0.001),
      createFactorUnit("volume_m3", 1000),
      createFactorUnit("volume_in3", 0.016387064),
      createFactorUnit("volume_ft3", 28.316846592),
      createFactorUnit("volume_cup", 0.2365882365),
      createFactorUnit("volume_floz", 0.0295735295625),
      createFactorUnit("volume_pt", 0.473176473),
      createFactorUnit("volume_qt", 0.946352946),
      createFactorUnit("volume_gal", 3.785411784)
    ]),
    createLinearGroup("area", [
      createFactorUnit("area_m2", 1),
      createFactorUnit("area_mm2", 0.000001),
      createFactorUnit("area_cm2", 0.0001),
      createFactorUnit("area_km2", 1000000),
      createFactorUnit("area_in2", 0.00064516),
      createFactorUnit("area_ft2", 0.09290304),
      createFactorUnit("area_yd2", 0.83612736),
      createFactorUnit("area_mi2", 2589988.110336),
      createFactorUnit("area_ha", 10000),
      createFactorUnit("area_ac", 4046.8564224),
      createFactorUnit("area_tsubo", 3.3057851239669422),
      createFactorUnit("area_tatami_kyoma", 1.82405),
      createFactorUnit("area_tatami_chukyoma", 1.6562),
      createFactorUnit("area_tatami_edoma", 1.54527),
      createFactorUnit("area_tatami_danchima", 1.445)
    ]),
    createLinearGroup("speed", [
      createRationalUnit("speed_cms", 1, 100),
      createFactorUnit("speed_ms", 1),
      createFactorUnit("speed_kms", 1000),
      createRationalUnit("speed_cmh", 1, 360000),
      createRationalUnit("speed_mh", 1, 3600),
      createRationalUnit("speed_kmh", 1000, 3600),
      createPaceUnit("speed_pace"),
      createRationalUnit("speed_knot", 1852, 3600),
      createFactorUnit("speed_mach", 340.29)
    ]),
    createTemperatureGroup(),
    createLinearGroup("energy", [
      createFactorUnit("energy_j", 1),
      createFactorUnit("energy_kj", 1000),
      createFactorUnit("energy_cal", 4.184),
      createFactorUnit("energy_kcal", 4184),
      createFactorUnit("energy_wh", 3600)
    ]),
    createLinearGroup("time", [
      createFactorUnit("time_ns", "0.000000001"),
      createFactorUnit("time_us", "0.000001"),
      createFactorUnit("time_ms", "0.001"),
      createFactorUnit("time_s", 1),
      createFactorUnit("time_min", 60),
      createFactorUnit("time_h", 3600),
      createFactorUnit("time_d", 86400),
      createFactorUnit("time_w", 604800),
      createFactorUnit("time_y", 31536000)
    ]),
    createLinearGroup("data", [
      createRationalUnit("data_bit", 1, 8),
      createFactorUnit("data_byte", 1),
      createFactorUnit("data_kib", 1024),
      createFactorUnit("data_mib", 1048576),
      createFactorUnit("data_gib", 1073741824),
      createFactorUnit("data_tib", 1099511627776),
      createFactorUnit("data_pib", 1125899906842624),
      createFactorUnit("data_kb", 1000),
      createFactorUnit("data_mb", 1000000),
      createFactorUnit("data_gb", 1000000000),
      createFactorUnit("data_tb", 1000000000000),
      createFactorUnit("data_pb", 1000000000000000)
    ]),
    createLinearGroup("pressure", [
      createFactorUnit("pressure_atm", 101325),
      createFactorUnit("pressure_bar", 100000),
      createFactorUnit("pressure_mmhg", "133.322387415"),
      createFactorUnit("pressure_pa", 1),
      createFactorUnit("pressure_kpa", 1000)
    ])
  ];
}

function createTemperatureGroup() {
  // Temperature is nonlinear, so it needs custom conversion formulas.
  return createGroup("temperature", [
    createCustomUnit("temperature_c", function toBase(value, Decimal) {
      return value;
    }, function fromBase(value, Decimal) {
      return value;
    }),
    createCustomUnit("temperature_f", function toBase(value, Decimal) {
      return value.minus(32).mul(5).div(9);
    }, function fromBase(value, Decimal) {
      return value.mul(9).div(5).plus(32);
    }),
    createCustomUnit("temperature_k", function toBase(value, Decimal) {
      return value.minus(273.15);
    }, function fromBase(value, Decimal) {
      return value.plus(273.15);
    }),
    createCustomUnit("temperature_r", function toBase(value, Decimal) {
      return value.mul(5).div(9).minus(273.15);
    }, function fromBase(value, Decimal) {
      return value.plus(273.15).mul(9).div(5);
    })
  ]);
}

function createLinearGroup(id, units) {
  // Linear groups share the same base value conversion.
  return createGroup(id, units);
}

function createGroup(id, units) {
  return { id, units, widgetIds: collectUnitIds(units) };
}

function collectUnitIds(units) {
  return units.map(function mapUnit(unit) {
    return unit.id;
  });
}

function createFactorUnit(id, factor) {
  // Factor is relative to the base unit in each group.
  function toBase(value, Decimal) {
    return toDecimal(value, Decimal).mul(toDecimalFactor(factor, Decimal));
  }

  function fromBase(value, Decimal) {
    return toDecimal(value, Decimal).div(toDecimalFactor(factor, Decimal));
  }

  return { id, toBase, fromBase, parseInput: parseDecimalInput };
}

function createRationalUnit(id, numerator, denominator) {
  // Use exact ratios to avoid floating point drift (e.g., km/h to m/h).
  function toBase(value, Decimal) {
    return toDecimal(value, Decimal).mul(numerator).div(denominator);
  }

  function fromBase(value, Decimal) {
    return toDecimal(value, Decimal).mul(denominator).div(numerator);
  }

  return { id, toBase, fromBase, parseInput: parseDecimalInput };
}

function createCustomUnit(id, toBase, fromBase, parseInput) {
  // Custom units allow non-linear conversions like temperature.
  return {
    id,
    toBase: function toCustomBase(value, Decimal) {
      return toBase(toDecimal(value, Decimal), Decimal);
    },
    fromBase: function fromCustomBase(value, Decimal) {
      return fromBase(toDecimal(value, Decimal), Decimal);
    },
    parseInput: parseInput ?? parseDecimalInput
  };
}

function createPaceUnit(id) {
  // Pace is inverse speed, represented as minutes per kilometer.
  function toBase(value, Decimal) {
    const paceMinutes = toDecimal(value, Decimal);
    if (!paceMinutes.isFinite() || paceMinutes.lte(0)) return new Decimal(NaN);
    return new Decimal(1000).div(paceMinutes.mul(60));
  }

  function fromBase(value, Decimal) {
    const speed = toDecimal(value, Decimal);
    if (!speed.isFinite() || speed.lte(0)) return new Decimal(NaN);
    return new Decimal(1000).div(speed).div(60);
  }

  return createCustomUnit(id, toBase, fromBase, parsePaceInput);
}

function resolveGroupSourceValue(group, inputWidgets, changedWidgetId, Decimal) {
  // Respect the widget that triggered the execution, or fall back to the first valid value.
  if (changedWidgetId) {
    const unit = findUnitById(group, changedWidgetId);
    if (!unit) return null;

    const value = parseUnitInput(unit, inputWidgets[changedWidgetId], Decimal);
    if (!value) return null;

    return { unit, value };
  }

  for (const unit of group.units) {
    const value = parseUnitInput(unit, inputWidgets[unit.id], Decimal);
    if (value) return { unit, value };
  }

  return null;
}

function findUnitById(group, unitId) {
  for (const unit of group.units) {
    if (unit.id === unitId) return unit;
  }
  return null;
}

function parseUnitInput(unit, value, Decimal) {
  if (!unit.parseInput) return null;
  return unit.parseInput(value, Decimal);
}

function parseDecimalInput(value, Decimal) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return toDecimal(trimmed, Decimal);
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return toDecimal(value, Decimal);
}

function toDecimalFactor(value, Decimal) {
  return Decimal.isDecimal(value) ? value : new Decimal(value);
}

function parsePaceInput(value, Decimal) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parts = splitPaceInput(trimmed);
    if (parts) {
      if (parts.length !== 2) return null;
      const minutes = toDecimal(parts[0] || "0", Decimal);
      const seconds = toDecimal(parts[1] || "0", Decimal);
      if (!minutes.isFinite() || !seconds.isFinite()) return null;
      return minutes.plus(seconds.div(60));
    }
    return toDecimal(trimmed, Decimal);
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return toDecimal(value, Decimal);
}

function splitPaceInput(value) {
  if (value.includes("'")) return value.split("'").map(function mapPart(part) {
    return part.trim();
  });
  if (value.includes(":")) return value.split(":").map(function mapPart(part) {
    return part.trim();
  });
  return null;
}

function formatOutputValue(value, unit, formatMode, Decimal) {
  const decimalValue = toDecimal(value, Decimal);
  if (!decimalValue.isFinite()) return null;
  if (unit.id === "speed_pace") return formatPaceOutput(decimalValue, Decimal);
  if (formatMode === "scientific") return decimalValue.toExponential();
  return normalizeNumber(decimalValue);
}

function formatPaceOutput(value, Decimal) {
  if (!value.isFinite() || value.lte(0)) return null;
  const totalSeconds = value.mul(60);
  let minutes = totalSeconds.div(60).floor();
  let seconds = totalSeconds.minus(minutes.mul(60)).round();
  if (seconds.greaterThanOrEqualTo(60)) {
    minutes = minutes.plus(1);
    seconds = new Decimal(0);
  }
  const minuteText = minutes.toFixed(0);
  const secondText = seconds.toFixed(0).padStart(2, "0");
  return `${minuteText}'${secondText}`;
}

function normalizeNumber(value) {
  // Keep adaptive precision so tiny values (e.g., nm to m) are still visible.
  const rounded = value.toDecimalPlaces(pickDecimals(value));
  const fixedValue = rounded.toFixed(pickDecimals(rounded));
  return trimDecimalZeros(fixedValue);
}

function pickDecimals(decimalValue) {
  const absValue = decimalValue.abs();
  if (absValue.isZero()) return 8;
  if (absValue.greaterThanOrEqualTo(1)) return 8;
  if (absValue.greaterThanOrEqualTo(0.000001)) return 10;
  return 12;
}

function trimDecimalZeros(value) {
  if (value.indexOf(".") === -1) return value;
  const trimmed = value.replace(/\.?0+$/, "");
  return trimmed === "-0" ? "0" : trimmed;
}

function toDecimal(value, Decimal) {
  return Decimal.isDecimal(value) ? value : new Decimal(value);
}

function isDecimalValid(value, Decimal) {
  if (!Decimal.isDecimal(value)) return false;
  return value.isFinite();
}
