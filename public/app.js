import {
  massFlowSheet, heatLoad, waterFlowFor, waterHeat, simulateRoll, simulateZone,
  rollsToReach, calibrateHtc, arealHeatCapacity, biotNumber, toBtuPerHour, toTonsRefrigeration,
} from './calc.js';
import { toSI, fromSI, unitLabel } from './units.js';
import { MATERIALS } from './materials.js';

const VERSION = '1.0.0';
const STORAGE_KEY = 'coolingCalc.v1';

const DEFAULT_ROLL = { diameter: 0.6, wrap: 180, surfaceTemp: 20, htc: 300, waterFlow: 60e-3 / 60 };

const DEFAULTS = {
  units: 'metric',
  tab: 'product',
  product: {
    material: 'pp', density: 905, cp: 1920, conductivity: 0.2,
    thickness: 0.0005, width: 1.0, speed: 20 / 60,
    tIn: 180, tTarget: 40, waterRise: 5,
  },
  roll: {
    waterFlow: 60e-3 / 60, waterIn: 15, waterOut: 18,
    tIn: 180, diameter: 0.6, wrap: 180, surfaceTemp: 20, htc: 300, tMeasured: 70,
  },
  zone: {
    tIn: 180, tTarget: 40,
    rolls: [{ ...DEFAULT_ROLL }, { ...DEFAULT_ROLL }, { ...DEFAULT_ROLL }],
  },
};

// [state path, label, unit type]
const FIELDS = {
  product: [
    ['product.thickness', 'Thickness', 'thickness'],
    ['product.width', 'Width', 'width'],
    ['product.speed', 'Line speed', 'speed'],
  ],
  material: [
    ['product.density', 'Density', 'density'],
    ['product.cp', 'Specific heat', 'cp'],
    ['product.conductivity', 'Thermal conductivity', 'conductivity'],
  ],
  'product-temps': [
    ['product.tIn', 'Temp entering section', 'temp'],
    ['product.tTarget', 'Target exit temp', 'temp'],
  ],
  'water-rise': [['product.waterRise', 'Allowed water temp rise', 'tempDiff']],
  water: [
    ['roll.waterFlow', 'Water flow', 'waterFlow'],
    ['roll.waterIn', 'Water temp in', 'temp'],
    ['roll.waterOut', 'Water temp out', 'temp'],
  ],
  roll: [
    ['roll.tIn', 'Product temp in', 'temp'],
    ['roll.surfaceTemp', 'Roll surface temp', 'temp'],
    ['roll.diameter', 'Roll diameter', 'diameter'],
    ['roll.wrap', 'Wrap angle', 'angle'],
    ['roll.htc', 'Heat transfer coeff. U', 'htc'],
  ],
  calib: [['roll.tMeasured', 'Measured product temp out', 'temp']],
  zone: [
    ['zone.tIn', 'Temp entering zone', 'temp'],
    ['zone.tTarget', 'Target exit temp', 'temp'],
  ],
};

const ZONE_ROLL_FIELDS = [
  ['surfaceTemp', 'Roll surface temp', 'temp'],
  ['diameter', 'Diameter', 'diameter'],
  ['wrap', 'Wrap angle', 'angle'],
  ['htc', 'U', 'htc'],
  ['waterFlow', 'Water flow', 'waterFlow'],
];

let state = load();
let lastCalibrated = NaN;

// ---------- state ----------

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      return {
        ...structuredClone(DEFAULTS),
        ...saved,
        product: { ...DEFAULTS.product, ...saved.product },
        roll: { ...DEFAULTS.roll, ...saved.roll },
        zone: { ...structuredClone(DEFAULTS.zone), ...saved.zone },
      };
    }
  } catch { /* storage blocked or corrupt: fall back to defaults */ }
  return structuredClone(DEFAULTS);
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* not persisted */ }
}

function getPath(path) {
  return path.split('.').reduce((obj, k) => obj?.[k], state);
}

function setPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((obj, k) => obj[k], state)[last] = value;
}

// JSON turns NaN into null, so treat both as "no value".
const num = (v) => (typeof v === 'number' ? v : NaN);

// ---------- formatting ----------

function fmt(v, digits) {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const d = digits ?? (abs >= 100 ? 0 : abs >= 10 ? 1 : abs >= 1 ? 2 : 3);
  return v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

function fmtUnit(type, si, digits) {
  const v = fromSI(type, si, state.units);
  return Number.isFinite(v) ? `${fmt(v, digits)} ${unitLabel(type, state.units)}` : '—';
}

const fmtTemp = (si) => fmtUnit('temp', si, 1);

function fmtPower(watts) {
  if (!Number.isFinite(watts)) return { main: '—', alt: '' };
  const kw = `${fmt(watts / 1000)} kW`;
  const btu = `${fmt(toBtuPerHour(watts), 0)} BTU/h`;
  const tr = `${fmt(toTonsRefrigeration(watts))} TR`;
  return state.units === 'imperial'
    ? { main: btu, alt: `${kw} · ${tr}` }
    : { main: kw, alt: `${btu} · ${tr}` };
}

// Inputs show up to 4 significant figures so unit switches stay readable.
function inputValue(type, si) {
  const v = fromSI(type, num(si), state.units);
  return Number.isFinite(v) ? String(Number(v.toPrecision(4))) : '';
}

// ---------- building the form ----------

function fieldHtml(key, label, type) {
  return `<label class="field">
    <span class="lbl">${label}</span>
    <span class="inp">
      <input type="number" inputmode="decimal" step="any" data-key="${key}" data-unit="${type}">
      <span class="unit" data-unit-label="${type}"></span>
    </span>
  </label>`;
}

function buildStaticFields() {
  for (const [group, fields] of Object.entries(FIELDS)) {
    document.querySelector(`[data-fields="${group}"]`).innerHTML =
      fields.map((f) => fieldHtml(...f)).join('');
  }
  const select = document.getElementById('material');
  select.innerHTML = MATERIALS.map((m) => `<option value="${m.id}">${m.name}</option>`).join('')
    + '<option value="custom">Custom</option>';
}

function buildZoneRolls() {
  document.getElementById('zone-rolls').innerHTML = state.zone.rolls.map((_, i) => `
    <div class="card roll-card">
      <div class="card-head">
        <h2>Roll ${i + 1}</h2>
        <div class="row-actions">
          <button type="button" class="btn small" data-action="copy-roll" data-index="${i}">Copy</button>
          <button type="button" class="btn small" data-action="remove-roll" data-index="${i}"
            ${state.zone.rolls.length === 1 ? 'disabled' : ''}>Remove</button>
        </div>
      </div>
      <div class="grid">
        ${ZONE_ROLL_FIELDS.map(([k, label, type]) => fieldHtml(`zone.rolls.${i}.${k}`, label, type)).join('')}
      </div>
    </div>`).join('');
  fillInputs(document.getElementById('zone-rolls'));
}

function fillInputs(root = document) {
  root.querySelectorAll('input[data-key]').forEach((el) => {
    el.value = inputValue(el.dataset.unit, getPath(el.dataset.key));
  });
  root.querySelectorAll('[data-unit-label]').forEach((el) => {
    el.textContent = unitLabel(el.dataset.unitLabel, state.units);
  });
  document.getElementById('material').value = state.product.material;
}

// ---------- calculating and showing results ----------

function out(name, text) {
  document.querySelectorAll(`[data-out="${name}"]`).forEach((el) => { el.textContent = text; });
}

function warn(name, text) {
  document.querySelectorAll(`[data-out="${name}"]`).forEach((el) => {
    el.textContent = text;
    el.hidden = !text;
  });
}

function productSI() {
  const p = state.product;
  return {
    density: num(p.density), cp: num(p.cp), conductivity: num(p.conductivity),
    thickness: num(p.thickness), width: num(p.width), speed: num(p.speed),
  };
}

function rollSI(r) {
  return {
    diameter: num(r.diameter), wrap: num(r.wrap), surfaceTemp: num(r.surfaceTemp),
    htc: num(r.htc), waterFlow: num(r.waterFlow),
  };
}

function biotWarning(product, htc) {
  const bi = biotNumber({ htc, thickness: product.thickness, conductivity: product.conductivity });
  return bi > 0.5
    ? 'This product is thick or slow to conduct heat, so its inside cools slower than its surface. '
      + 'The prediction may be optimistic. Calibrate U with a measured temperature.'
    : '';
}

function render() {
  const product = productSI();
  const p = state.product;
  const massFlow = massFlowSheet(product);

  // Product tab
  const load = heatLoad({ massFlow, cp: product.cp, tIn: num(p.tIn), tOut: num(p.tTarget) });
  const loadText = fmtPower(load);
  out('product.load', loadText.main);
  out('product.loadAlt', loadText.alt);
  out('product.massRate', fmtUnit('massRate', massFlow));
  out('product.waterFlow', fmtUnit('waterFlow', waterFlowFor(load, num(p.waterRise))));

  const materialName = MATERIALS.find((m) => m.id === p.material)?.name ?? 'Custom material';
  out('usingProduct', `${materialName}: ${fmtUnit('thickness', product.thickness)} × `
    + `${fmtUnit('width', product.width)} at ${fmtUnit('speed', product.speed)}. Change it in the Product tab.`);

  // Single roll tab
  const r = state.roll;
  const wHeat = waterHeat({ flow: num(r.waterFlow), tIn: num(r.waterIn), tOut: num(r.waterOut) });
  const wText = fmtPower(wHeat);
  out('roll.waterHeat', wText.main);
  out('roll.waterHeatAlt', wText.alt);
  out('roll.waterShare', load > 0 && Number.isFinite(wHeat)
    ? `${fmt((wHeat / load) * 100, 0)}% of the cooling required in the Product tab` : '');

  const roll = rollSI(r);
  const sim = simulateRoll(product, roll, num(r.tIn));
  out('roll.tOut', fmtTemp(sim.tOut));
  out('roll.heat', fmtPower(sim.heat).main);
  out('roll.time', Number.isFinite(sim.time) ? `${fmt(sim.time)} s` : '—');
  out('roll.effectiveness', Number.isFinite(sim.effectiveness) ? `${fmt(sim.effectiveness * 100, 0)}%` : '—');
  out('roll.waterRise', fmtUnit('tempDiff', sim.waterRise, 1));
  warn('roll.warning', biotWarning(product, roll.htc));

  const calibrated = calibrateHtc({
    tIn: num(r.tIn), tOut: num(r.tMeasured), tRoll: roll.surfaceTemp,
    time: sim.time, areal: arealHeatCapacity(product),
  });
  out('roll.calibratedHtc', Number.isFinite(calibrated)
    ? fmtUnit('htc', calibrated, 0)
    : 'Measured temp must be between the roll temp and the temp in');
  document.querySelectorAll('[data-action^="use-u"]').forEach((b) => { b.disabled = !Number.isFinite(calibrated); });
  lastCalibrated = calibrated;

  renderZone(product, massFlow);
}

function renderZone(product, massFlow) {
  const z = state.zone;
  const rolls = z.rolls.map(rollSI);
  const tIn = num(z.tIn);
  const tTarget = num(z.tTarget);
  const result = simulateZone(product, rolls, tIn);
  const required = heatLoad({ massFlow, cp: product.cp, tIn, tOut: tTarget });

  out('zone.tOut', `Exit temp ${fmtTemp(result.tOut)}`);
  out('zone.totalHeat', fmtPower(result.totalHeat).main);
  out('zone.required', fmtPower(required).main);

  const status = document.querySelector('[data-out="zone.status"]');
  status.className = 'status';
  if (Number.isFinite(result.tOut) && Number.isFinite(tTarget)) {
    const gap = result.tOut - tTarget;
    if (gap <= 0) {
      status.textContent = `Meets target with ${fmtUnit('tempDiff', -gap, 1)} to spare`;
      status.classList.add('ok');
    } else {
      status.textContent = `Short of target by ${fmtUnit('tempDiff', gap, 1)}. `
        + `About ${fmtPower(required - result.totalHeat).main} more cooling is needed.`;
      status.classList.add('bad');
    }
  } else {
    status.textContent = '';
  }

  const needed = rollsToReach(product, rolls, tIn, tTarget, rolls[rolls.length - 1]);
  out('zone.rollsNeeded', Number.isFinite(needed)
    ? `${needed}${needed > rolls.length ? ' (adding copies of the last roll)' : ''}`
    : 'Not reachable with these rolls');

  document.getElementById('zone-table').innerHTML = result.rolls.map((r, i) => {
    const share = result.totalHeat > 0 ? (r.heat / result.totalHeat) * 100 : NaN;
    return `<tr>
      <td>${i + 1}</td>
      <td>${fmtTemp(r.tOut)}</td>
      <td>${fmt(r.heat / 1000)} kW</td>
      <td>${Number.isFinite(share) ? `${fmt(share, 0)}%` : '—'}</td>
      <td>${Number.isFinite(r.effectiveness) ? `${fmt(r.effectiveness * 100, 0)}%` : '—'}</td>
    </tr>`;
  }).join('');

  const maxHtc = Math.max(...rolls.map((r) => r.htc).filter(Number.isFinite));
  warn('zone.warning', biotWarning(product, maxHtc));
}

// ---------- events ----------

document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.matches('input[data-key]')) return;
  const value = el.value === '' ? NaN : parseFloat(el.value);
  setPath(el.dataset.key, toSI(el.dataset.unit, value, state.units));
  if (/^product\.(density|cp|conductivity)$/.test(el.dataset.key)) {
    state.product.material = 'custom';
    document.getElementById('material').value = 'custom';
  }
  save();
  render();
});

document.getElementById('material').addEventListener('change', (e) => {
  const m = MATERIALS.find((x) => x.id === e.target.value);
  state.product.material = e.target.value;
  if (m) Object.assign(state.product, { density: m.density, cp: m.cp, conductivity: m.conductivity });
  save();
  fillInputs();
  render();
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  if (btn.dataset.units) {
    state.units = btn.dataset.units;
    save();
    fillInputs();
    syncChrome();
    render();
    return;
  }
  if (btn.dataset.tab) {
    state.tab = btn.dataset.tab;
    save();
    syncChrome();
    window.scrollTo(0, 0);
    return;
  }

  const i = Number(btn.dataset.index);
  switch (btn.dataset.action) {
    case 'add-roll': {
      const last = state.zone.rolls[state.zone.rolls.length - 1] ?? DEFAULT_ROLL;
      state.zone.rolls.push({ ...last });
      break;
    }
    case 'copy-roll':
      state.zone.rolls.splice(i + 1, 0, { ...state.zone.rolls[i] });
      break;
    case 'remove-roll':
      if (state.zone.rolls.length > 1) state.zone.rolls.splice(i, 1);
      break;
    case 'use-u-roll':
      state.roll.htc = lastCalibrated;
      break;
    case 'use-u-zone':
      state.zone.rolls.forEach((r) => { r.htc = lastCalibrated; });
      break;
    case 'reset':
      if (!confirm('Reset all inputs to the defaults?')) return;
      state = { ...structuredClone(DEFAULTS), units: state.units, tab: state.tab };
      break;
    default:
      return;
  }
  save();
  buildZoneRolls();
  fillInputs();
  render();
});

function syncChrome() {
  document.querySelectorAll('[data-units]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.units === state.units));
  });
  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.setAttribute('aria-current', b.dataset.tab === state.tab ? 'page' : 'false');
  });
  document.querySelectorAll('.tab').forEach((s) => { s.hidden = s.id !== `tab-${state.tab}`; });
}

// ---------- install / offline ----------

let installPrompt = null;
const installBtn = document.getElementById('install-btn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installBtn.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* app still works online */ });
  });
}

// ---------- start ----------

document.getElementById('version').textContent = `Version ${VERSION}`;
buildStaticFields();
buildZoneRolls();
fillInputs();
syncChrome();
render();
