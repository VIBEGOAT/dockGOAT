/**
 * Molecular graph and descriptor extraction.
 *
 * RDKit MinimalLib exposes most descriptors through `get_descriptors()`, but
 * not TPSA with sulfur and phosphorus contributions, which is the variant
 * SwissADME (and therefore the BOILED-Egg) uses. The Ertl surface-area table
 * below is a direct port of RDKit's `getTPSAAtomContribs`
 * (Code/GraphMol/Descriptors/MolSurf.cpp, BSD-3-Clause, Copyright (c) 2007-2025
 * Greg Landrum and other RDKit contributors).
 *
 * Ertl, P.; Rohde, B.; Selzer, P. "Fast Calculation of Molecular Polar Surface
 * Area as a Sum of Fragment-Based Contributions..." J. Med. Chem. 2000, 43,
 * 3714-3717.
 */
import { elementByZ } from '../chem/elements';
import type { RDMol } from '../chem/rdkit';

export interface RdkitDescriptors {
  exactmw: number;
  amw: number;
  lipinskiHBA: number;
  lipinskiHBD: number;
  NumRotatableBonds: number;
  NumHBD: number;
  NumHBA: number;
  NumHeavyAtoms: number;
  NumAtoms: number;
  NumHeteroatoms: number;
  FractionCSP3: number;
  NumRings: number;
  NumAromaticRings: number;
  NumAliphaticRings: number;
  NumSaturatedRings: number;
  NumHeterocycles: number;
  NumAromaticHeterocycles: number;
  NumSpiroAtoms: number;
  NumBridgeheadAtoms: number;
  NumAtomStereoCenters: number;
  NumUnspecifiedAtomStereoCenters: number;
  tpsa: number;
  CrippenClogP: number;
  CrippenMR: number;
  labuteASA: number;
  [key: string]: number;
}

export interface GraphAtom {
  z: number;
  charge: number;
  /** Implicit (and, for input with explicit H, attached) hydrogens. */
  hs: number;
  aromatic: boolean;
}

export interface GraphBond {
  a: number;
  b: number;
  /** Kekule bond order. */
  order: number;
  aromatic: boolean;
}

export interface MolGraph {
  atoms: GraphAtom[];
  bonds: GraphBond[];
  /** RDKit ring info, as atom-index lists. */
  rings: number[][];
}

interface RdJsonAtom {
  z?: number;
  impHs?: number;
  chg?: number;
}
interface RdJsonBond {
  bo?: number;
  atoms: [number, number];
}
interface RdJson {
  defaults: { atom: Required<RdJsonAtom>; bond: { bo: number } };
  molecules: {
    atoms: RdJsonAtom[];
    bonds?: RdJsonBond[];
    extensions?: { name: string; aromaticAtoms?: number[]; aromaticBonds?: number[]; atomRings?: number[][] }[];
  }[];
}

/** Read RDKit's JSON into a small graph with aromaticity, charges and ring info. */
export function molGraph(mol: RDMol): MolGraph {
  const json = JSON.parse(mol.get_json()) as RdJson;
  const def = json.defaults;
  const jm = json.molecules[0];
  const ext = jm.extensions?.find((e) => e.name === 'rdkitRepresentation');
  const aromaticAtoms = new Set(ext?.aromaticAtoms ?? []);
  const aromaticBonds = new Set(ext?.aromaticBonds ?? []);
  const atoms: GraphAtom[] = jm.atoms.map((a, i) => ({
    z: a.z ?? def.atom.z,
    charge: a.chg ?? def.atom.chg,
    hs: a.impHs ?? def.atom.impHs,
    aromatic: aromaticAtoms.has(i),
  }));
  const bonds: GraphBond[] = (jm.bonds ?? []).map((b, i) => ({
    a: b.atoms[0],
    b: b.atoms[1],
    order: b.bo ?? def.bond.bo,
    aromatic: aromaticBonds.has(i),
  }));
  return { atoms, bonds, rings: ext?.atomRings ?? [] };
}

/** Molecular formula in Hill order (C, H, then alphabetical). */
export function hillFormula(g: MolGraph): string {
  const counts = new Map<string, number>();
  const add = (sym: string, n: number) => counts.set(sym, (counts.get(sym) ?? 0) + n);
  for (const a of g.atoms) {
    add(elementByZ(a.z).symbol, 1);
    if (a.hs) add('H', a.hs);
  }
  const charge = g.atoms.reduce((s, a) => s + a.charge, 0);
  const parts: string[] = [];
  const emit = (sym: string) => {
    const n = counts.get(sym);
    if (!n) return;
    parts.push(n === 1 ? sym : `${sym}${n}`);
    counts.delete(sym);
  };
  if (counts.has('C')) {
    emit('C');
    emit('H');
  }
  for (const sym of [...counts.keys()].sort()) emit(sym);
  let formula = parts.join('');
  if (charge) formula += charge > 0 ? `+${charge > 1 ? charge : ''}` : `-${charge < -1 ? -charge : ''}`;
  return formula;
}

/** Per-atom bond tallies used by the Ertl TPSA table. */
interface BondTally {
  nbrs: number[];
  single: number[];
  double: number[];
  triple: number[];
  aromatic: number[];
  hs: number[];
}

function tally(g: MolGraph): BondTally {
  const n = g.atoms.length;
  const t: BondTally = {
    nbrs: new Array<number>(n).fill(0),
    single: new Array<number>(n).fill(0),
    double: new Array<number>(n).fill(0),
    triple: new Array<number>(n).fill(0),
    aromatic: new Array<number>(n).fill(0),
    hs: new Array<number>(n).fill(0),
  };
  for (const b of g.bonds) {
    const za = g.atoms[b.a].z;
    const zb = g.atoms[b.b].z;
    // Explicit hydrogens count as H, not as a heavy neighbour (RDKit does the
    // same by subtracting them again from the degree).
    if (za === 1) {
      t.nbrs[b.b] -= 1;
      t.hs[b.b] += 1;
    } else if (zb === 1) {
      t.nbrs[b.a] -= 1;
      t.hs[b.a] += 1;
    } else if (b.aromatic) {
      t.aromatic[b.a] += 1;
      t.aromatic[b.b] += 1;
    } else if (b.order === 1) {
      t.single[b.a] += 1;
      t.single[b.b] += 1;
    } else if (b.order === 2) {
      t.double[b.a] += 1;
      t.double[b.b] += 1;
    } else if (b.order === 3) {
      t.triple[b.a] += 1;
      t.triple[b.b] += 1;
    }
  }
  // Degree: every bond contributes, hydrogens were subtracted above.
  for (const b of g.bonds) {
    t.nbrs[b.a] += 1;
    t.nbrs[b.b] += 1;
  }
  for (let i = 0; i < n; i++) t.hs[i] += g.atoms[i].hs;
  return t;
}

function nitrogenContrib(nbrs: number, hs: number, chg: number, s: number, d: number, tr: number, ar: number, in3: boolean): number {
  if (nbrs === 1) {
    if (hs === 0 && chg === 0 && tr === 1) return 23.79;
    if (hs === 1 && chg === 0 && d === 1) return 23.85;
    if (hs === 2 && chg === 0 && s === 1) return 26.02;
    if (hs === 2 && chg === 1 && d === 1) return 25.59;
    if (hs === 3 && chg === 1 && s === 1) return 27.64;
  } else if (nbrs === 2) {
    if (hs === 0 && chg === 0 && s === 1 && d === 1) return 12.36;
    if (hs === 0 && chg === 0 && tr === 1 && d === 1) return 13.6;
    if (hs === 1 && chg === 0 && s === 2) return in3 ? 21.94 : 12.03;
    if (hs === 0 && chg === 1 && tr === 1 && s === 1) return 4.36;
    if (hs === 1 && chg === 1 && d === 1 && s === 1) return 13.97;
    if (hs === 2 && chg === 1 && s === 2) return 16.61;
    if (hs === 0 && chg === 0 && ar === 2) return 12.89;
    if (hs === 1 && chg === 0 && ar === 2) return 15.79;
    if (hs === 1 && chg === 1 && ar === 2) return 14.14;
  } else if (nbrs === 3) {
    if (hs === 0 && chg === 0 && s === 3) return in3 ? 3.01 : 3.24;
    if (hs === 0 && chg === 0 && s === 1 && d === 2) return 11.68;
    if (hs === 0 && chg === 1 && s === 2 && d === 1) return 3.01;
    if (hs === 1 && chg === 1 && s === 3) return 4.44;
    if (hs === 0 && chg === 0 && ar === 3) return 4.41;
    if (hs === 0 && chg === 0 && s === 1 && ar === 2) return 4.93;
    if (hs === 0 && chg === 0 && d === 1 && ar === 2) return 8.39;
    if (hs === 0 && chg === 1 && ar === 3) return 4.1;
    if (hs === 0 && chg === 1 && s === 1 && ar === 2) return 3.88;
  } else if (nbrs === 4) {
    if (hs === 0 && chg === 1 && s === 4) return 0;
  }
  return Math.max(0, 30.5 - nbrs * 8.2 + hs * 1.5);
}

function oxygenContrib(nbrs: number, hs: number, chg: number, s: number, d: number, ar: number, in3: boolean): number {
  if (nbrs === 1) {
    if (hs === 0 && chg === 0 && d === 1) return 17.07;
    if (hs === 1 && chg === 0 && s === 1) return 20.23;
    if (hs === 0 && chg === -1 && s === 1) return 23.06;
  } else if (nbrs === 2) {
    if (hs === 0 && chg === 0 && s === 2) return in3 ? 12.53 : 9.23;
    if (hs === 0 && chg === 0 && ar === 2) return 13.14;
  }
  return Math.max(0, 28.5 - nbrs * 8.6 + hs * 1.5);
}

function phosphorusContrib(nbrs: number, hs: number, chg: number, s: number, d: number): number {
  if (chg !== 0) return 0;
  if (nbrs === 2 && hs === 0 && s === 1 && d === 1) return 34.14;
  if (nbrs === 3 && hs === 0 && s === 3) return 13.59;
  if (nbrs === 3 && hs === 1 && s === 2 && d === 1) return 23.47;
  if (nbrs === 4 && hs === 0 && s === 3 && d === 1) return 9.81;
  return 0;
}

function sulfurContrib(nbrs: number, hs: number, chg: number, s: number, d: number, ar: number): number {
  if (chg !== 0) return 0;
  if (nbrs === 1 && hs === 0 && d === 1) return 32.09;
  if (nbrs === 1 && hs === 1 && s === 1) return 38.8;
  if (nbrs === 2 && hs === 0 && s === 2) return 25.3;
  if (nbrs === 2 && hs === 0 && ar === 2) return 28.24;
  if (nbrs === 3 && hs === 0 && ar === 2 && d === 1) return 21.7;
  if (nbrs === 3 && hs === 0 && s === 2 && d === 1) return 19.21;
  if (nbrs === 4 && hs === 0 && s === 2 && d === 2) return 8.38;
  return 0;
}

/**
 * Aromaticity model used for the TPSA fragment lookup.
 *
 * `ertl` follows Ertl's original paper and the Daylight-style perception behind
 * the TPSA values published by PubChem and SwissADME: a ring carrying an
 * exocyclic double bond to a chalcogen (pyridinone, uracil, coumarin, the
 * pyrimidinedione of caffeine) is *not* aromatic, so its nitrogens score as
 * plain amine/amide fragments. `rdkit` keeps RDKit's richer default model,
 * which is what `Descriptors.TPSA` and therefore QED use.
 *
 * The two differ by 3.38 A^2 for caffeine (58.44 vs 61.82); `ertl` reproduces
 * PubChem for caffeine, theophylline, uracil, coumarin and 2-pyridone.
 */
export type TpsaModel = 'ertl' | 'rdkit';

/**
 * Demote rings that RDKit calls aromatic but the Daylight/Ertl model does not,
 * i.e. those with an exocyclic C=O (or C=S) on a ring atom. Bonds keep their
 * Kekule order, so the fragment lookup sees ordinary single/double bonds.
 */
function demoteExocyclicCarbonylRings(g: MolGraph): MolGraph {
  const bondsAt = new Map<string, number>();
  g.bonds.forEach((b, i) => {
    bondsAt.set(`${Math.min(b.a, b.b)},${Math.max(b.a, b.b)}`, i);
  });
  const bondIndex = (a: number, b: number) => bondsAt.get(`${Math.min(a, b)},${Math.max(a, b)}`);

  const demoted = new Set<number>();
  for (const ring of g.rings) {
    const members = new Set(ring);
    const ringBonds: number[] = [];
    let aromatic = true;
    for (let k = 0; k < ring.length; k++) {
      const bi = bondIndex(ring[k], ring[(k + 1) % ring.length]);
      if (bi === undefined || !g.bonds[bi].aromatic) {
        aromatic = false;
        break;
      }
      ringBonds.push(bi);
    }
    if (!aromatic) continue;
    const hasExocyclicCarbonyl = g.bonds.some((b) => {
      if (b.order !== 2 || b.aromatic) return false;
      const inRingA = members.has(b.a);
      const inRingB = members.has(b.b);
      if (inRingA === inRingB) return false;
      const outer = g.atoms[inRingA ? b.b : b.a];
      return outer.z === 8 || outer.z === 16;
    });
    if (hasExocyclicCarbonyl) for (const bi of ringBonds) demoted.add(bi);
  }
  if (!demoted.size) return g;

  const bonds = g.bonds.map((b, i) => (demoted.has(i) ? { ...b, aromatic: false } : b));
  const stillAromatic = new Set<number>();
  for (const b of bonds)
    if (b.aromatic) {
      stillAromatic.add(b.a);
      stillAromatic.add(b.b);
    }
  const atoms = g.atoms.map((a, i) => (a.aromatic && !stillAromatic.has(i) ? { ...a, aromatic: false } : a));
  return { atoms, bonds, rings: g.rings };
}

/**
 * Topological polar surface area (Ertl 2000). With `includeSandP` the S and P
 * fragments are summed too, which is what SwissADME reports and what the
 * BOILED-Egg was parameterised on.
 */
export function tpsa(g: MolGraph, includeSandP: boolean, model: TpsaModel = 'ertl'): number {
  const graph = model === 'ertl' ? demoteExocyclicCarbonylRings(g) : g;
  const t = tally(graph);
  const in3 = new Set<number>();
  for (const r of graph.rings) if (r.length === 3) for (const i of r) in3.add(i);
  let total = 0;
  for (let i = 0; i < graph.atoms.length; i++) {
    const a = graph.atoms[i];
    if (a.z !== 7 && a.z !== 8 && (!includeSandP || (a.z !== 15 && a.z !== 16))) continue;
    const [nbrs, hs, chg] = [t.nbrs[i], t.hs[i], a.charge];
    const [s, d, tr, ar] = [t.single[i], t.double[i], t.triple[i], t.aromatic[i]];
    if (a.z === 7) total += nitrogenContrib(nbrs, hs, chg, s, d, tr, ar, in3.has(i));
    else if (a.z === 8) total += oxygenContrib(nbrs, hs, chg, s, d, ar, in3.has(i));
    else if (a.z === 15) total += phosphorusContrib(nbrs, hs, chg, s, d);
    else if (a.z === 16) total += sulfurContrib(nbrs, hs, chg, s, d, ar);
  }
  return total;
}

/** Number of aromatic heavy atoms (the `AP` term of the ESOL regression). */
export function aromaticHeavyAtoms(g: MolGraph): number {
  return g.atoms.filter((a) => a.aromatic && a.z !== 1).length;
}

/** Sum of formal charges. */
export function formalCharge(g: MolGraph): number {
  return g.atoms.reduce((s, a) => s + a.charge, 0);
}

/**
 * Smallest-set-of-smallest-rings count of the subgraph left after removing
 * `removed`. Equal to the circuit rank E - V + C, which is what RDKit's
 * `GetSSSR` returns; used by the QED aromatic-ring term.
 */
export function sssrCountWithout(g: MolGraph, removed: ReadonlySet<number>): number {
  const keep: number[] = [];
  const index = new Map<number, number>();
  for (let i = 0; i < g.atoms.length; i++) {
    if (!removed.has(i)) {
      index.set(i, keep.length);
      keep.push(i);
    }
  }
  const parent = keep.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  let edges = 0;
  for (const b of g.bonds) {
    const ia = index.get(b.a);
    const ib = index.get(b.b);
    if (ia === undefined || ib === undefined) continue;
    edges++;
    const ra = find(ia);
    const rb = find(ib);
    if (ra !== rb) parent[ra] = rb;
  }
  const components = new Set(keep.map((_, i) => find(i))).size;
  return edges - keep.length + components;
}

/** Round for display without dragging float noise into the profile. */
export function round(x: number, digits: number): number {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
