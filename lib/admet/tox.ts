/**
 * Rule-based toxicity alerts.
 *
 * Nothing here is a model prediction. Ames and bioactivation entries are
 * substructure matches against published toxicophore definitions; the hERG
 * entry is an explicitly labelled lipophilicity/basicity heuristic.
 */
import type { RDKit, RDMol } from '../chem/rdkit';
import { AMES_TOXICOPHORES, BIOACTIVATION_ALERTS, type ToxPattern } from './data/tox-alerts';
import { hasBasicCentre } from './rules';
import { compileSet, hasMatch, matchAtoms } from './smarts';
import type { HergHeuristic, ToxAlert, ToxCategory, ToxicityAlerts } from './types';

export const KAZIUS_REFERENCE = 'Kazius, McGuire & Bursi, J. Med. Chem. 2005, 48, 312-320';
export const BIOACTIVATION_REFERENCE =
  'Kalgutkar et al., Curr. Drug Metab. 2005, 6, 161-225; Stepan et al., Chem. Res. Toxicol. 2011, 24, 1345-1410';
export const HERG_REFERENCE =
  'Waring & Johnstone, Bioorg. Med. Chem. Lett. 2007, 17, 1759-1764; Jamieson et al., J. Med. Chem. 2006, 49, 5029-5046';

export const TOX_DISCLAIMER =
  'Structural alerts only. A hit flags a substructure that published work links to a liability; it is not a prediction that this molecule is toxic, and the absence of hits is not a safety claim.';

function scan(
  rd: RDKit,
  mol: RDMol,
  id: string,
  patterns: readonly ToxPattern[],
  category: ToxCategory,
  reference: string,
): ToxAlert[] {
  const set = compileSet(rd, id, patterns);
  const byName = new Map(patterns.map((p) => [p.name, p.description]));
  const hits: ToxAlert[] = [];
  for (const p of set.patterns) {
    if (!hasMatch(mol, p.qmol)) continue;
    hits.push({
      name: p.name,
      category,
      description: byName.get(p.name) ?? '',
      reference,
      smarts: p.smarts,
      atomIndices: matchAtoms(mol, p.qmol),
    });
  }
  return hits;
}

/**
 * hERG liability heuristic.
 *
 * Waring & Johnstone showed hERG inhibition rises steeply with lipophilicity,
 * and that a basic centre compounds the effect; cLogP ~3.7 is the inflection
 * they report. We therefore flag basic + lipophilic molecules as high risk and
 * strongly lipophilic neutrals as moderate. This is a coarse triage rule, not
 * an IC50 model.
 */
export function hergHeuristic(basicCentre: boolean, wlogp: number): HergHeuristic {
  let risk: HergHeuristic['risk'] = 'Low';
  let rationale = 'No basic centre and WLOGP below 4.5.';
  if (basicCentre && wlogp >= 3.7) {
    risk = 'High';
    rationale = `Basic centre with WLOGP ${wlogp.toFixed(2)} (>= 3.7): the combination most associated with hERG block.`;
  } else if (basicCentre && wlogp >= 2.5) {
    risk = 'Moderate';
    rationale = `Basic centre with WLOGP ${wlogp.toFixed(2)} (2.5-3.7).`;
  } else if (wlogp >= 4.5) {
    risk = 'Moderate';
    rationale = `WLOGP ${wlogp.toFixed(2)} (>= 4.5) without a basic centre.`;
  } else if (basicCentre) {
    rationale = `Basic centre but WLOGP ${wlogp.toFixed(2)} (< 2.5).`;
  }
  return { risk, basicCentre, wlogp, rationale, reference: HERG_REFERENCE };
}

export function toxicityAlerts(rd: RDKit, mol: RDMol, wlogp: number): ToxicityAlerts {
  return {
    disclaimer: TOX_DISCLAIMER,
    ames: scan(rd, mol, 'ames', AMES_TOXICOPHORES, 'Ames mutagenicity', KAZIUS_REFERENCE),
    reactive: scan(
      rd,
      mol,
      'bioactivation',
      BIOACTIVATION_ALERTS,
      'Reactive / bioactivation',
      BIOACTIVATION_REFERENCE,
    ),
    herg: hergHeuristic(hasBasicCentre(rd, mol), wlogp),
  };
}
