/**
 * Types for the ADMET / drug-likeness engine.
 *
 * Everything here is plain JSON-serialisable data so a profile can be cached,
 * posted to a worker or written straight into a report.
 */

/** A named SMARTS pattern from a published filter set. */
export interface SmartsPattern {
  readonly name: string;
  readonly smarts: string;
}

/* ------------------------------------------------------------------ identity */

export interface Identity {
  /** Caller-supplied label (falls back to the input SMILES). */
  name: string;
  /** Exactly what was passed in. */
  inputSmiles: string;
  /** RDKit canonical isomeric SMILES. */
  canonicalSmiles: string;
  inchi: string;
  inchiKey: string;
  /** Molecular formula in Hill order. */
  formula: string;
}

/* --------------------------------------------------------- physicochemistry */

export interface Physicochemical {
  /** Average molecular weight (g/mol). */
  mw: number;
  exactMass: number;
  heavyAtoms: number;
  aromaticHeavyAtoms: number;
  /** Heavy atoms + hydrogens (the count Ghose's filter uses). */
  totalAtoms: number;
  heteroatoms: number;
  fractionCsp3: number;
  rotatableBonds: number;
  /** Lipinski acceptor count: number of N + O atoms. */
  hbaLipinski: number;
  /** RDKit's `NumHBA` (stricter, excludes e.g. amide nitrogen). */
  hbaRdkit: number;
  /** Lipinski donor count: number of N-H + O-H hydrogens. */
  hbdLipinski: number;
  /** RDKit's `NumHBD` (donor heavy atoms). */
  hbdRdkit: number;
  /** Wildman-Crippen molar refractivity. */
  molarRefractivity: number;
  /** Ertl TPSA including S and P contributions (the SwissADME convention). */
  tpsa: number;
  /** Ertl TPSA over N and O only (RDKit / PubChem default). */
  tpsaNoSulfurPhosphorus: number;
  formalCharge: number;
  rings: number;
  aromaticRings: number;
  aliphaticRings: number;
  saturatedRings: number;
  heterocycles: number;
  aromaticHeterocycles: number;
  spiroAtoms: number;
  bridgeheadAtoms: number;
  stereocentres: number;
  unspecifiedStereocentres: number;
}

/* -------------------------------------------------------------- lipophilicity */

export interface Lipophilicity {
  /** Wildman-Crippen log P, i.e. RDKit's `CrippenClogP`. */
  wlogp: number;
  method: string;
  reference: string;
}

/* ------------------------------------------------------------------ solubility */

export type SolubilityClass =
  | 'Insoluble'
  | 'Poorly soluble'
  | 'Moderately soluble'
  | 'Soluble'
  | 'Very soluble'
  | 'Highly soluble';

export interface Solubility {
  /** log of solubility in mol/L. */
  logS: number;
  molPerL: number;
  mgPerMl: number;
  class: SolubilityClass;
  method: string;
  reference: string;
  /** Terms of the Delaney regression, for display. */
  terms: { clogp: number; mw: number; rotatableBonds: number; aromaticProportion: number };
}

/* -------------------------------------------------------------- pharmacokinetics */

/** Ellipse in the (TPSA, WLOGP) plane; `rotation` is in radians, anticlockwise. */
export interface Ellipse {
  /** Centre x (TPSA, A^2). */
  cx: number;
  /** Centre y (WLOGP). */
  cy: number;
  /** Semi-axis along the rotated x direction. */
  rx: number;
  /** Semi-axis along the rotated y direction. */
  ry: number;
  rotation: number;
}

export interface Pharmacokinetics {
  /** BOILED-Egg white: high passive gastrointestinal absorption. */
  gastrointestinalAbsorption: 'High' | 'Low';
  /** BOILED-Egg yolk: likely passive blood-brain-barrier permeation. */
  bbbPermeant: boolean;
  /** Point plotted on the egg. */
  point: { tpsa: number; wlogp: number };
  method: string;
  reference: string;
}

/* ------------------------------------------------------------------ rule filters */

export interface RuleCriterion {
  label: string;
  value: number;
  /** Human-readable acceptance range, e.g. '<= 500'. */
  range: string;
  pass: boolean;
}

export interface RuleResult {
  name: string;
  reference: string;
  criteria: RuleCriterion[];
  violations: number;
  /** Whether the filter as a whole is satisfied (Lipinski tolerates one miss). */
  pass: boolean;
  /** Where our implementation deviates from the original (e.g. a substituted logP). */
  note?: string;
}

export interface BioavailabilityScore {
  /** Abbott score: one of 0.11, 0.17, 0.55, 0.56, 0.85. */
  score: number;
  /** Which branch of Martin's decision tree produced it. */
  basis: string;
  anionic: boolean;
  reference: string;
}

export interface DrugLikeness {
  rules: RuleResult[];
  leadLikeness: RuleResult;
  bioavailability: BioavailabilityScore;
}

/* ------------------------------------------------------------------------- QED */

export interface QedProperties {
  MW: number;
  ALOGP: number;
  HBA: number;
  HBD: number;
  PSA: number;
  ROTB: number;
  AROM: number;
  ALERTS: number;
}

export interface Qed {
  /** Weighted (WEIGHT_MEAN) QED, 0-1. */
  score: number;
  /** Unweighted variant. */
  unweighted: number;
  /** Maximal-weight variant. */
  maxWeighted: number;
  properties: QedProperties;
  /** Desirability of each property, 0-1. */
  desirability: QedProperties;
  reference: string;
}

/* --------------------------------------------------------- med-chem alerts */

export type AlertFamily = 'PAINS A' | 'PAINS B' | 'PAINS C' | 'Brenk';

export interface AlertHit {
  name: string;
  family: AlertFamily | string;
  smarts: string;
  /** One entry per distinct match; each lists the matched atom indices. */
  atomIndices: number[][];
}

export interface MedChemAlerts {
  pains: AlertHit[];
  brenk: AlertHit[];
  painsCount: number;
  brenkCount: number;
  /** Patterns this RDKit build refused to compile, by family. */
  skippedPatterns: Record<string, number>;
}

/* ------------------------------------------------------------ toxicity alerts */

export type ToxCategory = 'Ames mutagenicity' | 'Reactive / bioactivation' | 'hERG';

export interface ToxAlert {
  name: string;
  category: ToxCategory;
  description: string;
  reference: string;
  smarts: string;
  atomIndices: number[][];
}

export interface HergHeuristic {
  risk: 'Low' | 'Moderate' | 'High';
  basicCentre: boolean;
  wlogp: number;
  rationale: string;
  reference: string;
}

export interface ToxicityAlerts {
  /** Always shown with the results: these are substructure alerts, not predictions. */
  disclaimer: string;
  ames: ToxAlert[];
  reactive: ToxAlert[];
  herg: HergHeuristic;
}

/* ----------------------------------------------------------------------- radar */

export type RadarAxisKey = 'LIPO' | 'SIZE' | 'POLAR' | 'INSOLU' | 'INSATU' | 'FLEX';

export interface RadarAxisDef {
  key: RadarAxisKey;
  label: string;
  /** The underlying property, e.g. 'WLOGP'. */
  property: string;
  unit: string;
  /** Optimal window [low, high] in property units. */
  optimal: [number, number];
  /** Plot range as [centre, rim]; INSOLU runs 0 -> -10 so it may decrease. */
  display: [number, number];
}

export interface RadarAxisValue extends RadarAxisDef {
  value: number;
  inRange: boolean;
  /** Value mapped onto 0 (centre) - 1 (rim), clamped. */
  position: number;
  /** The optimal window in the same 0-1 coordinates, for drawing the pink area. */
  optimalPosition: [number, number];
}

/* ---------------------------------------------------------------------- flags */

export interface Flag {
  severity: 'info' | 'warn' | 'alert';
  text: string;
}

/* -------------------------------------------------------------------- profile */

export interface AdmetProfile {
  identity: Identity;
  physicochemical: Physicochemical;
  lipophilicity: Lipophilicity;
  solubility: Solubility;
  pharmacokinetics: Pharmacokinetics;
  drugLikeness: DrugLikeness;
  qed: Qed;
  medChemAlerts: MedChemAlerts;
  toxicityAlerts: ToxicityAlerts;
  radar: RadarAxisValue[];
  flags: Flag[];
}

export interface ProfileError {
  error: string;
  smiles: string;
  name?: string;
}
