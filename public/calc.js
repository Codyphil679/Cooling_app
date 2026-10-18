// Cooling calculations. Every function takes and returns SI units:
// m, s, kg, W, J/(kg·K), W/(m·K), W/(m²·K), m³/s, and °C for temperatures.

export const WATER = { density: 998, cp: 4182 };

const W_PER_BTU_H = 0.29307107;
const W_PER_TON_REFRIGERATION = 3516.853;

export const toBtuPerHour = (watts) => watts / W_PER_BTU_H;
export const toTonsRefrigeration = (watts) => watts / W_PER_TON_REFRIGERATION;

// Mass of product passing per second for a sheet, strip or film.
export function massFlowSheet({ density, thickness, width, speed }) {
  return density * thickness * width * speed;
}

// Heat that must be removed to take the product from tIn to tOut.
export function heatLoad({ massFlow, cp, tIn, tOut }) {
  return massFlow * cp * (tIn - tOut);
}

// Water flow needed to carry `load` away with the given water temperature rise.
export function waterFlowFor(load, waterRise) {
  if (!(waterRise > 0)) return NaN;
  return load / (WATER.density * WATER.cp * waterRise);
}

// Heat picked up by cooling water, from flow and inlet/outlet temperatures.
export function waterHeat({ flow, tIn, tOut }) {
  return flow * WATER.density * WATER.cp * (tOut - tIn);
}

export function waterTempRise(load, flow) {
  if (!(flow > 0)) return NaN;
  return load / (WATER.density * WATER.cp * flow);
}

export function contactLength(diameter, wrapDeg) {
  return (Math.PI * diameter * wrapDeg) / 360;
}

export function contactTime(diameter, wrapDeg, speed) {
  if (!(speed > 0)) return NaN;
  return contactLength(diameter, wrapDeg) / speed;
}

// Heat capacity of one square metre of product (J/(m²·K)).
export function arealHeatCapacity({ density, cp, thickness }) {
  return density * cp * thickness;
}

// Lumped model: the product approaches the roll surface temperature
// exponentially while it is in contact with the roll.
export function rollExitTemp({ tIn, tRoll, htc, time, areal }) {
  return tRoll + (tIn - tRoll) * Math.exp((-htc * time) / areal);
}

// Inverse of rollExitTemp: the heat transfer coefficient that explains a
// measured exit temperature.
export function calibrateHtc({ tIn, tOut, tRoll, time, areal }) {
  const ratio = (tOut - tRoll) / (tIn - tRoll);
  if (!(ratio > 0 && ratio < 1) || !(time > 0)) return NaN;
  return (-areal * Math.log(ratio)) / time;
}

// Above roughly 0.5 the inside of the product lags its surface noticeably,
// so the lumped model gets optimistic.
export function biotNumber({ htc, thickness, conductivity }) {
  return (htc * thickness) / conductivity;
}

export function simulateRoll(product, roll, tIn) {
  const time = contactTime(roll.diameter, roll.wrap, product.speed);
  const areal = arealHeatCapacity(product);
  const tOut = rollExitTemp({ tIn, tRoll: roll.surfaceTemp, htc: roll.htc, time, areal });
  const heat = heatLoad({ massFlow: massFlowSheet(product), cp: product.cp, tIn, tOut });
  const drivingDiff = tIn - roll.surfaceTemp;
  return {
    tIn,
    tOut,
    time,
    contactLength: contactLength(roll.diameter, roll.wrap),
    heat,
    effectiveness: drivingDiff !== 0 ? (tIn - tOut) / drivingDiff : 0,
    waterRise: waterTempRise(heat, roll.waterFlow),
  };
}

export function simulateZone(product, rolls, tIn) {
  let t = tIn;
  const results = rolls.map((roll) => {
    const r = simulateRoll(product, roll, t);
    t = r.tOut;
    return r;
  });
  return {
    rolls: results,
    tOut: t,
    totalHeat: results.reduce((sum, r) => sum + r.heat, 0),
  };
}

// How many rolls are needed to reach tTarget if more copies of `extraRoll`
// are added after the existing ones. Returns NaN if it cannot be reached
// within `limit` rolls.
export function rollsToReach(product, rolls, tIn, tTarget, extraRoll, limit = 50) {
  let t = tIn;
  for (let n = 1; n <= limit; n++) {
    const roll = n <= rolls.length ? rolls[n - 1] : extraRoll;
    t = simulateRoll(product, roll, t).tOut;
    if (!Number.isFinite(t)) return NaN;
    if (t <= tTarget) return n;
  }
  return NaN;
}
