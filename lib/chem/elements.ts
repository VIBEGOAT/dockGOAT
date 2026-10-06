/**
 * Periodic-table data used across the chemistry toolkit.
 *
 * Covalent radii: Pyykkö & Atsumi single-bond radii (Å).
 * Van der Waals radii: Bondi (Å), with Alvarez values for metals.
 * Colours: Jmol CPK scheme.
 */

export interface ElementData {
  symbol: string;
  z: number;
  mass: number;
  covalent: number;
  vdw: number;
  color: string;
}

const TABLE: [string, number, number, number, number, string][] = [
  // symbol, Z, mass, covalent, vdw, colour
  ['H', 1, 1.008, 0.32, 1.1, '#FFFFFF'],
  ['He', 2, 4.0026, 0.46, 1.4, '#D9FFFF'],
  ['Li', 3, 6.94, 1.33, 1.82, '#CC80FF'],
  ['B', 5, 10.81, 0.85, 1.92, '#FFB5B5'],
  ['C', 6, 12.011, 0.75, 1.7, '#909090'],
  ['N', 7, 14.007, 0.71, 1.55, '#3050F8'],
  ['O', 8, 15.999, 0.63, 1.52, '#FF0D0D'],
  ['F', 9, 18.998, 0.64, 1.47, '#90E050'],
  ['Na', 11, 22.99, 1.55, 2.27, '#AB5CF2'],
  ['Mg', 12, 24.305, 1.39, 1.73, '#8AFF00'],
  ['Al', 13, 26.982, 1.26, 1.84, '#BFA6A6'],
  ['Si', 14, 28.085, 1.16, 2.1, '#F0C8A0'],
  ['P', 15, 30.974, 1.11, 1.8, '#FF8000'],
  ['S', 16, 32.06, 1.03, 1.8, '#FFFF30'],
  ['Cl', 17, 35.45, 0.99, 1.75, '#1FF01F'],
  ['K', 19, 39.098, 1.96, 2.75, '#8F40D4'],
  ['Ca', 20, 40.078, 1.71, 2.31, '#3DFF00'],
  ['Mn', 25, 54.938, 1.19, 2.0, '#9C7AC7'],
  ['Fe', 26, 55.845, 1.16, 2.0, '#E06633'],
  ['Co', 27, 58.933, 1.11, 2.0, '#F090A0'],
  ['Ni', 28, 58.693, 1.1, 1.63, '#50D050'],
  ['Cu', 29, 63.546, 1.12, 1.4, '#C88033'],
  ['Zn', 30, 65.38, 1.18, 1.39, '#7D80B0'],
  ['As', 33, 74.922, 1.21, 1.85, '#BD80E3'],
  ['Se', 34, 78.971, 1.16, 1.9, '#FFA100'],
  ['Br', 35, 79.904, 1.14, 1.85, '#A62929'],
  ['Cd', 48, 112.41, 1.36, 1.58, '#FFD98F'],
  ['Sn', 50, 118.71, 1.4, 2.17, '#668080'],
  ['I', 53, 126.9, 1.33, 1.98, '#940094'],
  ['Pt', 78, 195.08, 1.23, 1.75, '#D0D0E0'],
  ['Hg', 80, 200.59, 1.33, 1.55, '#B8B8D0'],
];

export const ELEMENTS: Record<string, ElementData> = Object.fromEntries(
  TABLE.map(([symbol, z, mass, covalent, vdw, color]) => [
    symbol,
    { symbol, z, mass, covalent, vdw, color },
  ]),
);

const BY_Z: Record<number, ElementData> = Object.fromEntries(
  Object.values(ELEMENTS).map((e) => [e.z, e]),
);

const FALLBACK: ElementData = { symbol: 'X', z: 0, mass: 0, covalent: 1.0, vdw: 2.0, color: '#FF1493' };

/** Normalise an element symbol: 'CL' → 'Cl', ' c' → 'C'. */
export function normalizeSymbol(raw: string): string {
  const s = raw.trim();
  if (!s) return 'X';
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

export function element(symbol: string): ElementData {
  return ELEMENTS[normalizeSymbol(symbol)] ?? FALLBACK;
}

export function elementByZ(z: number): ElementData {
  return BY_Z[z] ?? FALLBACK;
}

export const METALS = new Set([
  'Li', 'Na', 'K', 'Mg', 'Ca', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Cd', 'Hg', 'Pt', 'Al', 'Sn',
]);

export const HALOGENS = new Set(['F', 'Cl', 'Br', 'I']);
