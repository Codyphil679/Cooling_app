// Typical room-temperature properties. Real products vary (grade, coating,
// temperature), so every value stays editable in the app.
// density kg/m³, cp J/(kg·K), conductivity W/(m·K)

export const MATERIALS = [
  { id: 'steel', name: 'Carbon steel', density: 7850, cp: 490, conductivity: 50 },
  { id: 'stainless', name: 'Stainless steel', density: 7900, cp: 500, conductivity: 16 },
  { id: 'aluminum', name: 'Aluminum', density: 2700, cp: 900, conductivity: 205 },
  { id: 'copper', name: 'Copper', density: 8960, cp: 385, conductivity: 400 },
  { id: 'pp', name: 'Polypropylene (PP)', density: 905, cp: 1920, conductivity: 0.2 },
  { id: 'ldpe', name: 'Polyethylene, LDPE', density: 920, cp: 2300, conductivity: 0.33 },
  { id: 'hdpe', name: 'Polyethylene, HDPE', density: 955, cp: 2250, conductivity: 0.48 },
  { id: 'pet', name: 'PET', density: 1380, cp: 1200, conductivity: 0.2 },
  { id: 'pvc', name: 'PVC, rigid', density: 1400, cp: 1000, conductivity: 0.17 },
  { id: 'ps', name: 'Polystyrene', density: 1050, cp: 1300, conductivity: 0.14 },
  { id: 'rubber', name: 'Rubber', density: 1150, cp: 2000, conductivity: 0.16 },
  { id: 'paper', name: 'Paper / board', density: 800, cp: 1340, conductivity: 0.1 },
  { id: 'glass', name: 'Glass', density: 2500, cp: 840, conductivity: 1.0 },
];
