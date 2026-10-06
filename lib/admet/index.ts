/**
 * ADMET / drug-likeness engine.
 *
 * `profileMolecule` turns a SMILES string into a SwissADME-class property
 * profile computed entirely client-side with RDKit.js. Every number comes from
 * a published method, cited on the value it produces; every rule-based
 * estimate is labelled as a rule, not a prediction. Nothing here is a machine
 * learning model - there is deliberately no CYP, P-gp or LD50 output.
 */
import type { RDKit, RDMol } from '../chem/rdkit';
import { alertCatalogStatus, medChemAlerts } from './alerts';
import { BOILED_EGG_REFERENCE, classifyEgg } from './boiled-egg';
import {
  aromaticHeavyAtoms,
  formalCharge,
  hillFormula,
  molGraph,
  round,
  tpsa,
  type RdkitDescriptors,
} from './descriptors';
import { esol } from './esol';
import { computeQed } from './qed';
import { bioavailabilityRadar } from './radar';
import {
  allRules,
  bioavailabilityScore,
  hasAcidicGroup,
  hasBasicCentre,
  leadLikeness,
  type RuleInput,
} from './rules';
import { toxicityAlerts } from './tox';
import type { AdmetProfile, Flag, Physicochemical, ProfileError } from './types';

export * from './types';
export { BOILED_EGG, isInside } from './boiled-egg';
export { RADAR_AXES } from './radar';
export { alertCatalogStatus } from './alerts';
export { solubilityClass } from './esol';
export { ads } from './qed';
export { hergHeuristic, TOX_DISCLAIMER } from './tox';

const WLOGP_REFERENCE = 'Wildman & Crippen, J. Chem. Inf. Comput. Sci. 1999, 39, 868-873';

function parse(rd: RDKit, smiles: string): RDMol {
  const trimmed = smiles.trim();
  if (!trimmed) throw new Error('Enter a SMILES string');
  let mol: RDMol | null = null;
  try {
    mol = rd.get_mol(trimmed);
  } catch {
    mol = null;
  }
  if (!mol) throw new Error(`Could not parse SMILES: ${trimmed}`);
  if (!mol.is_valid()) {
    mol.delete();
    throw new Error(`Could not parse SMILES: ${trimmed}`);
  }
  return mol;
}

function physicochemical(
  desc: RdkitDescriptors,
  tpsaWithSP: number,
  tpsaNoSP: number,
  aromaticHeavy: number,
  charge: number,
): Physicochemical {
  return {
    mw: round(desc.amw, 2),
    exactMass: round(desc.exactmw, 4),
    heavyAtoms: desc.NumHeavyAtoms,
    aromaticHeavyAtoms: aromaticHeavy,
    totalAtoms: desc.NumAtoms,
    heteroatoms: desc.NumHeteroatoms,
    fractionCsp3: round(desc.FractionCSP3, 2),
    rotatableBonds: desc.NumRotatableBonds,
    hbaLipinski: desc.lipinskiHBA,
    hbaRdkit: desc.NumHBA,
    hbdLipinski: desc.lipinskiHBD,
    hbdRdkit: desc.NumHBD,
    molarRefractivity: round(desc.CrippenMR, 2),
    tpsa: round(tpsaWithSP, 2),
    tpsaNoSulfurPhosphorus: round(tpsaNoSP, 2),
    formalCharge: charge,
    rings: desc.NumRings,
    aromaticRings: desc.NumAromaticRings,
    aliphaticRings: desc.NumAliphaticRings,
    saturatedRings: desc.NumSaturatedRings,
    heterocycles: desc.NumHeterocycles,
    aromaticHeterocycles: desc.NumAromaticHeterocycles,
    spiroAtoms: desc.NumSpiroAtoms,
    bridgeheadAtoms: desc.NumBridgeheadAtoms,
    stereocentres: desc.NumAtomStereoCenters,
    unspecifiedStereocentres: desc.NumUnspecifiedAtomStereoCenters,
  };
}

function buildFlags(p: Omit<AdmetProfile, 'flags'>): Flag[] {
  const flags: Flag[] = [];
  const lipinski = p.drugLikeness.rules[0];
  if (lipinski.violations > 0) {
    flags.push({
      severity: lipinski.violations > 1 ? 'alert' : 'warn',
      text: `${lipinski.violations} Lipinski violation${lipinski.violations > 1 ? 's' : ''}: ${lipinski.criteria
        .filter((c) => !c.pass)
        .map((c) => `${c.label} ${c.value}`)
        .join(', ')}`,
    });
  }
  const failed = p.drugLikeness.rules.filter((r) => r.name !== 'Lipinski (rule of five)' && !r.pass);
  if (failed.length) {
    flags.push({ severity: 'warn', text: `Fails the ${failed.map((r) => r.name).join(', ')} filter${failed.length > 1 ? 's' : ''}` });
  }
  for (const hit of p.medChemAlerts.pains) {
    flags.push({ severity: 'alert', text: `PAINS: ${hit.name} (${hit.family})` });
  }
  if (p.medChemAlerts.brenkCount) {
    flags.push({
      severity: 'warn',
      text: `${p.medChemAlerts.brenkCount} Brenk alert${p.medChemAlerts.brenkCount > 1 ? 's' : ''}: ${p.medChemAlerts.brenk
        .map((h) => h.name)
        .slice(0, 4)
        .join(', ')}`,
    });
  }
  for (const a of p.toxicityAlerts.ames) {
    flags.push({ severity: 'alert', text: `Ames toxicophore: ${a.name.replace(/_/g, ' ')}` });
  }
  if (p.toxicityAlerts.herg.risk !== 'Low') {
    flags.push({ severity: 'warn', text: `hERG heuristic: ${p.toxicityAlerts.herg.risk} risk - ${p.toxicityAlerts.herg.rationale}` });
  }
  if (p.pharmacokinetics.gastrointestinalAbsorption === 'Low') {
    flags.push({ severity: 'warn', text: 'Predicted low GI absorption (outside the BOILED-Egg white)' });
  }
  flags.push({
    severity: 'info',
    text: p.pharmacokinetics.bbbPermeant ? 'Predicted BBB-permeant' : 'Predicted not BBB-permeant',
  });
  if (p.solubility.class === 'Poorly soluble' || p.solubility.class === 'Insoluble') {
    flags.push({ severity: 'warn', text: `${p.solubility.class} (ESOL log S ${p.solubility.logS})` });
  }
  if (p.qed.score < 0.5) {
    flags.push({ severity: 'warn', text: `Low QED (${p.qed.score.toFixed(2)})` });
  }
  if (p.drugLikeness.bioavailability.score <= 0.17) {
    flags.push({ severity: 'warn', text: `Low Abbott bioavailability score (${p.drugLikeness.bioavailability.score})` });
  }
  const outside = p.radar.filter((a) => !a.inRange).map((a) => a.key);
  if (outside.length) {
    flags.push({ severity: 'info', text: `Outside the radar optimum: ${outside.join(', ')}` });
  }
  if (p.physicochemical.unspecifiedStereocentres > 0) {
    flags.push({
      severity: 'info',
      text: `${p.physicochemical.unspecifiedStereocentres} unspecified stereocentre${p.physicochemical.unspecifiedStereocentres > 1 ? 's' : ''}`,
    });
  }
  const rank = { alert: 0, warn: 1, info: 2 };
  return flags.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Full ADMET profile for one SMILES. Throws a clear Error on invalid input. */
export function profileMolecule(rd: RDKit, smiles: string, name?: string): AdmetProfile {
  const mol = parse(rd, smiles);
  try {
    const desc = JSON.parse(mol.get_descriptors()) as RdkitDescriptors;
    const graph = molGraph(mol);
    const tpsaWithSP = tpsa(graph, true);
    const tpsaNoSP = tpsa(graph, false);
    const wlogp = desc.CrippenClogP;
    const charge = formalCharge(graph);
    const aromaticHeavy = aromaticHeavyAtoms(graph);

    let inchi = '';
    let inchiKey = '';
    try {
      inchi = mol.get_inchi();
      inchiKey = inchi ? rd.get_inchikey_for_inchi(inchi) : '';
    } catch {
      /* InChI is optional - some structures (e.g. odd valences) have none */
    }

    const phys = physicochemical(desc, tpsaWithSP, tpsaNoSP, aromaticHeavy, charge);
    const solubility = esol({
      wlogp,
      mw: desc.amw,
      rotatableBonds: desc.NumRotatableBonds,
      aromaticHeavyAtoms: aromaticHeavy,
      heavyAtoms: desc.NumHeavyAtoms,
    });

    const ruleInput: RuleInput = {
      phys,
      wlogp: round(wlogp, 2),
      carbons: graph.atoms.filter((a) => a.z === 6).length,
    };
    const rules = allRules(ruleInput);
    const egg = classifyEgg(tpsaWithSP, wlogp);

    const partial: Omit<AdmetProfile, 'flags'> = {
      identity: {
        name: name ?? smiles.trim(),
        inputSmiles: smiles.trim(),
        canonicalSmiles: mol.get_smiles(),
        inchi,
        inchiKey,
        formula: hillFormula(graph),
      },
      physicochemical: phys,
      lipophilicity: {
        wlogp: round(wlogp, 2),
        method: 'Wildman-Crippen atomic contributions (RDKit CrippenClogP)',
        reference: WLOGP_REFERENCE,
      },
      solubility,
      pharmacokinetics: {
        ...egg,
        point: { tpsa: round(tpsaWithSP, 2), wlogp: round(wlogp, 2) },
        method: 'BOILED-Egg: WLOGP vs TPSA (S and P included)',
        reference: BOILED_EGG_REFERENCE,
      },
      drugLikeness: {
        rules,
        leadLikeness: leadLikeness(ruleInput),
        bioavailability: bioavailabilityScore({
          formalCharge: charge,
          tpsa: tpsaWithSP,
          acidic: hasAcidicGroup(rd, mol),
          basic: hasBasicCentre(rd, mol),
          passesRo5: rules[0].pass,
        }),
      },
      qed: computeQed(rd, mol, graph, desc),
      medChemAlerts: medChemAlerts(rd, mol),
      toxicityAlerts: toxicityAlerts(rd, mol, wlogp),
      radar: bioavailabilityRadar({
        wlogp,
        mw: desc.amw,
        tpsa: tpsaWithSP,
        logS: solubility.logS,
        fractionCsp3: desc.FractionCSP3,
        rotatableBonds: desc.NumRotatableBonds,
      }),
    };
    partial.qed.score = round(partial.qed.score, 4);
    partial.qed.unweighted = round(partial.qed.unweighted, 4);
    partial.qed.maxWeighted = round(partial.qed.maxWeighted, 4);
    return { ...partial, flags: buildFlags(partial) };
  } finally {
    mol.delete();
  }
}

/** Profile a batch, keeping per-molecule failures inline instead of throwing. */
export function profileMany(
  rd: RDKit,
  items: { smiles: string; name?: string }[],
): (AdmetProfile | ProfileError)[] {
  return items.map((item) => {
    try {
      return profileMolecule(rd, item.smiles, item.name);
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        smiles: item.smiles,
        ...(item.name === undefined ? {} : { name: item.name }),
      };
    }
  });
}

const CSV_COLUMNS: { header: string; value: (p: AdmetProfile) => string | number }[] = [
  { header: 'name', value: (p) => p.identity.name },
  { header: 'input_smiles', value: (p) => p.identity.inputSmiles },
  { header: 'canonical_smiles', value: (p) => p.identity.canonicalSmiles },
  { header: 'inchikey', value: (p) => p.identity.inchiKey },
  { header: 'formula', value: (p) => p.identity.formula },
  { header: 'mw', value: (p) => p.physicochemical.mw },
  { header: 'exact_mass', value: (p) => p.physicochemical.exactMass },
  { header: 'heavy_atoms', value: (p) => p.physicochemical.heavyAtoms },
  { header: 'aromatic_heavy_atoms', value: (p) => p.physicochemical.aromaticHeavyAtoms },
  { header: 'total_atoms', value: (p) => p.physicochemical.totalAtoms },
  { header: 'heteroatoms', value: (p) => p.physicochemical.heteroatoms },
  { header: 'fraction_csp3', value: (p) => p.physicochemical.fractionCsp3 },
  { header: 'rotatable_bonds', value: (p) => p.physicochemical.rotatableBonds },
  { header: 'hba_n_plus_o', value: (p) => p.physicochemical.hbaLipinski },
  { header: 'hba_rdkit', value: (p) => p.physicochemical.hbaRdkit },
  { header: 'hbd_nh_plus_oh', value: (p) => p.physicochemical.hbdLipinski },
  { header: 'hbd_rdkit', value: (p) => p.physicochemical.hbdRdkit },
  { header: 'molar_refractivity', value: (p) => p.physicochemical.molarRefractivity },
  { header: 'tpsa', value: (p) => p.physicochemical.tpsa },
  { header: 'formal_charge', value: (p) => p.physicochemical.formalCharge },
  { header: 'rings', value: (p) => p.physicochemical.rings },
  { header: 'aromatic_rings', value: (p) => p.physicochemical.aromaticRings },
  { header: 'stereocentres', value: (p) => p.physicochemical.stereocentres },
  { header: 'wlogp', value: (p) => p.lipophilicity.wlogp },
  { header: 'esol_logs', value: (p) => p.solubility.logS },
  { header: 'esol_mg_per_ml', value: (p) => p.solubility.mgPerMl },
  { header: 'solubility_class', value: (p) => p.solubility.class },
  { header: 'gi_absorption', value: (p) => p.pharmacokinetics.gastrointestinalAbsorption },
  { header: 'bbb_permeant', value: (p) => (p.pharmacokinetics.bbbPermeant ? 'yes' : 'no') },
  { header: 'lipinski_violations', value: (p) => p.drugLikeness.rules[0].violations },
  { header: 'ghose_violations', value: (p) => p.drugLikeness.rules[1].violations },
  { header: 'veber_violations', value: (p) => p.drugLikeness.rules[2].violations },
  { header: 'egan_violations', value: (p) => p.drugLikeness.rules[3].violations },
  { header: 'muegge_violations', value: (p) => p.drugLikeness.rules[4].violations },
  { header: 'lead_likeness_violations', value: (p) => p.drugLikeness.leadLikeness.violations },
  { header: 'bioavailability_score', value: (p) => p.drugLikeness.bioavailability.score },
  { header: 'qed', value: (p) => p.qed.score },
  { header: 'pains_count', value: (p) => p.medChemAlerts.painsCount },
  { header: 'pains_alerts', value: (p) => p.medChemAlerts.pains.map((h) => h.name).join('; ') },
  { header: 'brenk_count', value: (p) => p.medChemAlerts.brenkCount },
  { header: 'brenk_alerts', value: (p) => p.medChemAlerts.brenk.map((h) => h.name).join('; ') },
  { header: 'ames_alert_count', value: (p) => p.toxicityAlerts.ames.length },
  { header: 'ames_alerts', value: (p) => p.toxicityAlerts.ames.map((a) => a.name).join('; ') },
  { header: 'reactive_alert_count', value: (p) => p.toxicityAlerts.reactive.length },
  { header: 'reactive_alerts', value: (p) => p.toxicityAlerts.reactive.map((a) => a.name).join('; ') },
  { header: 'herg_risk', value: (p) => p.toxicityAlerts.herg.risk },
  { header: 'flags', value: (p) => p.flags.map((f) => f.text).join('; ') },
];

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per molecule, with the column set above. */
export function profilesToCSV(list: AdmetProfile[]): string {
  const rows = [CSV_COLUMNS.map((c) => c.header).join(',')];
  for (const p of list) rows.push(CSV_COLUMNS.map((c) => csvCell(c.value(p))).join(','));
  return rows.join('\n');
}

/** Column headers of `profilesToCSV`, for building a matching table header. */
export const CSV_HEADERS: readonly string[] = CSV_COLUMNS.map((c) => c.header);

/** Warm every SMARTS catalogue so the first profile is not the slow one. */
export function warmUp(rd: RDKit): { family: string; total: number; compiled: number }[] {
  profileMolecule(rd, 'CCO', 'ethanol');
  return alertCatalogStatus(rd).map(({ family, total, compiled }) => ({ family, total, compiled }));
}
