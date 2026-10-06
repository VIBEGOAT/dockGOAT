/**
 * Small-molecule graph model shared by the parsers, the 3D builder, ligand
 * preparation and ADMET. Bonds carry Kekulé orders plus an aromatic flag, so a
 * molecule can always be written back to a V2000 molfile.
 */
import type { Vec3 } from './geometry';

export type BondOrder = 1 | 2 | 3;

export interface MolAtom {
  /** Element symbol, normalised ('C', 'Cl', 'H'). */
  el: string;
  x: number;
  y: number;
  z: number;
  /** Formal charge. */
  charge: number;
  aromatic: boolean;
  /** Optional atom label (PDB-style name for ligands read from PDB/MOL2). */
  name?: string;
}

export interface MolBond {
  a: number;
  b: number;
  /** Kekulé bond order. */
  order: BondOrder;
  aromatic: boolean;
  /** Molfile bond stereo flag: 0 none, 1 wedge (up), 4 either, 6 hash (down). */
  stereo?: number;
}

export interface Molecule {
  title: string;
  atoms: MolAtom[];
  bonds: MolBond[];
  /** SDF data fields and other metadata. */
  props: Record<string, string>;
}

export function atomPos(a: MolAtom): Vec3 {
  return [a.x, a.y, a.z];
}

export function cloneMolecule(m: Molecule): Molecule {
  return {
    title: m.title,
    atoms: m.atoms.map((a) => ({ ...a })),
    bonds: m.bonds.map((b) => ({ ...b })),
    props: { ...m.props },
  };
}

/** Adjacency list: for each atom, the list of [neighbourIndex, bondIndex]. */
export function adjacency(m: Molecule): [number, number][][] {
  const adj: [number, number][][] = m.atoms.map(() => []);
  m.bonds.forEach((b, i) => {
    adj[b.a].push([b.b, i]);
    adj[b.b].push([b.a, i]);
  });
  return adj;
}

export function neighbors(m: Molecule, adj = adjacency(m)): number[][] {
  return adj.map((list) => list.map(([n]) => n));
}

export function heavyAtomCount(m: Molecule): number {
  return m.atoms.reduce((n, a) => n + (a.el === 'H' ? 0 : 1), 0);
}

export function hasExplicitHydrogens(m: Molecule): boolean {
  return m.atoms.some((a) => a.el === 'H');
}

/** True when every z coordinate is ~0 (a 2D depiction rather than a conformer). */
export function isFlat(m: Molecule): boolean {
  if (m.atoms.length < 3) return false;
  return m.atoms.every((a) => Math.abs(a.z) < 1e-3);
}

/** Molecular formula in Hill order (C, H, then alphabetical). */
export function molecularFormula(m: Molecule): string {
  const counts = new Map<string, number>();
  for (const a of m.atoms) counts.set(a.el, (counts.get(a.el) ?? 0) + 1);
  const parts: string[] = [];
  const emit = (el: string) => {
    const n = counts.get(el);
    if (!n) return;
    parts.push(n === 1 ? el : `${el}${n}`);
    counts.delete(el);
  };
  if (counts.has('C')) {
    emit('C');
    emit('H');
  }
  for (const el of [...counts.keys()].sort()) emit(el);
  return parts.join('');
}

/**
 * Bonds that lie in at least one ring (i.e. are not bridges), found with
 * Tarjan's bridge algorithm in O(V + E).
 */
export function ringBondFlags(m: Molecule): boolean[] {
  const adj = adjacency(m);
  const n = m.atoms.length;
  const disc = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const isBridge = new Array<boolean>(m.bonds.length).fill(false);
  let time = 0;

  for (let root = 0; root < n; root++) {
    if (disc[root] !== -1) continue;
    // Iterative DFS: stack of [atom, parentBond, iteratorIndex].
    const stack: [number, number, number][] = [[root, -1, 0]];
    disc[root] = low[root] = time++;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [u, parentBond] = top;
      if (top[2] < adj[u].length) {
        const [v, bi] = adj[u][top[2]++];
        if (bi === parentBond) continue;
        if (disc[v] === -1) {
          disc[v] = low[v] = time++;
          stack.push([v, bi, 0]);
        } else {
          low[u] = Math.min(low[u], disc[v]);
        }
      } else {
        stack.pop();
        if (stack.length) {
          const p = stack[stack.length - 1][0];
          low[p] = Math.min(low[p], low[u]);
          if (low[u] > disc[p]) isBridge[parentBond] = true;
        }
      }
    }
  }
  return isBridge.map((b) => !b);
}

/**
 * Smallest rings through each ring bond (a practical approximation of the
 * SSSR that is exact for the fused/bridged systems found in drug-like
 * molecules). Rings are returned as ordered atom-index cycles.
 */
export function findRings(m: Molecule, maxSize = 12): number[][] {
  const adj = adjacency(m);
  const inRing = ringBondFlags(m);
  const seen = new Set<string>();
  const rings: number[][] = [];

  m.bonds.forEach((bond, bi) => {
    if (!inRing[bi]) return;
    // Shortest path from bond.a to bond.b that does not use this bond.
    const prev = new Map<number, number>([[bond.a, -1]]);
    const queue = [bond.a];
    let found = false;
    while (queue.length && !found) {
      const u = queue.shift()!;
      for (const [v, bj] of adj[u]) {
        if (bj === bi || !inRing[bj] || prev.has(v)) continue;
        prev.set(v, u);
        if (v === bond.b) {
          found = true;
          break;
        }
        queue.push(v);
      }
    }
    if (!found) return;
    const cycle: number[] = [];
    for (let at = bond.b; at !== -1; at = prev.get(at)!) cycle.push(at);
    if (cycle.length > maxSize) return;
    const key = [...cycle].sort((x, y) => x - y).join(',');
    if (seen.has(key)) return;
    seen.add(key);
    rings.push(cycle);
  });
  return rings;
}

export function bondBetween(m: Molecule, a: number, b: number): MolBond | undefined {
  return m.bonds.find((bd) => (bd.a === a && bd.b === b) || (bd.a === b && bd.b === a));
}

/** Remove atoms by index, remapping bonds. Returns the new molecule and old→new index map. */
export function removeAtoms(m: Molecule, drop: Set<number>): { mol: Molecule; map: number[] } {
  const map = new Array<number>(m.atoms.length).fill(-1);
  const atoms: MolAtom[] = [];
  m.atoms.forEach((a, i) => {
    if (drop.has(i)) return;
    map[i] = atoms.length;
    atoms.push({ ...a });
  });
  const bonds = m.bonds
    .filter((b) => map[b.a] >= 0 && map[b.b] >= 0)
    .map((b) => ({ ...b, a: map[b.a], b: map[b.b] }));
  return { mol: { title: m.title, atoms, bonds, props: { ...m.props } }, map };
}

/** Connected components as lists of atom indices, largest first. */
export function fragments(m: Molecule): number[][] {
  const adj = neighbors(m);
  const seen = new Array<boolean>(m.atoms.length).fill(false);
  const out: number[][] = [];
  for (let i = 0; i < m.atoms.length; i++) {
    if (seen[i]) continue;
    const comp: number[] = [];
    const stack = [i];
    seen[i] = true;
    while (stack.length) {
      const u = stack.pop()!;
      comp.push(u);
      for (const v of adj[u]) if (!seen[v]) {
        seen[v] = true;
        stack.push(v);
      }
    }
    out.push(comp);
  }
  return out.sort((a, b) => b.length - a.length);
}

/** Keep only the largest connected component (strips counter-ions / salts). */
export function largestFragment(m: Molecule): Molecule {
  const frags = fragments(m);
  if (frags.length <= 1) return m;
  const keep = new Set(frags[0]);
  const drop = new Set<number>();
  m.atoms.forEach((_, i) => {
    if (!keep.has(i)) drop.add(i);
  });
  return removeAtoms(m, drop).mol;
}

export function centerOfMolecule(m: Molecule): Vec3 {
  const heavy = m.atoms.filter((a) => a.el !== 'H');
  const list = heavy.length ? heavy : m.atoms;
  const c: Vec3 = [0, 0, 0];
  for (const a of list) {
    c[0] += a.x;
    c[1] += a.y;
    c[2] += a.z;
  }
  return [c[0] / list.length, c[1] / list.length, c[2] / list.length];
}
