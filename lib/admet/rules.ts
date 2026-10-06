/**
 * Rule-based drug-likeness filters.
 *
 * Each filter reports every criterion separately, so the UI can show which
 * property failed rather than just a violation count. Where the original rule
 * was defined on a log P we cannot compute in the browser (MLOGP for Lipinski
 * as SwissADME implements it, XLOGP3 for Muegge and lead-likeness) we use
 * WLOGP and say so in `note`.
 */
import type { RDKit, RDMol } from '../chem/rdkit';
import { hasMatch, queryMol } from './smarts';
import type {
  BioavailabilityScore,
  Physicochemical,
  RuleCriterion,
  RuleResult,
} from './types';

export interface RuleInput {
  phys: Physicochemical;
  wlogp: number;
  carbons: number;
}

const WLOGP_NOTE = 'The original rule uses a log P we cannot compute client-side; WLOGP is used instead.';

function max(label: string, value: number, limit: number): RuleCriterion {
  return { label, value, range: `<= ${limit}`, pass: value <= limit };
}

function min(label: string, value: number, limit: number): RuleCriterion {
  return { label, value, range: `> ${limit}`, pass: value > limit };
}

function between(label: string, value: number, lo: number, hi: number): RuleCriterion {
  return { label, value, range: `${lo} to ${hi}`, pass: value >= lo && value <= hi };
}

function result(
  name: string,
  reference: string,
  criteria: RuleCriterion[],
  allowed: number,
  note?: string,
): RuleResult {
  const violations = criteria.filter((c) => !c.pass).length;
  const out: RuleResult = { name, reference, criteria, violations, pass: violations <= allowed };
  if (note) out.note = note;
  return out;
}

/** Lipinski's rule of five; one violation is tolerated. */
export function lipinski(input: RuleInput): RuleResult {
  const { phys, wlogp } = input;
  return result(
    'Lipinski (rule of five)',
    'Lipinski et al., Adv. Drug Deliv. Rev. 2001, 46, 3-26',
    [
      max('MW', phys.mw, 500),
      max('WLOGP', wlogp, 5),
      max('H-bond donors (NH + OH)', phys.hbdLipinski, 5),
      max('H-bond acceptors (N + O)', phys.hbaLipinski, 10),
    ],
    1,
    'Lipinski allows one violation. SwissADME applies MLOGP <= 4.15 here; we apply WLOGP <= 5, the threshold in the original paper.',
  );
}

export function ghose(input: RuleInput): RuleResult {
  const { phys, wlogp } = input;
  return result(
    'Ghose',
    'Ghose, Viswanadhan & Wendoloski, J. Comb. Chem. 1999, 1, 55-68',
    [
      between('MW', phys.mw, 160, 480),
      between('WLOGP', wlogp, -0.4, 5.6),
      between('Molar refractivity', phys.molarRefractivity, 40, 130),
      between('Total atoms', phys.totalAtoms, 20, 70),
    ],
    0,
  );
}

export function veber(input: RuleInput): RuleResult {
  const { phys } = input;
  return result(
    'Veber',
    'Veber et al., J. Med. Chem. 2002, 45, 2615-2623',
    [max('Rotatable bonds', phys.rotatableBonds, 10), max('TPSA', phys.tpsa, 140)],
    0,
  );
}

export function egan(input: RuleInput): RuleResult {
  const { phys, wlogp } = input;
  return result(
    'Egan',
    'Egan, Merz & Baldwin, J. Med. Chem. 2000, 43, 3867-3877',
    [max('WLOGP', wlogp, 5.88), max('TPSA', phys.tpsa, 131.6)],
    0,
  );
}

export function muegge(input: RuleInput): RuleResult {
  const { phys, wlogp, carbons } = input;
  return result(
    'Muegge',
    'Muegge, Heald & Brittelli, J. Med. Chem. 2001, 44, 1841-1846',
    [
      between('MW', phys.mw, 200, 600),
      between('WLOGP', wlogp, -2, 5),
      max('TPSA', phys.tpsa, 150),
      max('Rings', phys.rings, 7),
      min('Carbon atoms', carbons, 4),
      min('Heteroatoms', phys.heteroatoms, 1),
      max('Rotatable bonds', phys.rotatableBonds, 15),
      max('H-bond acceptors (N + O)', phys.hbaLipinski, 10),
      max('H-bond donors (NH + OH)', phys.hbdLipinski, 5),
    ],
    0,
    WLOGP_NOTE,
  );
}

/** Teague's lead-likeness window, in the form SwissADME reports it. */
export function leadLikeness(input: RuleInput): RuleResult {
  const { phys, wlogp } = input;
  return result(
    'Lead-likeness',
    'Teague et al., Angew. Chem. Int. Ed. 1999, 38, 3743-3748',
    [
      between('MW', phys.mw, 250, 350),
      max('WLOGP', wlogp, 3.5),
      max('Rotatable bonds', phys.rotatableBonds, 7),
    ],
    0,
    WLOGP_NOTE,
  );
}

export function allRules(input: RuleInput): RuleResult[] {
  return [lipinski(input), ghose(input), veber(input), egan(input), muegge(input)];
}

/* ------------------------------------------------- ionisation state helpers */

/** Groups that are deprotonated at pH ~6.5. */
const ACID_SMARTS: readonly string[] = [
  '[CX3](=O)[OX2H1]',
  '[CX3](=O)[OX1H0-]',
  '[$([SX4](=O)(=O)[OX2H1]),$([SX4](=O)(=O)[OX1H0-])]',
  '[$([SX3](=O)[OX2H1]),$([SX3](=O)[OX1H0-])]',
  '[$([PX4](=O)[OX2H1]),$([PX4](=O)[OX1H0-])]',
  '[CX3](=O)[NX3H1][SX4](=O)(=O)',
  '[$([#6]1:[#7H]:[#7]:[#7]:[#7]:1),$([#6]1:[#7]:[#7H]:[#7]:[#7]:1)]',
];

/**
 * Nitrogen centres basic enough to be protonated at pH ~7: sp3 amines bonded
 * only to carbon or hydrogen (so not amides, sulfonamides, anilines,
 * hydrazines or nitriles), plus amidines and guanidines.
 */
const BASE_SMARTS: readonly string[] = [
  '[NX3;H0,H1,H2;!$(N~[!#6;!#1]);!$(N-a);!$(N-C=[O,N,S]);!$(N-C#N);!$([N+])]',
  '[NX3;!$(N-a);!$(N-C=O)][CX3]=[NX2;!$(N-a)]',
];

export function hasAcidicGroup(rd: RDKit, mol: RDMol): boolean {
  return ACID_SMARTS.some((s) => {
    const q = queryMol(rd, s);
    return q ? hasMatch(mol, q) : false;
  });
}

export function hasBasicCentre(rd: RDKit, mol: RDMol): boolean {
  return BASE_SMARTS.some((s) => {
    const q = queryMol(rd, s);
    return q ? hasMatch(mol, q) : false;
  });
}

/**
 * Abbott bioavailability score: the probability that a compound shows >10 %
 * oral bioavailability in rat, or measurable Caco-2 permeability.
 *
 * Martin, Y. C. "A Bioavailability Score." J. Med. Chem. 2005, 48, 3164-3170.
 * Anionic compounds are scored on TPSA alone, everything else on whether it
 * passes the rule of five. "Anionic" means a net negative charge at pH ~6.5:
 * we take that to be an explicit negative formal charge, or an acidic group
 * with no basic centre to balance it.
 */
export function bioavailabilityScore(params: {
  formalCharge: number;
  tpsa: number;
  acidic: boolean;
  basic: boolean;
  passesRo5: boolean;
}): BioavailabilityScore {
  const reference = 'Martin, J. Med. Chem. 2005, 48, 3164-3170';
  const anionic = params.formalCharge < 0 || (params.acidic && !params.basic && params.formalCharge === 0);
  if (anionic) {
    if (params.tpsa <= 75) return { score: 0.85, basis: 'Anionic, TPSA <= 75', anionic, reference };
    if (params.tpsa <= 150) return { score: 0.56, basis: 'Anionic, TPSA 75-150', anionic, reference };
    return { score: 0.11, basis: 'Anionic, TPSA > 150', anionic, reference };
  }
  return params.passesRo5
    ? { score: 0.55, basis: 'Not anionic, passes the rule of five', anionic, reference }
    : { score: 0.17, basis: 'Not anionic, fails the rule of five', anionic, reference };
}
