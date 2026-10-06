/**
 * Protein sequence statistics equivalent to ExPASy ProtParam
 * (Gasteiger E. et al. (2005) "Protein Identification and Analysis Tools on the
 * ExPASy Server", in J.M. Walker (ed), The Proteomics Protocols Handbook, Humana Press).
 *
 * Validated against live ProtParam output (see tests/bio.test.ts). Conventions:
 * - whitespace and digits are ignored silently (as ProtParam does);
 * - U (Sec) and O (Pyl) count as residues with defined masses and formulas;
 * - B, Z and X are listed in the composition but contribute nothing to the
 *   mass, formula, pI, extinction or GRAVY (a warning says so);
 * - any other character (including '*', '-', 'J') is ignored and reported.
 */
import { cleanSequence } from './sequence';

/** Letters in ProtParam's composition table, in its display order. */
export const PROTPARAM_LETTERS = 'ARNDCQEGHILKMFPSTWYVOUBZX';

export const RESIDUE_NAMES: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile',
  L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
  O: 'Pyl', U: 'Sec', B: 'Asx', Z: 'Glx', X: 'Xaa',
};

const AMBIGUOUS = new Set(['B', 'Z', 'X']);

/** Average residue masses (Da) used by ExPASy Compute pI/Mw and ProtParam. */
const AVG_RESIDUE_MASS: Record<string, number> = {
  A: 71.0788, R: 156.1875, N: 114.1038, D: 115.0886, C: 103.1388, Q: 128.1307, E: 129.1155,
  G: 57.0519, H: 137.1411, I: 113.1594, L: 113.1594, K: 128.1741, M: 131.1926, F: 147.1766,
  P: 97.1167, S: 87.0782, T: 101.1051, W: 186.2132, Y: 163.176, V: 99.1326, U: 150.0388, O: 237.3018,
};
const AVG_WATER = 18.01524;

type Atoms = readonly [c: number, h: number, n: number, o: number, s: number, se: number];

/** Elemental composition of each residue (amino acid minus H2O). */
const RESIDUE_ATOMS: Record<string, Atoms> = {
  A: [3, 5, 1, 1, 0, 0], R: [6, 12, 4, 1, 0, 0], N: [4, 6, 2, 2, 0, 0], D: [4, 5, 1, 3, 0, 0],
  C: [3, 5, 1, 1, 1, 0], Q: [5, 8, 2, 2, 0, 0], E: [5, 7, 1, 3, 0, 0], G: [2, 3, 1, 1, 0, 0],
  H: [6, 7, 3, 1, 0, 0], I: [6, 11, 1, 1, 0, 0], L: [6, 11, 1, 1, 0, 0], K: [6, 12, 2, 1, 0, 0],
  M: [5, 9, 1, 1, 1, 0], F: [9, 9, 1, 1, 0, 0], P: [5, 7, 1, 1, 0, 0], S: [3, 5, 1, 2, 0, 0],
  T: [4, 7, 1, 2, 0, 0], W: [11, 10, 2, 1, 0, 0], Y: [9, 9, 1, 2, 0, 0], V: [5, 9, 1, 1, 0, 0],
  U: [3, 5, 1, 1, 0, 1], O: [12, 19, 3, 2, 0, 0],
};

/** Monoisotopic masses of C, H, N, O, S, Se (Da). */
const MONO_ATOM = [12, 1.00782503207, 14.0030740048, 15.99491461956, 31.972071, 79.9165213] as const;

/** Kyte & Doolittle (1982) hydropathy scale. */
export const KYTE_DOOLITTLE: Record<string, number> = {
  A: 1.8, R: -4.5, N: -3.5, D: -3.5, C: 2.5, Q: -3.5, E: -3.5, G: -0.4, H: -3.2, I: 4.5,
  L: 3.8, K: -3.9, M: 1.9, F: 2.8, P: -1.6, S: -0.8, T: -0.7, W: -0.9, Y: -1.3, V: 4.2,
};

/** Bjellqvist et al. (1993, 1994) pK values, as used by ExPASy Compute pI/Mw. */
const PK_SIDE_POSITIVE: Record<string, number> = { K: 10.0, R: 12.0, H: 5.98 };
const PK_SIDE_NEGATIVE: Record<string, number> = { D: 4.05, E: 4.45, C: 9.0, Y: 10.0 };
const PK_NTERM: Record<string, number> = { A: 7.59, M: 7.0, S: 6.93, P: 8.36, T: 6.82, V: 7.44, E: 7.7 };
const PK_NTERM_DEFAULT = 7.5;
const PK_CTERM: Record<string, number> = { D: 4.55, E: 4.75 };
const PK_CTERM_DEFAULT = 3.55;

/** Molar extinction coefficients at 280 nm in water (Pace et al. 1995). */
export const EXT_TRP = 5500;
export const EXT_TYR = 1490;
export const EXT_CYSTINE = 125;

/**
 * N-end rule half-lives: [mammalian reticulocytes in vitro, yeast in vivo,
 * E. coli in vivo] (ProtParam documentation table, after Bachmair 1986, Gonda
 * 1989, Tobias 1991). The live web tool prints '3 min' for Lys and '10 hours'
 * for Gln in E. coli; the documented table (used here) says 2 min / >10 hours.
 */
export const HALF_LIFE: Record<string, readonly [string, string, string]> = {
  A: ['4.4 hours', '>20 hours', '>10 hours'],
  R: ['1 hour', '2 min', '2 min'],
  N: ['1.4 hours', '3 min', '>10 hours'],
  D: ['1.1 hours', '3 min', '>10 hours'],
  C: ['1.2 hours', '>20 hours', '>10 hours'],
  Q: ['0.8 hours', '10 min', '>10 hours'],
  E: ['1 hour', '30 min', '>10 hours'],
  G: ['30 hours', '>20 hours', '>10 hours'],
  H: ['3.5 hours', '10 min', '>10 hours'],
  I: ['20 hours', '30 min', '>10 hours'],
  L: ['5.5 hours', '3 min', '2 min'],
  K: ['1.3 hours', '3 min', '2 min'],
  M: ['30 hours', '>20 hours', '>10 hours'],
  F: ['1.1 hours', '3 min', '2 min'],
  P: ['>20 hours', '>20 hours', '?'],
  S: ['1.9 hours', '>20 hours', '>10 hours'],
  T: ['7.2 hours', '>20 hours', '>10 hours'],
  W: ['2.8 hours', '3 min', '2 min'],
  Y: ['2.8 hours', '10 min', '2 min'],
  V: ['100 hours', '>20 hours', '>10 hours'],
};

/**
 * Dipeptide instability weight values (DIWV) of Guruprasad, Reddy & Pandit
 * (1990) Protein Eng. 4:155-161. DIWV_ROWS[x][k] is the weight of dipeptide
 * x·DIWV_COLS[k]. Values transcribed programmatically from Biopython's
 * Bio/SeqUtils/ProtParamData.py (Copyright 2003 Yair Benita; Biopython License
 * Agreement / BSD 3-Clause License), with one correction: KQ is 24.68 (Biopython
 * has 24.64), which reproduces ExPASy's printed values for KQ-containing sequences.
 */
const DIWV_COLS = 'ACDEFGHIKLMNPQRSTVWY';
const DIWV_ROWS: Record<string, readonly number[]> = {
  A: [1, 44.94, -7.49, 1, 1, 1, -7.49, 1, 1, 1, 1, 1, 20.26, 1, 1, 1, 1, 1, 1, 1],
  C: [1, 1, 20.26, 1, 1, 1, 33.6, 1, 1, 20.26, 33.6, 1, 20.26, -6.54, 1, 1, 33.6, -6.54, 24.68, 1],
  D: [1, 1, 1, 1, -6.54, 1, 1, 1, -7.49, 1, 1, 1, 1, 1, -6.54, 20.26, -14.03, 1, 1, 1],
  E: [1, 44.94, 20.26, 33.6, 1, 1, -6.54, 20.26, 1, 1, 1, 1, 20.26, 20.26, 1, 20.26, 1, 1, -14.03, 1],
  F: [1, 1, 13.34, 1, 1, 1, 1, 1, -14.03, 1, 1, 1, 20.26, 1, 1, 1, 1, 1, 1, 33.601],
  G: [-7.49, 1, 1, -6.54, 1, 13.34, 1, -7.49, -7.49, 1, 1, -7.49, 1, 1, 1, 1, -7.49, 1, 13.34, -7.49],
  H: [1, 1, 1, 1, -9.37, -9.37, 1, 44.94, 24.68, 1, 1, 24.68, -1.88, 1, 1, 1, -6.54, 1, -1.88, 44.94],
  I: [1, 1, 1, 44.94, 1, 1, 13.34, 1, -7.49, 20.26, 1, 1, -1.88, 1, 1, 1, 1, -7.49, 1, 1],
  K: [1, 1, 1, 1, 1, -7.49, 1, -7.49, 1, -7.49, 33.6, 1, -6.54, 24.68, 33.6, 1, 1, -7.49, 1, 1],
  L: [1, 1, 1, 1, 1, 1, 1, 1, -7.49, 1, 1, 1, 20.26, 33.6, 20.26, 1, 1, 1, 24.68, 1],
  M: [13.34, 1, 1, 1, 1, 1, 58.28, 1, 1, 1, -1.88, 1, 44.94, -6.54, -6.54, 44.94, -1.88, 1, 1, 24.68],
  N: [1, -1.88, 1, 1, -14.03, -14.03, 1, 44.94, 24.68, 1, 1, 1, -1.88, -6.54, 1, 1, -7.49, 1, -9.37, 1],
  P: [20.26, -6.54, -6.54, 18.38, 20.26, 1, 1, 1, 1, 1, -6.54, 1, 20.26, 20.26, -6.54, 20.26, 1, 20.26, -1.88, 1],
  Q: [1, -6.54, 20.26, 20.26, -6.54, 1, 1, 1, 1, 1, 1, 1, 20.26, 20.26, 1, 44.94, 1, -6.54, 1, -6.54],
  R: [1, 1, 1, 1, 1, -7.49, 20.26, 1, 1, 1, 1, 13.34, 20.26, 20.26, 58.28, 44.94, 1, 1, 58.28, -6.54],
  S: [1, 33.6, 1, 20.26, 1, 1, 1, 1, 1, 1, 1, 1, 44.94, 20.26, 20.26, 20.26, 1, 1, 1, 1],
  T: [1, 1, 1, 20.26, 13.34, -7.49, 1, 1, 1, 1, 1, -14.03, 1, -6.54, 1, 1, 1, 1, -14.03, 1],
  V: [1, 1, -14.03, 1, 1, -7.49, 1, 1, -1.88, 1, 1, 1, 20.26, 1, 1, 1, -7.49, 1, 1, -6.54],
  W: [-14.03, 1, 1, 1, 1, -9.37, 24.68, 1, 1, 13.34, 24.68, 13.34, 1, 1, 1, 1, -14.03, -7.49, 1, 1],
  Y: [24.68, 1, 24.68, -6.54, 1, -7.49, 13.34, 1, 1, 1, 44.94, 1, 13.34, 1, -15.91, 1, -7.49, 1, -9.37, 13.34],
};

/** Instability weight of dipeptide `ab`, or undefined for non-standard residues. */
export function diwv(a: string, b: string): number | undefined {
  const k = DIWV_COLS.indexOf(b);
  return k < 0 ? undefined : DIWV_ROWS[a]?.[k];
}

export interface CompositionRow {
  letter: string;
  name: string;
  count: number;
  /** Percentage of `length` (0-100). */
  percent: number;
}

export interface HalfLife {
  nTerminal: string;
  mammalian: string;
  yeast: string;
  ecoli: string;
}

export interface ProtParamResult {
  /** Residues analysed: uppercase, ProtParam letters only (includes U, O, B, Z, X). */
  sequence: string;
  length: number;
  /** One row per ProtParam letter (ARNDCQEGHILKMFPSTWYV O U B Z X), zero counts included. */
  composition: CompositionRow[];
  counts: Record<string, number>;
  /** Characters dropped from the input (other than whitespace and digits). */
  ignored: { char: string; count: number }[];
  /** Number of B/Z/X positions (excluded from mass, formula, pI, GRAVY). */
  ambiguous: number;
  /** Average isotopic molecular weight (Da). */
  molecularWeight: number;
  monoisotopicMass: number;
  /** Theoretical pI (Bjellqvist pK set, ExPASy algorithm). */
  pI: number;
  /** Net charge at pH 7.4 with the same pK set. */
  chargeAtPH74: number;
  /** Asp + Glu. */
  negativeCount: number;
  /** Arg + Lys. */
  positiveCount: number;
  atoms: { C: number; H: number; N: number; O: number; S: number; Se: number };
  /** Hill-style formula as printed by ProtParam, e.g. 'C378H629N105O118S1'. */
  formula: string;
  totalAtoms: number;
  extinction: {
    /** ε280 (M⁻¹ cm⁻¹) assuming all Cys pairs form cystines. */
    cystines: number;
    /** ε280 assuming all Cys are reduced. */
    reduced: number;
    /** Abs 0.1% (= 1 g/L) for each assumption. */
    abs01Cystines: number;
    abs01Reduced: number;
  };
  /** N-end rule half-life, or null if the first residue is not one of the 20 standard amino acids. */
  halfLife: HalfLife | null;
  instabilityIndex: number;
  /** Instability index < 40. */
  stable: boolean;
  aliphaticIndex: number;
  gravy: number;
  /** Lobry (1994) aromaticity: fraction of F + W + Y. */
  aromaticity: number;
  warnings: string[];
}

function count(counts: Record<string, number>, letter: string): number {
  return counts[letter] ?? 0;
}

/** Net charge at `pH` from residue counts and the terminal residues (Henderson-Hasselbalch). */
function chargeFromCounts(counts: Record<string, number>, nTerm: string, cTerm: string, pH: number): number {
  let pos = 1 / (1 + 10 ** (pH - (PK_NTERM[nTerm] ?? PK_NTERM_DEFAULT)));
  let neg = 1 / (1 + 10 ** ((PK_CTERM[cTerm] ?? PK_CTERM_DEFAULT) - pH));
  for (const [aa, pK] of Object.entries(PK_SIDE_POSITIVE)) pos += count(counts, aa) / (1 + 10 ** (pH - pK));
  for (const [aa, pK] of Object.entries(PK_SIDE_NEGATIVE)) neg += count(counts, aa) / (1 + 10 ** (pK - pH));
  return pos - neg;
}

/** Bisection for the pH of zero net charge, as in ExPASy Compute pI/Mw (range 0-14, ε = 1e-4). */
function pIFromCounts(counts: Record<string, number>, nTerm: string, cTerm: string): number {
  let lo = 0;
  let hi = 14;
  let mid = 7;
  while (hi - lo > 1e-4) {
    mid = (lo + hi) / 2;
    if (chargeFromCounts(counts, nTerm, cTerm, mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function tally(seq: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ch of seq) counts[ch] = (counts[ch] ?? 0) + 1;
  return counts;
}

/** Net charge of a protein sequence at `pH` (Bjellqvist pK values). */
export function netCharge(sequence: string, pH: number): number {
  const seq = cleanSequence(sequence);
  if (!seq) return 0;
  return chargeFromCounts(tally(seq), seq[0], seq[seq.length - 1], pH);
}

/** Theoretical isoelectric point (ProtParam / Compute pI/Mw method). */
export function isoelectricPoint(sequence: string): number {
  const seq = cleanSequence(sequence);
  if (!seq) return NaN;
  return pIFromCounts(tally(seq), seq[0], seq[seq.length - 1]);
}

/** Split raw input into analysable residues and ignored characters. */
function prepare(input: string): { seq: string; ignored: Map<string, number> } {
  const ignored = new Map<string, number>();
  let seq = '';
  const text = input.replace(/^[>;].*$/gm, '').toUpperCase();
  for (const ch of text) {
    if (/[\s\d]/.test(ch)) continue;
    if (PROTPARAM_LETTERS.includes(ch)) seq += ch;
    else ignored.set(ch, (ignored.get(ch) ?? 0) + 1);
  }
  return { seq, ignored };
}

/**
 * Compute ProtParam statistics for a protein sequence (raw or FASTA; the
 * header line is skipped). Fields that cannot be computed (empty input) are NaN.
 */
export function protParam(sequence: string): ProtParamResult {
  const { seq, ignored } = prepare(sequence);
  const n = seq.length;
  const counts = tally(seq);
  const warnings: string[] = [];

  const composition = [...PROTPARAM_LETTERS].map((letter) => ({
    letter,
    name: RESIDUE_NAMES[letter],
    count: count(counts, letter),
    percent: n ? (count(counts, letter) * 100) / n : 0,
  }));

  let ambiguous = 0;
  for (const ch of AMBIGUOUS) ambiguous += count(counts, ch);

  // Mass and elemental composition (+ one water for the termini).
  const atoms = { C: 0, H: 0, N: 0, O: 0, S: 0, Se: 0 };
  let mw = 0;
  const defined = n - ambiguous;
  for (const [aa, k] of Object.entries(counts)) {
    const f = RESIDUE_ATOMS[aa];
    if (!f) continue;
    mw += k * AVG_RESIDUE_MASS[aa];
    atoms.C += k * f[0];
    atoms.H += k * f[1];
    atoms.N += k * f[2];
    atoms.O += k * f[3];
    atoms.S += k * f[4];
    atoms.Se += k * f[5];
  }
  if (defined > 0) {
    mw += AVG_WATER;
    atoms.H += 2;
    atoms.O += 1;
  }
  const mono =
    atoms.C * MONO_ATOM[0] +
    atoms.H * MONO_ATOM[1] +
    atoms.N * MONO_ATOM[2] +
    atoms.O * MONO_ATOM[3] +
    atoms.S * MONO_ATOM[4] +
    atoms.Se * MONO_ATOM[5];
  const formula =
    `C${atoms.C}H${atoms.H}N${atoms.N}O${atoms.O}` + (atoms.S ? `S${atoms.S}` : '') + (atoms.Se ? `Se${atoms.Se}` : '');
  const totalAtoms = atoms.C + atoms.H + atoms.N + atoms.O + atoms.S + atoms.Se;

  // Charge.
  const nTerm = seq[0] ?? '';
  const cTerm = seq[n - 1] ?? '';
  const pI = n ? pIFromCounts(counts, nTerm, cTerm) : NaN;
  const chargeAtPH74 = n ? chargeFromCounts(counts, nTerm, cTerm, 7.4) : NaN;

  // Extinction coefficients (Pace et al. 1995).
  const nW = count(counts, 'W');
  const nY = count(counts, 'Y');
  const nC = count(counts, 'C');
  const reduced = nW * EXT_TRP + nY * EXT_TYR;
  const cystines = reduced + Math.floor(nC / 2) * EXT_CYSTINE;
  const extinction = {
    cystines,
    reduced,
    abs01Cystines: mw > 0 ? cystines / mw : NaN,
    abs01Reduced: mw > 0 ? reduced / mw : NaN,
  };

  // Instability index (Guruprasad et al. 1990): II = (10 / L) * Σ DIWV(x[i] x[i+1]).
  let diwvSum = 0;
  let skipped = 0;
  for (let i = 0; i + 1 < n; i++) {
    const v = diwv(seq[i], seq[i + 1]);
    if (v === undefined) skipped++;
    else diwvSum += v;
  }
  const instabilityIndex = n ? (10 / n) * diwvSum : NaN;

  // Aliphatic index (Ikai 1980) from mole percentages.
  const pct = (aa: string) => (n ? (count(counts, aa) * 100) / n : 0);
  const aliphaticIndex = n ? pct('A') + 2.9 * pct('V') + 3.9 * (pct('I') + pct('L')) : NaN;

  // GRAVY over residues with a Kyte-Doolittle value.
  let kdSum = 0;
  let kdN = 0;
  for (const [aa, k] of Object.entries(counts)) {
    const h = KYTE_DOOLITTLE[aa];
    if (h === undefined) continue;
    kdSum += k * h;
    kdN += k;
  }
  const gravy = kdN ? kdSum / kdN : NaN;

  const hl = HALF_LIFE[nTerm];
  const halfLife = hl ? { nTerminal: nTerm, mammalian: hl[0], yeast: hl[1], ecoli: hl[2] } : null;

  if (!n) warnings.push('No amino-acid residues found.');
  if (ignored.size)
    warnings.push(
      `Ignored characters: ${[...ignored.entries()].map(([c, k]) => `'${c}'×${k}`).join(', ')}.`,
    );
  if (ambiguous)
    warnings.push(
      `${ambiguous} ambiguous position(s) (B/Z/X) are excluded from the mass, formula, pI, extinction and GRAVY.`,
    );
  const nonKd = n - kdN - ambiguous;
  if (nonKd > 0) warnings.push('Sec (U) / Pyl (O) have no hydropathy or pK values and are excluded from GRAVY and pI.');
  if (skipped) warnings.push(`${skipped} dipeptide(s) with non-standard residues were skipped in the instability index.`);
  if (n && !nW && !nY && !nC)
    warnings.push('No Trp, Tyr or Cys: the protein should not be visible by UV spectrophotometry at 280 nm.');
  else if (n && !nW)
    warnings.push('No Trp residues: the computed extinction coefficient may be off by more than 10%.');

  return {
    sequence: seq,
    length: n,
    composition,
    counts,
    ignored: [...ignored.entries()].map(([char, k]) => ({ char, count: k })),
    ambiguous,
    molecularWeight: mw,
    monoisotopicMass: mono,
    pI,
    chargeAtPH74,
    negativeCount: count(counts, 'D') + count(counts, 'E'),
    positiveCount: count(counts, 'R') + count(counts, 'K'),
    atoms,
    formula: defined > 0 ? formula : '',
    totalAtoms,
    extinction,
    halfLife,
    instabilityIndex,
    stable: instabilityIndex < 40,
    aliphaticIndex,
    gravy,
    aromaticity: n ? (count(counts, 'F') + count(counts, 'W') + count(counts, 'Y')) / n : NaN,
    warnings,
  };
}
