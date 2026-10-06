/**
 * Pure-TypeScript 3D conformer builder.
 *
 * AutoDock Vina only moves a ligand rigidly and about its rotatable bonds — it
 * never changes bond lengths, bond angles or ring shapes — so the starting 3D
 * geometry has to be right. RDKit MinimalLib has no 3D embedding, hence this
 * module.
 *
 * Method: the 2D depiction already encodes ring topology, E/Z geometry and
 * (through wedges) tetrahedral stereo, so it is the starting point. Heavy atoms
 * are lifted out of the plane (wedged neighbours up/down, a chair-like
 * alternation for saturated rings, seeded noise) and relaxed with a small force
 * field with analytical gradients (L-BFGS): bond stretch, angle bend, sp2
 * planarity, torsions, soft repulsion and flat-bottomed chirality / E-Z
 * restraints. Hydrogens are then placed geometrically and everything is relaxed
 * together. Several seeded starts are tried and the lowest-energy one that
 * keeps every stereo element wins.
 */
import { element } from './elements';
import type { Vec3 } from './geometry';
import { cloneMolecule, ringBondFlags, type Molecule } from './molecule';

const DEG = Math.PI / 180;
const TETRAHEDRAL = 109.4712;

// ---------------------------------------------------------------------------
// Atom typing

/** Coordination geometry: 1 linear, 2 trigonal planar, 3 tetrahedral, 0 hypervalent (no angle model). */
export type Geometry = 0 | 1 | 2 | 3;

export interface AtomTyping {
  nbrs: number[][];
  /** Coordination number including hydrogens (explicit plus any `extraH`). */
  degree: number[];
  geom: Geometry[];
  /** N/O/S lone-pair atom conjugated with an adjacent π system (amide N, ester O, phenol O…). */
  conj: boolean[];
  /** Atom carries a non-aromatic double bond to N, O or S (C=O, C=N, C=S…). */
  carbonyl: boolean[];
  aromatic: boolean[];
}

const PERIOD3 = new Set(['P', 'S', 'As', 'Se', 'Te']);
const HETERO = new Set(['N', 'O', 'S']);

/**
 * Hybridisation-like geometry per atom from bond orders, aromatic flags and
 * coordination. `extraH` adds hydrogens that are not in the graph yet (used
 * when placing implicit hydrogens).
 */
export function perceiveTyping(mol: Molecule, extraH?: number[]): AtomTyping {
  const n = mol.atoms.length;
  const nbrs: number[][] = mol.atoms.map(() => []);
  const dbl = new Array<number>(n).fill(0);
  const tpl = new Array<number>(n).fill(0);
  const aromatic = mol.atoms.map((a) => a.aromatic);
  const carbonyl = new Array<boolean>(n).fill(false);
  for (const b of mol.bonds) {
    nbrs[b.a].push(b.b);
    nbrs[b.b].push(b.a);
    if (b.aromatic) {
      aromatic[b.a] = true;
      aromatic[b.b] = true;
    } else if (b.order === 2) {
      dbl[b.a]++;
      dbl[b.b]++;
      if (HETERO.has(mol.atoms[b.b].el)) carbonyl[b.a] = true;
      if (HETERO.has(mol.atoms[b.a].el)) carbonyl[b.b] = true;
    } else if (b.order === 3) {
      tpl[b.a]++;
      tpl[b.b]++;
    }
  }
  const degree = nbrs.map((l, i) => l.length + (extraH?.[i] ?? 0));
  const geom: Geometry[] = mol.atoms.map((atom, i) => {
    const d = degree[i];
    if (atom.el === 'H') return 3;
    if (d >= 5) return 0;
    if (d === 4) return 3;
    if (tpl[i] || dbl[i] >= 2) return d <= 2 ? 1 : 2;
    // Sulfoxides and similar keep a stereogenic lone pair: pyramidal, not planar.
    if (aromatic[i] || dbl[i] === 1) return !aromatic[i] && d === 3 && PERIOD3.has(atom.el) ? 3 : 2;
    if (atom.el === 'B') return 2;
    if (atom.el === 'C' && atom.charge > 0 && d === 3) return 2;
    return 3;
  });

  // Lone-pair atoms next to a π system: amide/aniline N become planar, ester
  // and phenol O get wider angles and a planarity preference.
  const conj = new Array<boolean>(n).fill(false);
  const out = geom.slice();
  for (let i = 0; i < n; i++) {
    const el = mol.atoms[i].el;
    if (!HETERO.has(el) || geom[i] !== 3 || degree[i] > 3 || dbl[i] || tpl[i] || aromatic[i]) continue;
    if (!nbrs[i].some((j) => geom[j] === 1 || geom[j] === 2)) continue;
    conj[i] = true;
    if (el !== 'N') continue;
    const amide = nbrs[i].some((j) => carbonyl[j] && mol.atoms[j].el === 'C');
    const sulfonyl = nbrs[i].some((j) => PERIOD3.has(mol.atoms[j].el) && degree[j] === 4);
    const threeRing = nbrs[i].some((a) => nbrs[i].some((b) => a < b && nbrs[a].includes(b)));
    if (!threeRing && (amide || !sulfonyl)) out[i] = 2;
  }
  return { nbrs, degree, geom: out, conj, carbonyl, aromatic };
}

// ---------------------------------------------------------------------------
// Ideal bond lengths

const XH: Record<string, number> = {
  N: 1.01, O: 0.97, S: 1.34, P: 1.42, B: 1.19, Si: 1.48, Se: 1.46, F: 0.92, Cl: 1.27, Br: 1.41, I: 1.61,
};

/** Ideal X–H bond length (Å) for heavy atom `el` with the given geometry. */
export function xhLength(el: string, geom: Geometry): number {
  if (el === 'C') return geom === 1 ? 1.06 : geom === 2 ? 1.08 : 1.09;
  if (el === 'H') return 0.74;
  return XH[el] ?? element(el).covalent + 0.25;
}

/** Single-bond radii (Å) by geometry [sp3, sp2, sp]; sums reproduce typical small-molecule crystal values. */
const RADIUS: Record<string, [number, number, number]> = {
  C: [0.765, 0.74, 0.7],
  N: [0.71, 0.69, 0.66],
  O: [0.67, 0.65, 0.65],
  S: [1.05, 1.03, 1.03],
  P: [1.09, 1.07, 1.07],
  B: [0.83, 0.8, 0.8],
  Si: [1.12, 1.1, 1.1],
  Se: [1.18, 1.16, 1.16],
  F: [0.6, 0.6, 0.6],
  Cl: [1.015, 1.015, 1.015],
  Br: [1.17, 1.17, 1.17],
  I: [1.37, 1.37, 1.37],
};
const AROMATIC: Record<string, number> = {
  CC: 1.39, CN: 1.345, NN: 1.35, CO: 1.37, NO: 1.39, CS: 1.72, NS: 1.65, CSe: 1.86, CP: 1.74, BC: 1.52, BN: 1.43,
};
const DOUBLE: Record<string, number> = {
  CC: 1.335, CO: 1.22, CN: 1.28, CS: 1.67, NN: 1.25, NO: 1.21, OP: 1.48, NS: 1.53, PS: 1.93, CSe: 1.8, CP: 1.67,
  OSe: 1.61,
};
const TRIPLE: Record<string, number> = { CC: 1.2, CN: 1.155, NN: 1.1, CO: 1.13 };

function radius(el: string, geom: Geometry): number {
  const r = RADIUS[el];
  if (!r) return element(el).covalent;
  return geom === 1 ? r[2] : geom === 2 ? r[1] : r[0];
}

const pairKey = (a: string, b: string) => (a < b ? a + b : b + a);

function singleLength(mol: Molecule, t: AtomTyping, a: number, b: number, key: string): number {
  const el = (i: number) => mol.atoms[i].el;
  const hyper = (i: number) => (el(i) === 'S' || el(i) === 'P') && t.degree[i] === 4;
  if (hyper(a) || hyper(b)) {
    const [s, o] = hyper(a) ? [a, b] : [b, a];
    const other = el(o);
    if (el(s) === 'S') {
      const v = ({ C: 1.77, N: 1.63, O: 1.58, F: 1.58 } as Record<string, number>)[other];
      if (v) return v;
    } else {
      const v = ({ C: 1.8, N: 1.66, O: 1.6, F: 1.55 } as Record<string, number>)[other];
      if (v) return v;
    }
  }
  // A lone pair conjugated into an sp2 carbon shortens the bond (amide, ester, aniline, phenol).
  for (const [c, h] of [
    [a, b],
    [b, a],
  ]) {
    if (el(c) !== 'C' || t.geom[c] !== 2 || !t.conj[h]) continue;
    if (el(h) === 'N') return t.carbonyl[c] ? 1.345 : 1.385;
    if (el(h) === 'O') return t.carbonyl[c] ? 1.335 : 1.365;
    if (el(h) === 'S') return 1.76;
  }
  if (key === 'NN') return 1.42;
  if (key === 'NO') return 1.41;
  if (key === 'OO') return 1.47;
  if (key === 'SS') return 2.05;
  return radius(el(a), t.geom[a]) + radius(el(b), t.geom[b]);
}

/** Ideal length (Å) of every bond, in bond order. This is the table the force field restrains to. */
export function idealBondLengths(mol: Molecule, typing: AtomTyping = perceiveTyping(mol)): number[] {
  const t = typing;
  const n = mol.atoms.length;
  const orders = new Map<number, number>();
  for (const b of mol.bonds) {
    orders.set(b.a * n + b.b, b.order);
    orders.set(b.b * n + b.a, b.order);
  }
  const el = (i: number) => mol.atoms[i].el;
  // X(=O)O⁻ (carboxylate, nitro): both oxygens are equivalent by resonance.
  const resonant = (x: number): number | null => {
    if (el(x) !== 'C' && el(x) !== 'N') return null;
    let d = 0;
    let s = 0;
    for (const o of t.nbrs[x]) {
      if (el(o) !== 'O' || t.nbrs[o].length !== 1) continue;
      const bo = orders.get(x * n + o);
      if (bo === 2) d++;
      else if (bo === 1 && mol.atoms[o].charge < 0) s++;
    }
    return d && s ? (el(x) === 'C' ? 1.255 : 1.225) : null;
  };
  return mol.bonds.map((b) => {
    const a = b.a;
    const c = b.b;
    if (el(a) === 'H' || el(c) === 'H') {
      const heavy = el(a) === 'H' ? c : a;
      return xhLength(el(heavy), t.geom[heavy]);
    }
    const key = pairKey(el(a), el(c));
    if (b.aromatic) return AROMATIC[key] ?? radius(el(a), 2) + radius(el(c), 2) - 0.08;
    if (b.order === 3) return TRIPLE[key] ?? radius(el(a), 1) + radius(el(c), 1) - 0.33;
    if (key === 'CO' || key === 'NO') {
      const o = el(a) === 'O' ? a : c;
      if (t.nbrs[o].length === 1) {
        const r = resonant(o === a ? c : a);
        if (r !== null) return r;
      }
    }
    if (b.order === 2) {
      if (key === 'OS') return t.degree[el(a) === 'S' ? a : c] >= 4 ? 1.44 : 1.5;
      return DOUBLE[key] ?? radius(el(a), 2) + radius(el(c), 2) - 0.2;
    }
    return singleLength(mol, t, a, c, key);
  });
}

// ---------------------------------------------------------------------------
// Ideal angles

interface AngleTerm {
  i: number;
  j: number;
  k: number;
  /** Ideal angle (degrees). */
  theta: number;
  linear: boolean;
  /** Centre sits in a 3- or 4-membered ring (excluded from the angle-error report). */
  small: boolean;
}

/**
 * Shortest path src → dst (as atom list) through heavy atoms, avoiding
 * `avoid`; when `skipDirect` the src–dst bond itself may not be used.
 */
function ringPath(
  t: AtomTyping,
  isH: boolean[],
  src: number,
  dst: number,
  avoid: number,
  maxEdges: number,
  skipDirect: boolean,
): number[] | null {
  if (isH[src] || isH[dst]) return null;
  const prev = new Map<number, number>([[src, -1]]);
  let frontier = [src];
  for (let depth = 1; depth <= maxEdges && frontier.length; depth++) {
    const next: number[] = [];
    for (const u of frontier) {
      for (const v of t.nbrs[u]) {
        if (v === avoid || isH[v] || prev.has(v)) continue;
        if (skipDirect && u === src && v === dst) continue;
        prev.set(v, u);
        if (v === dst) {
          const path: number[] = [];
          for (let at = v; at !== -1; at = prev.get(at)!) path.push(at);
          return path;
        }
        next.push(v);
      }
    }
    frontier = next;
  }
  return null;
}

/** Ideal internal angle at `j` for the smallest ring through the angle, or null for "use the hybridisation default". */
function ringAngle(mol: Molecule, t: AtomTyping, j: number, ring: number[]): number | null {
  const s = ring.length;
  const el = mol.atoms[j].el;
  const g = t.geom[j];
  if (s === 3) return 60;
  if (s === 4) return g === 2 ? 90 : 88.5;
  if (s === 5) {
    if (ring.every((a) => t.geom[a] === 2)) {
      // Planar (aromatic) five-ring: S/Se/P close their angle to ~92°, the others share the rest of 540°.
      const big = ring.filter((a) => PERIOD3.has(mol.atoms[a].el)).length;
      if (PERIOD3.has(el)) return 92;
      return (540 - 92 * big) / (5 - big);
    }
    if (g === 2) return 108;
    if (PERIOD3.has(el)) return 94;
    return el === 'O' ? 106 : 104.5;
  }
  if (s === 6) {
    if (g === 2) return 120;
    return PERIOD3.has(el) ? 99 : 111;
  }
  return g === 2 && ring.every((a) => t.aromatic[a]) ? (180 * (s - 2)) / s : null;
}

function sp3Default(mol: Molecule, t: AtomTyping, j: number, withH: boolean): number {
  const el = mol.atoms[j].el;
  if (PERIOD3.has(el)) {
    if (t.degree[j] === 2) return withH ? 96 : 100;
    if (t.degree[j] === 3) return el === 'P' || el === 'As' ? 101 : 106;
    return TETRAHEDRAL;
  }
  if (el === 'O') return withH ? 108.5 : t.conj[j] ? 117 : 111;
  return TETRAHEDRAL;
}

function angleTerms(mol: Molecule, t: AtomTyping, isH: boolean[]): AngleTerm[] {
  const out: AngleTerm[] = [];
  for (let j = 0; j < mol.atoms.length; j++) {
    const nb = t.nbrs[j];
    const g = t.geom[j];
    if (nb.length < 2 || g === 0 || isH[j]) continue;
    const pairs: [number, number][] = [];
    for (let p = 0; p < nb.length; p++) for (let q = p + 1; q < nb.length; q++) pairs.push([nb[p], nb[q]]);
    const rings = pairs.map(([i, k]) => ringPath(t, isH, i, k, j, 6, false));
    const ringVals = rings.map((r) => (r ? ringAngle(mol, t, j, [...r, j]) : null));
    const smallest = Math.min(...rings.map((r) => (r ? r.length + 1 : Infinity)));
    const small = smallest <= 4;
    let thetas: number[];
    if (g === 1) thetas = pairs.map(() => 180);
    else if (g === 2) {
      if (pairs.length === 3) {
        const fixed = ringVals.filter((v): v is number => v !== null);
        const sum = fixed.reduce((s, v) => s + v, 0);
        // Trigonal centres stay planar: unconstrained angles share what the rings leave of 360°.
        const rest = fixed.length < 3 ? Math.min(150, (360 - sum) / (3 - fixed.length)) : 0;
        const scale = fixed.length === 3 ? 360 / sum : 1;
        thetas = ringVals.map((v) => (v !== null ? v * scale : rest));
      } else thetas = ringVals.map((v) => v ?? 120);
    } else {
      thetas = pairs.map(([i, k], p) => {
        const v = ringVals[p];
        if (v !== null) return v;
        if (smallest === 3) return 117;
        if (smallest === 4) return 113;
        return sp3Default(mol, t, j, isH[i] || isH[k]);
      });
    }
    pairs.forEach(([i, k], p) => out.push({ i, j, k, theta: thetas[p], linear: g === 1, small }));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Molecule model (topology + parameters shared by every minimisation stage)

interface ChiralTarget {
  centre: number;
  /** Three neighbours (heavy atoms first); the restraint keeps sign(vol(nb0, nb1, nb2, centre)). */
  nb: [number, number, number];
  sign: number;
}

interface EZTarget {
  i: number;
  j: number;
  k: number;
  l: number;
  cis: boolean;
}

interface TorsionBond {
  j: number;
  k: number;
  v: number;
  n: 2 | 3;
}

interface Model {
  mol: Molecule;
  n: number;
  isH: boolean[];
  t: AtomTyping;
  r0: number[];
  /** Ideal length by atom pair (a * n + b). */
  bondLen: Map<number, number>;
  angles: AngleTerm[];
  oop: [number, number, number, number][];
  torsionBonds: TorsionBond[];
  /** Topological distance a * n + b, capped: 255 = more than 3 bonds (or disconnected). */
  topo: Uint8Array;
  chiral: ChiralTarget[];
  ez: EZTarget[];
}

function torsionParams(mol: Molecule, t: AtomTyping, j: number, k: number, order: number, aromatic: boolean): TorsionBond | null {
  const gj = t.geom[j];
  const gk = t.geom[k];
  if (gj === 0 || gk === 0 || gj === 1 || gk === 1) return null;
  if (t.nbrs[j].length < 2 || t.nbrs[k].length < 2) return null;
  // Torsions about a three-ring bond are fixed by the ring.
  if (t.nbrs[j].some((v) => v !== k && t.nbrs[k].includes(v))) return null;
  if (aromatic) return { j, k, v: 10, n: 2 };
  if (order === 2) return { j, k, v: 12, n: 2 };
  if (order === 3) return null;
  const pj = gj === 2 || t.conj[j];
  const pk = gk === 2 || t.conj[k];
  if (pj && pk) {
    const el = (i: number) => mol.atoms[i].el;
    const acyl = (c: number, x: number, e: string) => el(c) === 'C' && t.carbonyl[c] && el(x) === e;
    if ((acyl(j, k, 'N') && gk === 2) || (acyl(k, j, 'N') && gj === 2)) return { j, k, v: 8, n: 2 };
    if (acyl(j, k, 'O') || acyl(k, j, 'O')) return { j, k, v: 4, n: 2 };
    return { j, k, v: 1.5, n: 2 };
  }
  if (gj === 3 && gk === 3) return { j, k, v: 1.4, n: 3 };
  return null;
}

function topology(nbrs: number[][], n: number): Uint8Array {
  const topo = new Uint8Array(n * n).fill(255);
  for (let s = 0; s < n; s++) {
    topo[s * n + s] = 0;
    let frontier = [s];
    for (let d = 1; d <= 3; d++) {
      const next: number[] = [];
      for (const u of frontier) {
        for (const v of nbrs[u]) {
          if (topo[s * n + v] !== 255) continue;
          topo[s * n + v] = d;
          next.push(v);
        }
      }
      frontier = next;
    }
  }
  return topo;
}

function buildModel(mol: Molecule): Model {
  const n = mol.atoms.length;
  const t = perceiveTyping(mol);
  const isH = mol.atoms.map((a) => a.el === 'H');
  const r0 = idealBondLengths(mol, t);
  const bondLen = new Map<number, number>();
  mol.bonds.forEach((b, i) => {
    bondLen.set(b.a * n + b.b, r0[i]);
    bondLen.set(b.b * n + b.a, r0[i]);
  });
  const oop: [number, number, number, number][] = [];
  for (let c = 0; c < n; c++) {
    const nb = t.nbrs[c];
    if (t.geom[c] === 2 && nb.length === 3) oop.push([c, nb[0], nb[1], nb[2]]);
  }
  const torsionBonds: TorsionBond[] = [];
  for (const b of mol.bonds) {
    const p = torsionParams(mol, t, b.a, b.b, b.order, b.aromatic);
    if (p) torsionBonds.push(p);
  }
  return {
    mol,
    n,
    isH,
    t,
    r0,
    bondLen,
    angles: angleTerms(mol, t, isH),
    oop,
    torsionBonds,
    topo: topology(t.nbrs, n),
    chiral: [],
    ez: [],
  };
}

/** Neighbours ordered heavy atoms first (then by index) so heavy-only stages can use the same triples. */
function orderedNbrs(model: Model, c: number): number[] {
  return [...model.t.nbrs[c]].sort((a, b) => Number(model.isH[a]) - Number(model.isH[b]) || a - b);
}

// ---------------------------------------------------------------------------
// Small vector helpers on plain tuples

const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
function unit3(a: Vec3): Vec3 {
  const l = len3(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}
const lin3 = (a: Vec3, sa: number, b: Vec3, sb: number): Vec3 => [
  a[0] * sa + b[0] * sb,
  a[1] * sa + b[1] * sb,
  a[2] * sa + b[2] * sb,
];

/** Signed volume (×6) of the tetrahedron a, b, c, d: which side of plane abc d lies on. */
function vol4(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  return dot3(cross3(sub3(b, a), sub3(c, a)), sub3(d, a));
}

/** cos of the dihedral i-j-k-l, or null when either half is collinear. */
function cosTorsion(i: Vec3, j: Vec3, k: Vec3, l: Vec3): number | null {
  const g = sub3(j, k);
  const a = cross3(sub3(i, j), g);
  const b = cross3(sub3(l, k), g);
  const la = len3(a);
  const lb = len3(b);
  if (la < 1e-6 || lb < 1e-6) return null;
  return dot3(a, b) / (la * lb);
}

/** Any unit vector perpendicular to unit vector `a`. */
function perpendicular(a: Vec3): Vec3 {
  const t: Vec3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  return unit3(cross3(a, t));
}

/**
 * Free bond directions (unit vectors) around `centre` for the given geometry,
 * in order of preference. With one existing neighbour, `ref` (an atom bonded
 * to that neighbour) fixes the orientation: sp3 directions are staggered
 * (anti first, then ±gauche) and sp2 directions lie in the ref plane (trans
 * first, then cis). `angleDeg` overrides the neighbour–centre–new angle in
 * that case.
 */
export function freeDirections(
  centre: Vec3,
  nbrPos: Vec3[],
  geom: Geometry,
  ref: Vec3 | null = null,
  angleDeg?: number,
): Vec3[] {
  const u = nbrPos.map((p) => unit3(sub3(p, centre)));
  const g = geom === 0 ? 3 : geom;
  if (u.length === 0) {
    if (g === 1) return [[1, 0, 0], [-1, 0, 0]];
    if (g === 2) return [[1, 0, 0], [-0.5, Math.sqrt(3) / 2, 0], [-0.5, -Math.sqrt(3) / 2, 0]];
    const s = 1 / Math.sqrt(3);
    return [[s, s, s], [s, -s, -s], [-s, s, -s], [-s, -s, s]];
  }
  if (u.length === 1) {
    const a = u[0];
    if (g === 1) return [[-a[0], -a[1], -a[2]]];
    let p: Vec3 = [0, 0, 0];
    if (ref) {
      const r = sub3(ref, nbrPos[0]);
      p = unit3(lin3(r, 1, a, -dot3(r, a)));
    }
    if (len3(p) < 0.5) p = perpendicular(a);
    const th = (angleDeg ?? (g === 2 ? 120 : TETRAHEDRAL)) * DEG;
    const ct = Math.cos(th);
    const st = Math.sin(th);
    if (g === 2) return [lin3(a, ct, p, -st), lin3(a, ct, p, st)];
    const q = cross3(a, p);
    return [180, 60, -60].map((tau) => {
      const w = lin3(p, Math.cos(tau * DEG), q, Math.sin(tau * DEG));
      return lin3(a, ct, w, st);
    });
  }
  if (u.length === 2) {
    if (g === 1) return [];
    let b = unit3(lin3(u[0], -1, u[1], -1));
    if (len3(b) < 0.5) b = perpendicular(u[0]);
    if (g === 2) return [b];
    let nrm = unit3(cross3(u[0], u[1]));
    if (len3(nrm) < 0.5) nrm = unit3(cross3(u[0], b));
    const half = (TETRAHEDRAL / 2) * DEG;
    return [lin3(b, Math.cos(half), nrm, Math.sin(half)), lin3(b, Math.cos(half), nrm, -Math.sin(half))];
  }
  if (u.length === 3 && g === 3) {
    let s = lin3(lin3(u[0], 1, u[1], 1), 1, u[2], 1);
    if (len3(s) < 0.1) s = cross3(sub3(u[1], u[0]), sub3(u[2], u[0]));
    return [unit3([-s[0], -s[1], -s[2]])];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Force field

interface FF {
  bA: Int32Array;
  bB: Int32Array;
  bR0: Float64Array;
  bK: Float64Array;
  aI: Int32Array;
  aJ: Int32Array;
  aK: Int32Array;
  aC0: Float64Array;
  aF: Float64Array;
  aLin: Uint8Array;
  oC: Int32Array;
  oA: Int32Array;
  oB: Int32Array;
  oD: Int32Array;
  oK: number;
  tI: Int32Array;
  tJ: Int32Array;
  tK: Int32Array;
  tL: Int32Array;
  tV: Float64Array;
  /** Periodicity; 1 marks an E/Z restraint E = |V| − V·cos φ. */
  tN: Int8Array;
  cA: Int32Array;
  cB: Int32Array;
  cC: Int32Array;
  cD: Int32Array;
  cS: Float64Array;
  cMin: Float64Array;
  cK: number;
  pI: Int32Array;
  pJ: Int32Array;
  pD0: Float64Array;
  pK: Float64Array;
  fixed: Uint8Array | null;
}

interface FFOptions {
  repulsion: boolean;
  chiralK: number;
  fixed?: number[];
}

const K_BOND = 700;
const K_BOND_H = 500;
const K_ANGLE = 90;
const K_ANGLE_H = 60;
const K_OOP = 40;
const K_EZ = 25;

/** Build force-field terms for the atoms in `atoms` (global indices); local index = position in `atoms`. */
function buildFF(model: Model, atoms: number[], o: FFOptions): FF {
  const { mol, n, isH, topo } = model;
  const local = new Int32Array(n).fill(-1);
  atoms.forEach((g, i) => (local[g] = i));
  const has = (...xs: number[]) => xs.every((x) => local[x] >= 0);

  const bA: number[] = [];
  const bB: number[] = [];
  const bR0: number[] = [];
  const bK: number[] = [];
  mol.bonds.forEach((b, i) => {
    if (!has(b.a, b.b)) return;
    bA.push(local[b.a]);
    bB.push(local[b.b]);
    bR0.push(model.r0[i]);
    bK.push(isH[b.a] || isH[b.b] ? K_BOND_H : K_BOND);
  });

  const aI: number[] = [];
  const aJ: number[] = [];
  const aK: number[] = [];
  const aC0: number[] = [];
  const aF: number[] = [];
  const aLin: number[] = [];
  for (const a of model.angles) {
    if (!has(a.i, a.j, a.k)) continue;
    const kth = isH[a.i] || isH[a.k] ? K_ANGLE_H : K_ANGLE;
    aI.push(local[a.i]);
    aJ.push(local[a.j]);
    aK.push(local[a.k]);
    aC0.push(Math.cos(a.theta * DEG));
    aLin.push(a.linear ? 1 : 0);
    // Cosine-harmonic: K (cos θ − cos θ0)² ≈ kθ Δθ² near the minimum.
    const s = Math.sin(a.theta * DEG);
    aF.push(a.linear ? 2 * kth : kth / Math.max(0.25, s * s));
  }

  const oC: number[] = [];
  const oA: number[] = [];
  const oB: number[] = [];
  const oD: number[] = [];
  for (const [c, a, b, d] of model.oop) {
    if (!has(c, a, b, d)) continue;
    oC.push(local[c]);
    oA.push(local[a]);
    oB.push(local[b]);
    oD.push(local[d]);
  }

  const tI: number[] = [];
  const tJ: number[] = [];
  const tK: number[] = [];
  const tL: number[] = [];
  const tV: number[] = [];
  const tN: number[] = [];
  for (const tb of model.torsionBonds) {
    if (!has(tb.j, tb.k)) continue;
    const quads: [number, number][] = [];
    for (const i of model.t.nbrs[tb.j]) {
      if (i === tb.k || local[i] < 0) continue;
      for (const l of model.t.nbrs[tb.k]) {
        if (l === tb.j || l === i || local[l] < 0) continue;
        quads.push([i, l]);
      }
    }
    // Normalise per bond so heavy-only and all-atom stages see the same barrier.
    for (const [i, l] of quads) {
      tI.push(local[i]);
      tJ.push(local[tb.j]);
      tK.push(local[tb.k]);
      tL.push(local[l]);
      tV.push(tb.v / quads.length);
      tN.push(tb.n);
    }
  }
  for (const ez of model.ez) {
    if (!has(ez.i, ez.j, ez.k, ez.l)) continue;
    tI.push(local[ez.i]);
    tJ.push(local[ez.j]);
    tK.push(local[ez.k]);
    tL.push(local[ez.l]);
    tV.push(ez.cis ? K_EZ : -K_EZ);
    tN.push(1);
  }

  const cA: number[] = [];
  const cB: number[] = [];
  const cC: number[] = [];
  const cD: number[] = [];
  const cS: number[] = [];
  const cMin: number[] = [];
  for (const ch of model.chiral) {
    const len = (x: number) => model.bondLen.get(ch.centre * n + x) ?? 1.5;
    for (const [p, q, r, s] of chiralTriples(model, ch)) {
      if (!has(p, q, r, ch.centre)) continue;
      cA.push(local[p]);
      cB.push(local[q]);
      cC.push(local[r]);
      cD.push(local[ch.centre]);
      cS.push(s);
      // Flat-bottomed: only a flattened or inverted centre is penalised.
      cMin.push(0.3 * len(p) * len(q) * len(r));
    }
  }

  const pI: number[] = [];
  const pJ: number[] = [];
  const pD0: number[] = [];
  const pK: number[] = [];
  if (o.repulsion) {
    for (let a = 0; a < atoms.length; a++) {
      const ga = atoms[a];
      for (let b = a + 1; b < atoms.length; b++) {
        const gb = atoms[b];
        const d = topo[ga * n + gb];
        if (d < 3) continue;
        const h = Number(isH[ga]) + Number(isH[gb]);
        const one4 = d === 3;
        pI.push(a);
        pJ.push(b);
        pD0.push(h === 0 ? (one4 ? 2.65 : 3.2) : h === 1 ? (one4 ? 2.4 : 2.6) : one4 ? 1.9 : 2.2);
        pK.push(h === 0 ? 10 : 5);
      }
    }
  }

  let fixed: Uint8Array | null = null;
  if (o.fixed?.length) {
    fixed = new Uint8Array(atoms.length);
    for (const f of o.fixed) if (local[f] >= 0) fixed[local[f]] = 1;
  }

  return {
    bA: Int32Array.from(bA),
    bB: Int32Array.from(bB),
    bR0: Float64Array.from(bR0),
    bK: Float64Array.from(bK),
    aI: Int32Array.from(aI),
    aJ: Int32Array.from(aJ),
    aK: Int32Array.from(aK),
    aC0: Float64Array.from(aC0),
    aF: Float64Array.from(aF),
    aLin: Uint8Array.from(aLin),
    oC: Int32Array.from(oC),
    oA: Int32Array.from(oA),
    oB: Int32Array.from(oB),
    oD: Int32Array.from(oD),
    oK: K_OOP,
    tI: Int32Array.from(tI),
    tJ: Int32Array.from(tJ),
    tK: Int32Array.from(tK),
    tL: Int32Array.from(tL),
    tV: Float64Array.from(tV),
    tN: Int8Array.from(tN),
    cA: Int32Array.from(cA),
    cB: Int32Array.from(cB),
    cC: Int32Array.from(cC),
    cD: Int32Array.from(cD),
    cS: Float64Array.from(cS),
    cMin: Float64Array.from(cMin),
    cK: o.chiralK,
    pI: Int32Array.from(pI),
    pJ: Int32Array.from(pJ),
    pD0: Float64Array.from(pD0),
    pK: Float64Array.from(pK),
    fixed,
  };
}

/** Energy and analytical gradient (into `g`) at coordinates `x` (flat xyz). */
function evaluate(ff: FF, x: Float64Array, g: Float64Array): number {
  g.fill(0);
  let e = 0;

  // Bond stretch: k (r − r0)².
  const { bA, bB, bR0, bK } = ff;
  for (let t = 0; t < bA.length; t++) {
    const i = bA[t] * 3;
    const j = bB[t] * 3;
    const dx = x[i] - x[j];
    const dy = x[i + 1] - x[j + 1];
    const dz = x[i + 2] - x[j + 2];
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-12;
    const dr = r - bR0[t];
    e += bK[t] * dr * dr;
    const f = (2 * bK[t] * dr) / r;
    g[i] += f * dx;
    g[i + 1] += f * dy;
    g[i + 2] += f * dz;
    g[j] -= f * dx;
    g[j + 1] -= f * dy;
    g[j + 2] -= f * dz;
  }

  // Angle bend: K (cos θ − cos θ0)², or K (1 + cos θ) for linear centres.
  const { aI, aJ, aK, aC0, aF, aLin } = ff;
  for (let t = 0; t < aI.length; t++) {
    const i = aI[t] * 3;
    const j = aJ[t] * 3;
    const k = aK[t] * 3;
    const ux = x[i] - x[j];
    const uy = x[i + 1] - x[j + 1];
    const uz = x[i + 2] - x[j + 2];
    const vx = x[k] - x[j];
    const vy = x[k + 1] - x[j + 1];
    const vz = x[k + 2] - x[j + 2];
    const ru2 = ux * ux + uy * uy + uz * uz + 1e-12;
    const rv2 = vx * vx + vy * vy + vz * vz + 1e-12;
    const ruv = Math.sqrt(ru2 * rv2);
    let c = (ux * vx + uy * vy + uz * vz) / ruv;
    if (c > 1) c = 1;
    else if (c < -1) c = -1;
    let dEdc: number;
    if (aLin[t]) {
      e += aF[t] * (1 + c);
      dEdc = aF[t];
    } else {
      const d = c - aC0[t];
      e += aF[t] * d * d;
      dEdc = 2 * aF[t] * d;
    }
    const inv = dEdc / ruv;
    const cu = (dEdc * c) / ru2;
    const cv = (dEdc * c) / rv2;
    const gix = inv * vx - cu * ux;
    const giy = inv * vy - cu * uy;
    const giz = inv * vz - cu * uz;
    const gkx = inv * ux - cv * vx;
    const gky = inv * uy - cv * vy;
    const gkz = inv * uz - cv * vz;
    g[i] += gix;
    g[i + 1] += giy;
    g[i + 2] += giz;
    g[k] += gkx;
    g[k + 1] += gky;
    g[k + 2] += gkz;
    g[j] -= gix + gkx;
    g[j + 1] -= giy + gky;
    g[j + 2] -= giz + gkz;
  }

  // sp2 planarity: K V² with V the triple product of the three bond vectors.
  const { oC, oA, oB, oD, oK } = ff;
  for (let t = 0; t < oC.length; t++) {
    const c = oC[t] * 3;
    const a = oA[t] * 3;
    const b = oB[t] * 3;
    const d = oD[t] * 3;
    const ux = x[a] - x[c];
    const uy = x[a + 1] - x[c + 1];
    const uz = x[a + 2] - x[c + 2];
    const vx = x[b] - x[c];
    const vy = x[b + 1] - x[c + 1];
    const vz = x[b + 2] - x[c + 2];
    const wx = x[d] - x[c];
    const wy = x[d + 1] - x[c + 1];
    const wz = x[d + 2] - x[c + 2];
    // v × w, w × u, u × v
    const ax = vy * wz - vz * wy;
    const ay = vz * wx - vx * wz;
    const az = vx * wy - vy * wx;
    const bx = wy * uz - wz * uy;
    const by = wz * ux - wx * uz;
    const bz = wx * uy - wy * ux;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    const V = ux * ax + uy * ay + uz * az;
    e += oK * V * V;
    const f = 2 * oK * V;
    g[a] += f * ax;
    g[a + 1] += f * ay;
    g[a + 2] += f * az;
    g[b] += f * bx;
    g[b + 1] += f * by;
    g[b + 2] += f * bz;
    g[d] += f * cx;
    g[d + 1] += f * cy;
    g[d + 2] += f * cz;
    g[c] -= f * (ax + bx + cx);
    g[c + 1] -= f * (ay + by + cy);
    g[c + 2] -= f * (az + bz + cz);
  }

  // Torsions (Blondel & Karplus gradient, no singularity at 0°/180°).
  const { tI, tJ, tK, tL, tV, tN } = ff;
  for (let t = 0; t < tI.length; t++) {
    const i = tI[t] * 3;
    const j = tJ[t] * 3;
    const k = tK[t] * 3;
    const l = tL[t] * 3;
    const Fx = x[i] - x[j];
    const Fy = x[i + 1] - x[j + 1];
    const Fz = x[i + 2] - x[j + 2];
    const Gx = x[j] - x[k];
    const Gy = x[j + 1] - x[k + 1];
    const Gz = x[j + 2] - x[k + 2];
    const Hx = x[l] - x[k];
    const Hy = x[l + 1] - x[k + 1];
    const Hz = x[l + 2] - x[k + 2];
    const Ax = Fy * Gz - Fz * Gy;
    const Ay = Fz * Gx - Fx * Gz;
    const Az = Fx * Gy - Fy * Gx;
    const Bx = Hy * Gz - Hz * Gy;
    const By = Hz * Gx - Hx * Gz;
    const Bz = Hx * Gy - Hy * Gx;
    const rA2 = Ax * Ax + Ay * Ay + Az * Az;
    const rB2 = Bx * Bx + By * By + Bz * Bz;
    if (rA2 < 1e-10 || rB2 < 1e-10) continue;
    const rG = Math.sqrt(Gx * Gx + Gy * Gy + Gz * Gz);
    const rAB = Math.sqrt(rA2 * rB2);
    const cs = (Ax * Bx + Ay * By + Az * Bz) / rAB;
    // sin φ = (B × A)·G / (|A||B||G|)
    const sn = ((By * Az - Bz * Ay) * Gx + (Bz * Ax - Bx * Az) * Gy + (Bx * Ay - By * Ax) * Gz) / (rAB * rG);
    const V = tV[t];
    let dEdphi: number;
    if (tN[t] === 3) {
      e += 0.5 * V * (1 + (4 * cs * cs * cs - 3 * cs));
      dEdphi = -1.5 * V * (3 * sn - 4 * sn * sn * sn);
    } else if (tN[t] === 2) {
      e += 0.5 * V * (1 - (2 * cs * cs - 1));
      dEdphi = V * 2 * sn * cs;
    } else {
      e += Math.abs(V) - V * cs;
      dEdphi = V * sn;
    }
    const fi = (-dEdphi * rG) / rA2;
    const fl = (dEdphi * rG) / rB2;
    const FG = Fx * Gx + Fy * Gy + Fz * Gz;
    const HG = Hx * Gx + Hy * Gy + Hz * Gz;
    const a1 = (dEdphi * FG) / (rA2 * rG);
    const b1 = (dEdphi * HG) / (rB2 * rG);
    const sx = a1 * Ax - b1 * Bx;
    const sy = a1 * Ay - b1 * By;
    const sz = a1 * Az - b1 * Bz;
    g[i] += fi * Ax;
    g[i + 1] += fi * Ay;
    g[i + 2] += fi * Az;
    g[l] += fl * Bx;
    g[l + 1] += fl * By;
    g[l + 2] += fl * Bz;
    g[j] += -fi * Ax + sx;
    g[j + 1] += -fi * Ay + sy;
    g[j + 2] += -fi * Az + sz;
    g[k] += -fl * Bx - sx;
    g[k + 1] += -fl * By - sy;
    g[k + 2] += -fl * Bz - sz;
  }

  // Chirality: flat-bottomed restraint on the signed volume vol(n1, n2, n3, centre).
  const { cA, cB, cC, cD, cS, cMin, cK } = ff;
  for (let t = 0; t < cA.length; t++) {
    const a = cA[t] * 3;
    const b = cB[t] * 3;
    const c = cC[t] * 3;
    const d = cD[t] * 3;
    const px = x[b] - x[a];
    const py = x[b + 1] - x[a + 1];
    const pz = x[b + 2] - x[a + 2];
    const qx = x[c] - x[a];
    const qy = x[c + 1] - x[a + 1];
    const qz = x[c + 2] - x[a + 2];
    const rx = x[d] - x[a];
    const ry = x[d + 1] - x[a + 1];
    const rz = x[d + 2] - x[a + 2];
    const pqx = py * qz - pz * qy;
    const pqy = pz * qx - px * qz;
    const pqz = px * qy - py * qx;
    const V = pqx * rx + pqy * ry + pqz * rz;
    const sv = cS[t] * V;
    if (sv >= cMin[t]) continue;
    const diff = cMin[t] - sv;
    e += cK * diff * diff;
    const f = -2 * cK * diff * cS[t];
    const qrx = qy * rz - qz * ry;
    const qry = qz * rx - qx * rz;
    const qrz = qx * ry - qy * rx;
    const rpx = ry * pz - rz * py;
    const rpy = rz * px - rx * pz;
    const rpz = rx * py - ry * px;
    g[b] += f * qrx;
    g[b + 1] += f * qry;
    g[b + 2] += f * qrz;
    g[c] += f * rpx;
    g[c + 1] += f * rpy;
    g[c + 2] += f * rpz;
    g[d] += f * pqx;
    g[d + 1] += f * pqy;
    g[d + 2] += f * pqz;
    g[a] -= f * (qrx + rpx + pqx);
    g[a + 1] -= f * (qry + rpy + pqy);
    g[a + 2] -= f * (qrz + rpz + pqz);
  }

  // Soft repulsion between atoms ≥ 3 bonds apart (no attraction: no spurious collapse).
  const { pI, pJ, pD0, pK } = ff;
  for (let t = 0; t < pI.length; t++) {
    const i = pI[t] * 3;
    const j = pJ[t] * 3;
    const dx = x[i] - x[j];
    const dy = x[i + 1] - x[j + 1];
    const dz = x[i + 2] - x[j + 2];
    const d2 = dx * dx + dy * dy + dz * dz;
    const d0 = pD0[t];
    if (d2 >= d0 * d0) continue;
    const d = Math.sqrt(d2) + 1e-9;
    const diff = d0 - d;
    e += pK[t] * diff * diff;
    const f = (-2 * pK[t] * diff) / d;
    g[i] += f * dx;
    g[i + 1] += f * dy;
    g[i + 2] += f * dz;
    g[j] -= f * dx;
    g[j + 1] -= f * dy;
    g[j + 2] -= f * dz;
  }

  if (ff.fixed) {
    for (let a = 0; a < ff.fixed.length; a++) {
      if (!ff.fixed[a]) continue;
      g[a * 3] = 0;
      g[a * 3 + 1] = 0;
      g[a * 3 + 2] = 0;
    }
  }
  return e;
}

/** L-BFGS with a backtracking (Armijo) line search and a per-atom step cap. Updates `x` in place. */
function minimise(ff: FF, x: Float64Array, maxIter: number, gtol: number): number {
  const N = x.length;
  if (!N) return 0;
  const M = 8;
  const S: Float64Array[] = [];
  const Y: Float64Array[] = [];
  const R: number[] = [];
  let g = new Float64Array(N);
  let gNew = new Float64Array(N);
  const xNew = new Float64Array(N);
  const d = new Float64Array(N);
  const alpha = new Float64Array(M);
  let f = evaluate(ff, x, g);
  let stall = 0;
  const maxStep = 0.4;

  for (let it = 0; it < maxIter; it++) {
    let gg = 0;
    for (let i = 0; i < N; i++) gg += g[i] * g[i];
    if (Math.sqrt(gg / N) < gtol) break;

    for (let i = 0; i < N; i++) d[i] = -g[i];
    const m = S.length;
    for (let h = m - 1; h >= 0; h--) {
      let a = 0;
      const s = S[h];
      for (let i = 0; i < N; i++) a += s[i] * d[i];
      a *= R[h];
      alpha[h] = a;
      const y = Y[h];
      for (let i = 0; i < N; i++) d[i] -= a * y[i];
    }
    if (m) {
      const y = Y[m - 1];
      let yy = 0;
      for (let i = 0; i < N; i++) yy += y[i] * y[i];
      const gamma = 1 / (R[m - 1] * yy);
      for (let i = 0; i < N; i++) d[i] *= gamma;
    }
    for (let h = 0; h < m; h++) {
      let b = 0;
      const y = Y[h];
      for (let i = 0; i < N; i++) b += y[i] * d[i];
      b *= R[h];
      const s = S[h];
      const c = alpha[h] - b;
      for (let i = 0; i < N; i++) d[i] += c * s[i];
    }
    let gd = 0;
    for (let i = 0; i < N; i++) gd += g[i] * d[i];
    if (!(gd < 0)) {
      // Not a descent direction: drop the curvature memory and use steepest descent.
      S.length = 0;
      Y.length = 0;
      R.length = 0;
      for (let i = 0; i < N; i++) d[i] = -g[i];
      gd = -gg;
    }
    // Cap the largest per-atom displacement so a bad step cannot tear the molecule apart.
    let big = 0;
    for (let i = 0; i < N; i += 3) {
      const s2 = d[i] * d[i] + d[i + 1] * d[i + 1] + d[i + 2] * d[i + 2];
      if (s2 > big) big = s2;
    }
    big = Math.sqrt(big);
    if (big > maxStep) {
      const sc = maxStep / big;
      for (let i = 0; i < N; i++) d[i] *= sc;
      gd *= sc;
    }

    let step = 1;
    let fNew = f;
    let ok = false;
    for (let ls = 0; ls < 25; ls++) {
      for (let i = 0; i < N; i++) xNew[i] = x[i] + step * d[i];
      fNew = evaluate(ff, xNew, gNew);
      if (fNew <= f + 1e-4 * step * gd) {
        ok = true;
        break;
      }
      const denom = 2 * (fNew - f - step * gd);
      const next = denom > 0 ? (-gd * step * step) / denom : 0.5 * step;
      step = Math.min(0.5 * step, Math.max(0.1 * step, next));
    }
    if (!ok) {
      if (!S.length) break;
      S.length = 0;
      Y.length = 0;
      R.length = 0;
      continue;
    }

    const s = S.length === M ? S.shift()! : new Float64Array(N);
    const y = Y.length === M ? Y.shift()! : new Float64Array(N);
    if (R.length === M) R.shift();
    let sy = 0;
    for (let i = 0; i < N; i++) {
      s[i] = xNew[i] - x[i];
      y[i] = gNew[i] - g[i];
      sy += s[i] * y[i];
    }
    if (sy > 1e-10) {
      S.push(s);
      Y.push(y);
      R.push(1 / sy);
    }
    x.set(xNew);
    const tmp = g;
    g = gNew;
    gNew = tmp;
    if (f - fNew < 1e-8 * Math.max(1, Math.abs(f))) {
      if (++stall >= 6) {
        f = fNew;
        break;
      }
    } else stall = 0;
    f = fNew;
  }
  return f;
}

// ---------------------------------------------------------------------------
// Stereo targets

/**
 * Restraint triples for a stereocentre as [n1, n2, n3, sign]. With four
 * neighbours every triple is restrained (signs follow from permutation parity
 * of vol(p0, p1, p2, p3)), which keeps the centre inside the tetrahedron of its
 * neighbours: restraining one triple alone lets the fourth neighbour fold onto
 * the wrong side, a strained trap that is common in bridged polycycles.
 */
function chiralTriples(model: Model, ch: ChiralTarget): [number, number, number, number][] {
  const [p0, p1, p2] = ch.nb;
  const out: [number, number, number, number][] = [[p0, p1, p2, ch.sign]];
  const nb = model.t.nbrs[ch.centre];
  if (nb.length === 4) {
    const p3 = nb.find((v) => v !== p0 && v !== p1 && v !== p2)!;
    out.push([p0, p1, p3, -ch.sign], [p0, p2, p3, ch.sign], [p1, p2, p3, -ch.sign]);
  }
  return out;
}

/**
 * Tetrahedral targets from molfile wedges. Each centre is read locally:
 * neighbour directions from the 2D depiction, lifted ±z only for wedges that
 * start at that centre (the molfile convention), so a lift made for another
 * centre can never leak into this one.
 */
function chiralFromWedges(model: Model): ChiralTarget[] {
  const { mol } = model;
  const lifts = new Map<number, Map<number, number>>();
  for (const b of mol.bonds) {
    if (b.stereo !== 1 && b.stereo !== 6) continue;
    if (!lifts.has(b.a)) lifts.set(b.a, new Map());
    lifts.get(b.a)!.set(b.b, b.stereo === 1 ? 1 : -1);
  }
  const out: ChiralTarget[] = [];
  for (const [c, lift] of lifts) {
    const nb = orderedNbrs(model, c);
    if (nb.length < 3 || nb.length > 4) continue;
    const C = mol.atoms[c];
    const flat = nb.map((m): Vec3 => {
      const a = mol.atoms[m];
      const d = unit3([a.x - C.x, a.y - C.y, 0]);
      return [d[0], d[1], 0];
    });
    const volume = (plain: number) => {
      const p = nb.map((m, i): Vec3 => [flat[i][0], flat[i][1], lift.has(m) ? 0.8 * lift.get(m)! : plain]);
      return vol4(p[0], p[1], p[2], nb.length === 4 ? p[3] : [0, 0, 0]);
    };
    let v = volume(0);
    if (Math.abs(v) < 0.05) {
      // Degenerate drawing: unwedged bonds point away from the wedged ones.
      const mean = [...lift.values()].reduce((s, z) => s + z, 0);
      v = volume(-0.4 * Math.sign(mean || 1));
    }
    if (Math.abs(v) < 0.05) continue;
    out.push({ centre: c, nb: [nb[0], nb[1], nb[2]], sign: Math.sign(v) });
  }
  return out;
}

/** Tetrahedral targets that freeze the configuration of every pyramidal centre in an existing 3D geometry. */
function chiralFromCoords(model: Model, pos: Vec3[]): ChiralTarget[] {
  const out: ChiralTarget[] = [];
  for (let c = 0; c < model.n; c++) {
    if (model.isH[c] || model.t.geom[c] !== 3) continue;
    const nb = orderedNbrs(model, c);
    if (nb.length < 3) continue;
    const v = vol4(pos[nb[0]], pos[nb[1]], pos[nb[2]], pos[c]);
    const scale = len3(sub3(pos[nb[0]], pos[c])) * len3(sub3(pos[nb[1]], pos[c])) * len3(sub3(pos[nb[2]], pos[c]));
    if (Math.abs(v) < 0.1 * scale) continue;
    out.push({ centre: c, nb: [nb[0], nb[1], nb[2]], sign: Math.sign(v) });
  }
  return out;
}

/** E/Z targets for double bonds outside small rings (rings < 8 fix their own geometry). */
function ezTargets(model: Model, pos: Vec3[]): EZTarget[] {
  const { mol, t, isH } = model;
  const out: EZTarget[] = [];
  for (const b of mol.bonds) {
    if (b.aromatic || b.order !== 2 || b.stereo === 3) continue;
    const j = b.a;
    const k = b.b;
    const ni = orderedNbrs(model, j).filter((v) => v !== k);
    const nl = orderedNbrs(model, k).filter((v) => v !== j);
    if (!ni.length || !nl.length) continue;
    if (ringPath(t, isH, j, k, -1, 6, true)) continue;
    const c = cosTorsion(pos[ni[0]], pos[j], pos[k], pos[nl[0]]);
    if (c === null || Math.abs(c) < 0.5) continue;
    out.push({ i: ni[0], j, k, l: nl[0], cis: c > 0 });
  }
  return out;
}

function stereoStatus(model: Model, pos: Vec3[]): { chiralOk: boolean; stereoBondsOk: boolean } {
  let chiralOk = true;
  for (const ch of model.chiral) {
    const [p, q, r] = ch.nb;
    const v = vol4(pos[p], pos[q], pos[r], pos[ch.centre]);
    const scale = len3(sub3(pos[p], pos[ch.centre])) * len3(sub3(pos[q], pos[ch.centre])) * len3(sub3(pos[r], pos[ch.centre]));
    if (ch.sign * v < 0.15 * scale) chiralOk = false;
  }
  let stereoBondsOk = true;
  for (const ez of model.ez) {
    const c = cosTorsion(pos[ez.i], pos[ez.j], pos[ez.k], pos[ez.l]);
    if (c === null || (ez.cis ? c : -c) < 0.5) stereoBondsOk = false;
  }
  return { chiralOk, stereoBondsOk };
}

// ---------------------------------------------------------------------------
// Builder

export interface EmbedOptions {
  /** PRNG seed: the same seed always gives the same conformer. */
  seed?: number;
  /** Independent starts; the lowest-energy one that keeps every stereo element wins. */
  attempts?: number;
  /** L-BFGS iteration cap per minimisation phase. */
  maxIterations?: number;
}

export interface EmbedReport {
  /** Final force-field energy of the chosen attempt (arbitrary units). */
  energy: number;
  /** Max |r − r0| over bonds (Å). */
  maxBondError: number;
  /** Max angle deviation from ideal (degrees), excluding centres in 3- and 4-membered rings. */
  maxAngleError: number;
  /** Every specified tetrahedral stereocentre kept its configuration. */
  chiralOk: boolean;
  /** Every double bond outside small rings kept its E/Z configuration. */
  stereoBondsOk: boolean;
  /** Smallest heavy-atom distance between atoms ≥ 3 bonds apart (Å); Infinity if there is no such pair. */
  minNonbonded: number;
  attempts: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toVecs = (x: Float64Array, atoms: number[], n: number): Vec3[] => {
  const out: Vec3[] = Array.from({ length: n }, () => [0, 0, 0] as Vec3);
  atoms.forEach((g, i) => (out[g] = [x[i * 3], x[i * 3 + 1], x[i * 3 + 2]]));
  return out;
};

/** 2D depiction scaled so the mean heavy-atom bond is 1.5 Å, centred; null if the coordinates are degenerate. */
function scaled2D(model: Model): Vec3[] | null {
  const { mol, isH } = model;
  let sum = 0;
  let cnt = 0;
  for (const heavyOnly of [true, false]) {
    for (const b of mol.bonds) {
      if (heavyOnly && (isH[b.a] || isH[b.b])) continue;
      const p = mol.atoms[b.a];
      const q = mol.atoms[b.b];
      sum += Math.hypot(p.x - q.x, p.y - q.y);
      cnt++;
    }
    if (cnt) break;
  }
  const mean = cnt ? sum / cnt : 0;
  if (cnt && mean < 1e-3) return null;
  const f = cnt ? 1.5 / mean : 1;
  let cx = 0;
  let cy = 0;
  let m = 0;
  mol.atoms.forEach((a, i) => {
    if (isH[i]) return;
    cx += a.x;
    cy += a.y;
    m++;
  });
  if (m) {
    cx /= m;
    cy /= m;
  }
  return mol.atoms.map((a): Vec3 => [(a.x - cx) * f, (a.y - cy) * f, 0]);
}

/** ±1 two-colouring of saturated ring atoms so the start looks like a chair (odd rings just get a defect). */
function chairColours(model: Model): Int8Array {
  const { mol, t, isH, n } = model;
  const ringBond = ringBondFlags(mol);
  const ringNbrs: number[][] = mol.atoms.map(() => []);
  mol.bonds.forEach((b, i) => {
    if (!ringBond[i]) return;
    ringNbrs[b.a].push(b.b);
    ringNbrs[b.b].push(b.a);
  });
  const colour = new Int8Array(n);
  for (let s = 0; s < n; s++) {
    if (colour[s] || !ringNbrs[s].length || isH[s]) continue;
    colour[s] = 1;
    const queue = [s];
    while (queue.length) {
      const u = queue.shift()!;
      for (const v of ringNbrs[u]) {
        if (colour[v]) continue;
        colour[v] = -colour[u] as -1 | 1;
        queue.push(v);
      }
    }
  }
  for (let i = 0; i < n; i++) if (t.geom[i] !== 3) colour[i] = 0;
  return colour;
}

function initialHeavy(
  model: Model,
  atoms: number[],
  twoD: Vec3[] | null,
  colours: Int8Array,
  rng: () => number,
  attempt: number,
): Float64Array {
  const x = new Float64Array(atoms.length * 3);
  const noise = () => 2 * rng() - 1;
  if (!twoD) {
    const box = 1.6 * Math.cbrt(atoms.length) + 1;
    for (let i = 0; i < x.length; i++) x[i] = box * noise();
    return x;
  }
  const local = new Map<number, number>();
  atoms.forEach((g, i) => local.set(g, i));
  const variant = attempt % 4;
  const chair = variant === 2 ? 0 : variant === 1 ? -0.3 : 0.3;
  const sp3Noise = variant === 2 ? 0.5 : variant === 3 ? 0.35 : 0.15;
  const otherNoise = variant === 2 ? 0.15 : 0.05;
  atoms.forEach((g, i) => {
    const sp3 = model.t.geom[g] === 3;
    x[i * 3] = twoD[g][0] + 0.05 * noise();
    x[i * 3 + 1] = twoD[g][1] + 0.05 * noise();
    x[i * 3 + 2] = chair * colours[g] + (sp3 ? sp3Noise : otherNoise) * noise();
  });
  for (const b of model.mol.bonds) {
    if (b.stereo !== 1 && b.stereo !== 6) continue;
    const li = local.get(b.b);
    if (li === undefined) continue;
    x[li * 3 + 2] += (b.stereo === 1 ? 1 : -1) * 0.8 * 1.5;
  }
  return x;
}

/** Place every hydrogen from the heavy-atom geometry (bond lengths, hybridisation, staggering, 2D cis/trans). */
function placeHydrogens(model: Model, pos: Vec3[], twoD: Vec3[] | null): void {
  const { mol, t, isH, n } = model;
  const placed = isH.map((h) => !h);
  for (let c = 0; c < n; c++) {
    if (isH[c]) continue;
    const hs = t.nbrs[c].filter((v) => isH[v]);
    if (!hs.length) continue;
    const heavy = t.nbrs[c].filter((v) => !isH[v]);
    let refIdx = -1;
    if (heavy.length === 1) {
      const m = heavy[0];
      refIdx = t.nbrs[m].find((v) => v !== c && !isH[v]) ?? t.nbrs[m].find((v) => v !== c && placed[v]) ?? -1;
    }
    let geom = t.geom[c];
    let angle: number | undefined;
    if (geom === 3 && t.conj[c] && heavy.length === 1) {
      // Phenol / acid O–H and similar lie in the π plane.
      geom = 2;
      angle = mol.atoms[c].el === 'S' ? 96 : 108.5;
    }
    const C = pos[c];
    let dirs = freeDirections(C, heavy.map((v) => pos[v]), geom, refIdx >= 0 ? pos[refIdx] : null, angle);
    if (dirs.length < hs.length) dirs = freeDirections(C, heavy.map((v) => pos[v]), 3, refIdx >= 0 ? pos[refIdx] : null);
    while (dirs.length < hs.length) dirs.push(perpendicular(dirs[dirs.length - 1] ?? [0, 0, 1]));

    let chosen: Vec3[];
    if (dirs.length === hs.length) chosen = dirs;
    else if (geom === 2 && heavy.length === 1 && hs.length === 1 && twoD && refIdx >= 0) {
      // Keep the depicted cis/trans relationship (e.g. an imine N–H).
      const m = heavy[0];
      const side = (p: Vec3) =>
        (twoD[c][0] - twoD[m][0]) * (p[1] - twoD[m][1]) - (twoD[c][1] - twoD[m][1]) * (p[0] - twoD[m][0]);
      const cis = side(twoD[hs[0]]) * side(twoD[refIdx]) > 0;
      chosen = [cis ? dirs[1] : dirs[0]];
    } else chosen = leastCrowded(dirs, hs.length, C, xhLength(mol.atoms[c].el, t.geom[c]), pos, placed, c, t.nbrs[c]);

    const L = xhLength(mol.atoms[c].el, t.geom[c]);
    hs.forEach((h, i) => {
      pos[h] = lin3(C, 1, chosen[i], L);
      placed[h] = true;
    });
  }
}

/** Greedily pick `count` directions whose atoms would sit furthest from already-placed atoms. */
export function leastCrowded(
  dirs: Vec3[],
  count: number,
  centre: Vec3,
  length: number,
  pos: Vec3[],
  placed: boolean[],
  self: number,
  bonded: number[],
): Vec3[] {
  const out: Vec3[] = [];
  const pool = dirs.slice();
  const extra: Vec3[] = [];
  while (out.length < count && pool.length) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((d, idx) => {
      const p = lin3(centre, 1, d, length);
      let score = Infinity;
      for (let a = 0; a < pos.length; a++) {
        if (!placed[a] || a === self || bonded.includes(a)) continue;
        const q = pos[a];
        score = Math.min(score, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
      }
      for (const q of extra) score = Math.min(score, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
      // Small bias towards the caller's preference order (ties → earlier direction).
      score -= idx * 1e-3;
      if (score > bestScore) {
        bestScore = score;
        best = idx;
      }
    });
    const d = pool.splice(best, 1)[0];
    out.push(d);
    extra.push(lin3(centre, 1, d, length));
  }
  return out;
}

function geometryReport(model: Model, pos: Vec3[], energy: number, attempts: number): EmbedReport {
  const { mol, n, isH, topo } = model;
  let maxBondError = 0;
  mol.bonds.forEach((b, i) => {
    const r = len3(sub3(pos[b.a], pos[b.b]));
    maxBondError = Math.max(maxBondError, Math.abs(r - model.r0[i]));
  });
  let maxAngleError = 0;
  for (const a of model.angles) {
    if (a.small) continue;
    const u = unit3(sub3(pos[a.i], pos[a.j]));
    const v = unit3(sub3(pos[a.k], pos[a.j]));
    const th = Math.acos(Math.max(-1, Math.min(1, dot3(u, v)))) / DEG;
    maxAngleError = Math.max(maxAngleError, Math.abs(th - a.theta));
  }
  let minNonbonded = Infinity;
  for (let i = 0; i < n; i++) {
    if (isH[i]) continue;
    for (let j = i + 1; j < n; j++) {
      if (isH[j] || topo[i * n + j] < 3) continue;
      minNonbonded = Math.min(minNonbonded, len3(sub3(pos[i], pos[j])));
    }
  }
  return { energy, maxBondError, maxAngleError, minNonbonded, attempts, ...stereoStatus(model, pos) };
}

function flatten(pos: Vec3[], atoms: number[]): Float64Array {
  const x = new Float64Array(atoms.length * 3);
  atoms.forEach((g, i) => {
    x[i * 3] = pos[g][0];
    x[i * 3 + 1] = pos[g][1];
    x[i * 3 + 2] = pos[g][2];
  });
  return x;
}

function finish(model: Model, pos: Vec3[], report: EmbedReport): { mol: Molecule; report: EmbedReport } {
  const out = cloneMolecule(model.mol);
  // Centre on the heavy atoms; tilt a perfectly planar result so writers see a 3D structure.
  const heavy = pos.filter((_, i) => !model.isH[i]);
  const list = heavy.length ? heavy : pos;
  const c: Vec3 = [0, 0, 0];
  for (const p of list) for (let k = 0; k < 3; k++) c[k] += p[k] / list.length;
  const flat = pos.every((p) => Math.abs(p[2] - c[2]) < 0.01);
  const ca = Math.cos(30 * DEG);
  const sa = Math.sin(30 * DEG);
  out.atoms.forEach((a, i) => {
    const x = pos[i][0] - c[0];
    const y = pos[i][1] - c[1];
    const z = pos[i][2] - c[2];
    a.x = x;
    a.y = flat ? y * ca - z * sa : y;
    a.z = flat ? y * sa + z * ca : z;
  });
  for (const b of out.bonds) b.stereo = 0;
  return { mol: out, report };
}

/**
 * Build 3D coordinates. Input: explicit hydrogens, 2D coords (RDKit CoordGen
 * depiction), Kekulé bond orders + aromatic flags, molfile wedge flags
 * (bond.stereo 1 = wedge/up, 6 = hash/down; bond.a is the stereocentre at the
 * narrow end). Output: a NEW Molecule with identical atom/bond order and 3D
 * coordinates (bond.stereo cleared to 0). Deterministic for a given seed.
 *
 * A molecule that already has 3D coordinates is refined in place instead,
 * keeping the configuration of its stereocentres and double bonds.
 */
export function embed3D(mol: Molecule, opts: EmbedOptions = {}): { mol: Molecule; report: EmbedReport } {
  const seed = opts.seed ?? 1;
  const attempts = Math.max(1, Math.floor(opts.attempts ?? 4));
  const maxIter = opts.maxIterations ?? 2000;
  const model = buildModel(mol);
  const { n, isH } = model;
  const all = Array.from({ length: n }, (_, i) => i);
  const empty: EmbedReport = {
    energy: 0,
    maxBondError: 0,
    maxAngleError: 0,
    chiralOk: true,
    stereoBondsOk: true,
    minNonbonded: Infinity,
    attempts: 0,
  };
  if (n === 0) return finish(model, [], empty);

  const input = mol.atoms.map((a): Vec3 => [a.x, a.y, a.z]);
  if (mol.atoms.some((a) => Math.abs(a.z) > 1e-3)) {
    model.chiral = chiralFromCoords(model, input);
    model.ez = ezTargets(model, input);
    const x = flatten(input, all);
    const energy = minimise(buildFF(model, all, { repulsion: true, chiralK: 50 }), x, maxIter, 1e-3);
    const pos = toVecs(x, all, n);
    return finish(model, pos, geometryReport(model, pos, energy, 1));
  }

  const twoD = scaled2D(model);
  model.chiral = twoD ? chiralFromWedges(model) : [];
  model.ez = twoD ? ezTargets(model, input) : [];
  const heavy = all.filter((i) => !isH[i]);
  const core = heavy.length ? heavy : all;
  const colours = chairColours(model);
  const ffA = buildFF(model, core, { repulsion: false, chiralK: 200 });
  const ffB = buildFF(model, core, { repulsion: true, chiralK: 50 });
  const ffAll = buildFF(model, all, { repulsion: true, chiralK: 50 });

  interface Candidate {
    x: Float64Array;
    energy: number;
    ok: boolean;
  }
  const candidates: Candidate[] = [];
  const maxAttempts = attempts * 3;
  let run = 0;
  for (; run < maxAttempts; run++) {
    if (run >= attempts && candidates.some((c) => c.ok)) break;
    const rng = mulberry32((seed * 0x9e3779b1 + run * 0x85ebca6b) >>> 0);
    const x = initialHeavy(model, core, twoD, colours, rng, run);
    if (core.length > 1) {
      minimise(ffA, x, maxIter, 0.05);
      minimise(ffB, x, maxIter, 1e-3);
    }
    const g = new Float64Array(x.length);
    const energy = evaluate(ffB, x, g);
    const st = stereoStatus(model, toVecs(x, core, n));
    candidates.push({ x, energy, ok: st.chiralOk && st.stereoBondsOk });
  }
  candidates.sort((a, b) => Number(b.ok) - Number(a.ok) || a.energy - b.energy);

  let best: { pos: Vec3[]; energy: number; ok: boolean } | null = null;
  for (const cand of candidates.slice(0, 2)) {
    const pos = toVecs(cand.x, core, n);
    if (core !== all) placeHydrogens(model, pos, twoD);
    const x = flatten(pos, all);
    const energy = minimise(ffAll, x, maxIter, 1e-3);
    const fin = toVecs(x, all, n);
    const st = stereoStatus(model, fin);
    const ok = st.chiralOk && st.stereoBondsOk;
    if (!best || (ok && !best.ok) || (ok === best.ok && energy < best.energy)) best = { pos: fin, energy, ok };
    if (ok) break;
  }
  return finish(model, best!.pos, geometryReport(model, best!.pos, best!.energy, run));
}

/**
 * Local force-field clean-up of an existing 3D geometry (used after adding or
 * removing hydrogens). Every pyramidal centre and double bond keeps its current
 * configuration; atoms listed in `fixed` do not move.
 */
export function relax3D(mol: Molecule, opts: { maxIterations?: number; fixed?: number[] } = {}): Molecule {
  const model = buildModel(mol);
  const n = model.n;
  if (!n) return cloneMolecule(mol);
  const all = Array.from({ length: n }, (_, i) => i);
  const pos = mol.atoms.map((a): Vec3 => [a.x, a.y, a.z]);
  model.chiral = chiralFromCoords(model, pos);
  model.ez = ezTargets(model, pos);
  const x = flatten(pos, all);
  minimise(buildFF(model, all, { repulsion: true, chiralK: 50, fixed: opts.fixed }), x, opts.maxIterations ?? 500, 1e-3);
  const out = cloneMolecule(mol);
  out.atoms.forEach((a, i) => {
    a.x = x[i * 3];
    a.y = x[i * 3 + 1];
    a.z = x[i * 3 + 2];
  });
  return out;
}

/** @internal Exposed for gradient tests. */
export const __test = {
  energyAndGradient(mol: Molecule, coords: number[]): { energy: number; gradient: number[] } {
    const model = buildModel(mol);
    const all = Array.from({ length: model.n }, (_, i) => i);
    const pos = mol.atoms.map((a): Vec3 => [a.x, a.y, a.z]);
    model.chiral = chiralFromCoords(model, pos).map((c) => ({ ...c, sign: -c.sign }));
    model.ez = ezTargets(model, pos);
    const ff = buildFF(model, all, { repulsion: true, chiralK: 50 });
    const g = new Float64Array(coords.length);
    const energy = evaluate(ff, Float64Array.from(coords), g);
    return { energy, gradient: Array.from(g) };
  },
};
