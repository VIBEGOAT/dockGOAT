/**
 * SMARTS compilation cache and substructure helpers.
 *
 * Compiled query molecules live in WebAssembly memory, so they are created
 * once per RDKit instance and kept for the lifetime of the page: profiling a
 * few hundred molecules against ~700 published patterns otherwise spends all
 * its time in `get_qmol`.
 */
import type { RDKit, RDMol } from '../chem/rdkit';
import type { SmartsPattern } from './types';

export interface CompiledPattern {
  readonly name: string;
  readonly smarts: string;
  readonly qmol: RDMol;
}

export interface CompiledSet {
  readonly patterns: CompiledPattern[];
  /** Patterns this RDKit build could not parse (counted, then dropped). */
  readonly skipped: string[];
}

const queryCache = new WeakMap<RDKit, Map<string, RDMol | null>>();
const setCache = new WeakMap<RDKit, Map<string, CompiledSet>>();

/** Compile (and memoise) one SMARTS; returns null if RDKit rejects it. */
export function queryMol(rd: RDKit, smarts: string): RDMol | null {
  let cache = queryCache.get(rd);
  if (!cache) {
    cache = new Map();
    queryCache.set(rd, cache);
  }
  if (cache.has(smarts)) return cache.get(smarts)!;
  let q: RDMol | null = null;
  try {
    q = rd.get_qmol(smarts);
    if (q && !q.is_valid()) {
      q.delete();
      q = null;
    }
  } catch {
    q = null;
  }
  cache.set(smarts, q);
  return q;
}

/** Compile a whole published filter set once, keyed by `id`. */
export function compileSet(rd: RDKit, id: string, patterns: readonly SmartsPattern[]): CompiledSet {
  let cache = setCache.get(rd);
  if (!cache) {
    cache = new Map();
    setCache.set(rd, cache);
  }
  const hit = cache.get(id);
  if (hit) return hit;
  const compiled: CompiledPattern[] = [];
  const skipped: string[] = [];
  for (const p of patterns) {
    const qmol = queryMol(rd, p.smarts);
    if (qmol) compiled.push({ name: p.name, smarts: p.smarts, qmol });
    else skipped.push(p.name);
  }
  const set: CompiledSet = { patterns: compiled, skipped };
  cache.set(id, set);
  return set;
}

interface RawMatch {
  atoms?: number[];
}

/** All distinct matches of `q` in `mol`, as lists of atom indices. */
export function matchAtoms(mol: RDMol, q: RDMol): number[][] {
  let raw: unknown;
  try {
    raw = JSON.parse(mol.get_substruct_matches(q));
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return (raw as RawMatch[]).map((m) => m.atoms ?? []).filter((a) => a.length > 0);
}

/** True when `q` matches at least once (cheaper than collecting every match). */
export function hasMatch(mol: RDMol, q: RDMol): boolean {
  try {
    const raw = JSON.parse(mol.get_substruct_match(q)) as RawMatch;
    return Array.isArray(raw.atoms) && raw.atoms.length > 0;
  } catch {
    return false;
  }
}

/** Number of distinct matches of `q` in `mol`. */
export function countMatches(mol: RDMol, q: RDMol): number {
  return matchAtoms(mol, q).length;
}
