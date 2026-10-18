// Display units. The app stores everything in SI and converts at the edges.
// Each entry is [label, SI value of one display unit].

const SYSTEMS = {
  metric: {
    thickness: ['mm', 1e-3],
    width: ['mm', 1e-3],
    diameter: ['mm', 1e-3],
    speed: ['m/min', 1 / 60],
    density: ['kg/m³', 1],
    cp: ['J/kg·K', 1],
    conductivity: ['W/m·K', 1],
    htc: ['W/m²·K', 1],
    waterFlow: ['L/min', 1e-3 / 60],
    massRate: ['kg/h', 1 / 3600],
    tempDiff: ['°C', 1],
    temp: ['°C'],
    angle: ['°', 1],
    time: ['s', 1],
    length: ['m', 1],
  },
  imperial: {
    thickness: ['in', 0.0254],
    width: ['in', 0.0254],
    diameter: ['in', 0.0254],
    speed: ['ft/min', 0.3048 / 60],
    density: ['lb/ft³', 16.018463],
    cp: ['BTU/lb·°F', 4186.8],
    conductivity: ['BTU/h·ft·°F', 1.730735],
    htc: ['BTU/h·ft²·°F', 5.678263],
    waterFlow: ['US gpm', 3.785411784e-3 / 60],
    massRate: ['lb/h', 0.45359237 / 3600],
    tempDiff: ['°F', 5 / 9],
    temp: ['°F'],
    angle: ['°', 1],
    time: ['s', 1],
    length: ['ft', 0.3048],
  },
};

export function unitLabel(type, system) {
  return SYSTEMS[system][type][0];
}

export function toSI(type, value, system) {
  if (type === 'temp') return system === 'imperial' ? ((value - 32) * 5) / 9 : value;
  return value * SYSTEMS[system][type][1];
}

export function fromSI(type, value, system) {
  if (type === 'temp') return system === 'imperial' ? (value * 9) / 5 + 32 : value;
  return value / SYSTEMS[system][type][1];
}
