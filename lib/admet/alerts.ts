/**
 * Medicinal-chemistry substructure alerts: PAINS (families A, B and C) and
 * Brenk's unwanted functionality.
 *
 * Both SMARTS sets are RDKit's FilterCatalog data (see lib/admet/data). A hit
 * is a reason to look at the molecule, not a verdict: PAINS flags frequent
 * assay interference, Brenk flags groups that are reactive, metabolically
 * labile or otherwise undesirable in a screening library.
 */
import type { RDKit, RDMol } from '../chem/rdkit';
import { BRENK } from './data/brenk';
import { PAINS_A, PAINS_B, PAINS_C } from './data/pains';
import { compileSet, hasMatch, matchAtoms } from './smarts';
import type { AlertFamily, AlertHit, MedChemAlerts, SmartsPattern } from './types';

export const PAINS_REFERENCE = 'Baell & Holloway, J. Med. Chem. 2010, 53, 2719-2740';
export const BRENK_REFERENCE = 'Brenk et al., ChemMedChem 2008, 3, 435-444';

const FAMILIES: { id: string; family: AlertFamily; patterns: readonly SmartsPattern[] }[] = [
  { id: 'pains_a', family: 'PAINS A', patterns: PAINS_A },
  { id: 'pains_b', family: 'PAINS B', patterns: PAINS_B },
  { id: 'pains_c', family: 'PAINS C', patterns: PAINS_C },
  { id: 'brenk', family: 'Brenk', patterns: BRENK },
];

function scanFamily(
  rd: RDKit,
  mol: RDMol,
  id: string,
  family: AlertFamily,
  patterns: readonly SmartsPattern[],
): { hits: AlertHit[]; skipped: number } {
  const set = compileSet(rd, id, patterns);
  const hits: AlertHit[] = [];
  for (const p of set.patterns) {
    if (!hasMatch(mol, p.qmol)) continue;
    hits.push({ name: p.name, family, smarts: p.smarts, atomIndices: matchAtoms(mol, p.qmol) });
  }
  return { hits, skipped: set.skipped.length };
}

/** Run every PAINS and Brenk pattern against `mol`. */
export function medChemAlerts(rd: RDKit, mol: RDMol): MedChemAlerts {
  const pains: AlertHit[] = [];
  const brenk: AlertHit[] = [];
  const skippedPatterns: Record<string, number> = {};
  for (const f of FAMILIES) {
    const { hits, skipped } = scanFamily(rd, mol, f.id, f.family, f.patterns);
    if (skipped) skippedPatterns[f.family] = skipped;
    if (f.family === 'Brenk') brenk.push(...hits);
    else pains.push(...hits);
  }
  return { pains, brenk, painsCount: pains.length, brenkCount: brenk.length, skippedPatterns };
}

/** Patterns per family this RDKit build rejected; useful for a start-up check. */
export function alertCatalogStatus(rd: RDKit): { family: string; total: number; compiled: number; skipped: string[] }[] {
  return FAMILIES.map((f) => {
    const set = compileSet(rd, f.id, f.patterns);
    return {
      family: f.family,
      total: f.patterns.length,
      compiled: set.patterns.length,
      skipped: set.skipped,
    };
  });
}
