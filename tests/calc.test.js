import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  massFlowSheet, heatLoad, waterFlowFor, waterHeat, waterTempRise, contactTime,
  rollExitTemp, calibrateHtc, arealHeatCapacity, simulateRoll, simulateZone, rollsToReach,
  toBtuPerHour, toTonsRefrigeration,
} from '../public/calc.js';
import { toSI, fromSI } from '../public/units.js';

const close = (actual, expected, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol * Math.max(1, Math.abs(expected)),
    `expected ${expected}, got ${actual}`);

const pp = { density: 905, cp: 1920, conductivity: 0.2, thickness: 0.0005, width: 1, speed: 20 / 60 };
const roll = { diameter: 0.6, wrap: 180, surfaceTemp: 20, htc: 300, waterFlow: 0.001 };

test('steel strip cooling load matches a hand calculation', () => {
  // 1 mm x 1.2 m at 100 m/min, 200 -> 50 °C
  const m = massFlowSheet({ density: 7850, thickness: 0.001, width: 1.2, speed: 100 / 60 });
  close(m, 15.7);
  close(heatLoad({ massFlow: m, cp: 490, tIn: 200, tOut: 50 }), 15.7 * 490 * 150);
});

test('water side heat and flow are inverses', () => {
  const q = waterHeat({ flow: 0.001, tIn: 15, tOut: 18 });
  close(q, 0.001 * 998 * 4182 * 3);
  close(waterFlowFor(q, 3), 0.001);
  close(waterTempRise(q, 0.001), 3);
  assert.ok(Number.isNaN(waterFlowFor(q, 0)));
});

test('contact time is wrapped arc length over speed', () => {
  close(contactTime(0.6, 180, 1), Math.PI * 0.3);
  assert.ok(Number.isNaN(contactTime(0.6, 180, 0)));
});

test('exit temperature approaches roll temperature and calibration inverts it', () => {
  const areal = arealHeatCapacity(pp);
  const time = contactTime(roll.diameter, roll.wrap, pp.speed);
  const tOut = rollExitTemp({ tIn: 180, tRoll: 20, htc: 300, time, areal });
  assert.ok(tOut > 20 && tOut < 180);
  close(calibrateHtc({ tIn: 180, tOut, tRoll: 20, time, areal }), 300);
  assert.ok(Number.isNaN(calibrateHtc({ tIn: 180, tOut: 10, tRoll: 20, time, areal })));
  assert.ok(Number.isNaN(calibrateHtc({ tIn: 180, tOut: 190, tRoll: 20, time, areal })));
});

test('roll heat equals product heat lost', () => {
  const r = simulateRoll(pp, roll, 180);
  close(r.heat, massFlowSheet(pp) * pp.cp * (180 - r.tOut));
  close(r.effectiveness, (180 - r.tOut) / 160);
  close(r.waterRise, waterTempRise(r.heat, roll.waterFlow));
});

test('zone chains rolls and totals heat', () => {
  const z = simulateZone(pp, [roll, roll, roll], 180);
  assert.equal(z.rolls.length, 3);
  close(z.rolls[1].tIn, z.rolls[0].tOut);
  close(z.tOut, z.rolls[2].tOut);
  close(z.totalHeat, massFlowSheet(pp) * pp.cp * (180 - z.tOut));
});

test('rollsToReach counts rolls and gives up when the target is below roll temp', () => {
  const n = rollsToReach(pp, [roll], 180, 40, roll);
  assert.ok(n >= 1);
  assert.ok(simulateZone(pp, Array(n).fill(roll), 180).tOut <= 40);
  assert.ok(simulateZone(pp, Array(n - 1).fill(roll), 180).tOut > 40);
  assert.ok(Number.isNaN(rollsToReach(pp, [roll], 180, 15, roll)));
});

test('power conversions', () => {
  close(toBtuPerHour(1000), 3412.14, 1e-5);
  close(toTonsRefrigeration(3516.853), 1);
});

test('unit conversions round-trip', () => {
  close(toSI('temp', 212, 'imperial'), 100);
  close(fromSI('temp', 0, 'imperial'), 32);
  close(toSI('tempDiff', 9, 'imperial'), 5);
  close(toSI('speed', 60, 'metric'), 1);
  close(toSI('waterFlow', 1, 'imperial') * 60 * 1000, 3.785411784);
  for (const type of ['thickness', 'speed', 'density', 'cp', 'htc', 'waterFlow', 'massRate']) {
    close(fromSI(type, toSI(type, 12.34, 'imperial'), 'imperial'), 12.34);
  }
});
