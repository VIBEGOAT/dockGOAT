import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { parsePDB, type StructAtom, type Structure } from '../lib/chem/pdb';
import { add, cross, dot, norm, normalize, scale, sub, type Vec3 } from '../lib/chem/geometry';
import { HALF_LIFE, isoelectricPoint, netCharge, protParam } from '../lib/bio/protparam';
import {
  RAMA_BINS,
  RAMA_TABLES,
  classifyRama,
  ramaGrid,
  ramaOutlines,
  ramachandran,
  ramachandranSummary,
} from '../lib/bio/ramachandran';
import { chainSequencesFromStructure, cleanSequence, composition, formatFasta, parseFasta } from '../lib/bio/sequence';

const pdbText = (id: string) => gunzipSync(readFileSync(new URL(`./fixtures/bio/${id}.pdb.gz`, import.meta.url))).toString('utf8');
const near = (actual: number, expected: number, tol: number, what: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: ${actual} vs ${expected} (±${tol})`);

// ---------------------------------------------------------------------------
// ProtParam: reference values copied from live ExPASy ProtParam output
// (web.expasy.org/cgi-bin/protparam, UniProt accession @ range, fetched 2026-10-06).

const UBQ = 'MQIFVKTLTGKTITLEVEPSDTIENVKAKIQDKEGIPPDQQRLIFAGKQLEDGRTLSDYNIQKESTLHLVLRLRGG';
const HEWL =
  'KVFGRCELAAAMKRHGLDNYRGYSLGNWVCAAKFESNFNTQATNRNTDGSTDYGILQINSRWWCNDGRTPGSRNLCNIPCSALLSSDITASVNCAKKIVSDGNGMNAWVAWRNRCKGTDVQAWIRGCRL';
const BSA =
  'DTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFDEHVKLVNELTEFAKTCVADESHAGCEKSLHTLFGDELCKVASLRETYGDMADCCEKQEPERNECFLSHKDDSPDLPKLKPDPN' +
  'TLCDEFKADEKKFWGKYLYEIARRHPYFYAPELLYYANKYNGVFQECCQAEDKGACLLPKIETMREKVLASSARQRLRCASIQKFGERALKAWSVARLSQKFPKAEFVEVTKLVTDLTKVHK' +
  'ECCHGDLLECADDRADLAKYICDNQDTISSKLKECCDKPLLEKSHCIAEVEKDAIPENLPPLTADFAEDKDVCKNYQEAKDAFLGSFLYEYSRRHPEYAVSVLLRLAKEYEATLEECCAKDD' +
  'PHACYSTVFDKLKHLVDEPQNLIKQNCDQFEKLGEYGFQNALIVRYTRKVPQVSTPTLVEVSRSLGKVGTRCCTKPESERMPCTEDYLSLILNRLCVLHEKTPVSEKVTKCCTESLVNRRPCF' +
  'SALTPDETYVPKAFDEKLFTFHADICTLPDTEKQIKKQTALVELLKHKPKATEEQLKTVMENFVAFVDKCCAADDKEACFAVEGPKLVVSTQTALA';

interface Ref {
  name: string;
  seq: string;
  mw: number;
  pI: number;
  formula: string;
  atoms: number;
  ext: [cystines: number, reduced: number];
  abs: [cystines: number, reduced: number];
  ii: number;
  ai: number;
  gravy: number;
  neg: number;
  pos: number;
  mammalian: string;
}

const REFS: Ref[] = [
  { name: 'ubiquitin P0CG48 1-76', seq: UBQ, mw: 8564.84, pI: 6.56, formula: 'C378H629N105O118S1', atoms: 1231, ext: [1490, 1490], abs: [0.174, 0.174], ii: 36.06, ai: 100.0, gravy: -0.489, neg: 11, pos: 11, mammalian: '30 hours' },
  { name: 'hen lysozyme P00698 19-147', seq: HEWL, mw: 14313.14, pI: 9.32, formula: 'C613H959N193O185S10', atoms: 1960, ext: [37970, 37470], abs: [2.653, 2.618], ii: 16.09, ai: 65.12, gravy: -0.472, neg: 9, pos: 17, mammalian: '1.3 hours' },
  {
    name: 'human lysozyme P61626 19-148',
    seq: 'KVFERCELARTLKRLGMDGYRGISLANWMCLAKWESGYNTRATNYNAGDRSTDYGIFQINSRYWCNDGKTPGAVNACHLSCSALLQDNIADAVACAKRVVRDPQGIRAWVAWRNRCQNRDVRQYVQGCGV',
    mw: 14700.67, pI: 9.28, formula: 'C633H992N200O186S10', atoms: 2021, ext: [36940, 36440], abs: [2.513, 2.479], ii: 32.13, ai: 69.85, gravy: -0.485, neg: 11, pos: 19, mammalian: '1.3 hours',
  },
  { name: 'insulin A chain P01308 90-110', seq: 'GIVEQCCTSICSLYQLENYCN', mw: 2383.71, pI: 3.79, formula: 'C99H155N25O35S4', atoms: 318, ext: [3230, 2980], abs: [1.355, 1.25], ii: 22.54, ai: 88.1, gravy: 0.214, neg: 2, pos: 0, mammalian: '30 hours' },
  { name: 'insulin B chain P01308 25-54', seq: 'FVNQHLCGSHLVEALYLVCGERGFFYTPKT', mw: 3429.96, pI: 6.9, formula: 'C158H234N40O42S2', atoms: 476, ext: [3105, 2980], abs: [0.905, 0.869], ii: 9.85, ai: 84.33, gravy: 0.22, neg: 2, pos: 2, mammalian: '1.1 hours' },
  { name: 'serum albumin P02769 25-607', seq: BSA, mw: 66432.96, pI: 5.6, formula: 'C2934H4615N781O897S39', atoms: 9266, ext: [42925, 40800], abs: [0.646, 0.614], ii: 40.11, ai: 76.14, gravy: -0.475, neg: 99, pos: 82, mammalian: '1.1 hours' },
  {
    name: 'haemoglobin alpha P69905 2-142',
    seq: 'VLSPADKTNVKAAWGKVGAHAGEYGAEALERMFLSFPTTKTYFPHFDLSHGSAQVKGHGKKVADALTNAVAHVDDMPNALSALSDLHAHKLRVDPVNFKLLSHCLLVTLAAHLPAEFTPAVHASLDKFLASVSTVLTSKYR',
    mw: 15126.36, pI: 8.73, formula: 'C685H1071N187O194S3', atoms: 2140, ext: [9970, 9970], abs: [0.659, 0.659], ii: 6.95, ai: 91.42, gravy: 0.035, neg: 12, pos: 14, mammalian: '100 hours',
  },
  {
    name: 'calmodulin P0DP23 2-149',
    seq: 'ADQLTEEQIAEFKEAFSLFDKDGDGTITTKELGTVMRSLGQNPTEAELQDMINEVDADGNGTIDFPEFLTMMARKMKDTDSEEEIREAFRVFDKDGNGYISAAELRHVMTNLGEKLTDEEVDEMIREADIDGDGQVNYEEFVQMMTAK',
    mw: 16706.39, pI: 4.09, formula: 'C714H1120N188O255S9', atoms: 2286, ext: [2980, 2980], abs: [0.178, 0.178], ii: 27.5, ai: 65.95, gravy: -0.671, neg: 38, pos: 14, mammalian: '4.4 hours',
  },
];

test('protParam matches ExPASy ProtParam for reference proteins', () => {
  for (const r of REFS) {
    const p = protParam(r.seq);
    assert.equal(p.length, r.seq.length, r.name);
    near(p.molecularWeight, r.mw, 0.01, `${r.name} MW`);
    near(p.pI, r.pI, 0.01, `${r.name} pI`);
    assert.equal(p.formula, r.formula, r.name);
    assert.equal(p.totalAtoms, r.atoms, r.name);
    assert.deepEqual([p.extinction.cystines, p.extinction.reduced], r.ext, r.name);
    near(p.extinction.abs01Cystines, r.abs[0], 0.0006, `${r.name} Abs 0.1% (cystines)`);
    near(p.extinction.abs01Reduced, r.abs[1], 0.0006, `${r.name} Abs 0.1% (reduced)`);
    near(p.instabilityIndex, r.ii, 0.006, `${r.name} instability`);
    assert.equal(p.stable, r.ii < 40, r.name);
    near(p.aliphaticIndex, r.ai, 0.006, `${r.name} aliphatic`);
    near(p.gravy, r.gravy, 0.0006, `${r.name} GRAVY`);
    assert.equal(p.negativeCount, r.neg, r.name);
    assert.equal(p.positiveCount, r.pos, r.name);
    assert.equal(p.halfLife?.mammalian, r.mammalian, r.name);
    assert.deepEqual(p.ignored, [], r.name);
  }
});

test('protParam pI / MW / instability follow N-terminal-specific pK values (ubiquitin fragments)', () => {
  // [start (1-based in P0CG48), pI, MW, II] from ExPASy for P0CG48 start-76.
  const frags: [number, number, number, number][] = [
    [2, 6.79, 8433.65, 37.41], [3, 6.79, 8305.52, 37.78], [4, 6.79, 8192.36, 38.16], [5, 6.77, 8045.19, 38.56],
    [6, 6.79, 7946.05, 39.36], [7, 5.71, 7817.88, 39.78], [8, 5.75, 7716.77, 40.21], [10, 5.75, 7502.51, 42.38],
    [16, 5.24, 6888.75, 46.96], [19, 7.18, 6531.39, 45.55], [20, 6.51, 6434.27, 42.8], [21, 6.78, 6347.2, 43.38],
    [25, 9.31, 5888.73, 40.39], [28, 8.43, 5547.32, 42.84], [42, 9.69, 3998.6, 49.72], [59, 9.99, 2097.45, 68.09],
    [68, 12.0, 1020.25, 55.97],
  ];
  for (const [start, pI, mw, ii] of frags) {
    const p = protParam(UBQ.slice(start - 1));
    near(p.pI, pI, 0.01, `UBQ ${start}-76 pI`);
    near(p.molecularWeight, mw, 0.01, `UBQ ${start}-76 MW`);
    near(p.instabilityIndex, ii, 0.006, `UBQ ${start}-76 II`);
  }
  // Hen lysozyme fragments starting with Cys and Trp.
  const c = protParam(HEWL.slice(5));
  near(c.pI, 9.05, 0.01, 'HEWL 24-147 pI');
  near(c.molecularWeight, 13725.42, 0.01, 'HEWL 24-147 MW');
  const w = protParam(HEWL.slice(27));
  near(w.pI, 9.01, 0.01, 'HEWL 46-147 pI');
  assert.deepEqual([w.extinction.cystines, w.extinction.reduced], [34865, 34490]);
});

test('protParam agrees with Biopython ProtParam doctest and IsoelectricPoint examples', () => {
  const seq =
    'MAEGEITTFTALTEKFNLPPGNYKKPKLLYCSNGGHFLRILPDGTVDGTRDRSDQHIQLQLSAESVGEVYIKSTETGQYLAMDTSGLLYGSQTPSEEC' +
    'LFLERLEENHYNTYTSKKHAEKNWFVGLKKNGSCKRGPRTHYGQKAILFLPLPV';
  const p = protParam(seq);
  near(p.composition.find((r) => r.letter === 'A')!.percent, 3.95, 0.005, 'A%');
  near(p.composition.find((r) => r.letter === 'L')!.percent, 11.84, 0.005, 'L%');
  near(p.molecularWeight, 17103.16, 1, 'MW (Biopython uses slightly different masses)');
  near(p.instabilityIndex, 41.98, 0.005, 'II');
  near(p.pI, 7.72, 0.005, 'pI');
  assert.equal(p.extinction.reduced, 17420);
  assert.equal(p.extinction.cystines, 17545);
  near(p.aromaticity, 0.1, 0.005, 'aromaticity');
  near(isoelectricPoint('INGAR'), 9.75, 0.005, 'INGAR pI');
  near(netCharge('INGAR', 7), 0.76, 0.005, 'INGAR charge at pH 7');
  near(isoelectricPoint('PETER'), 4.53, 0.005, 'PETER pI');
  near(netCharge('PETER', isoelectricPoint('PETER')), 0, 1e-3, 'charge at pI');
});

test('protParam masses, half-life table and charge sanity', () => {
  // Gly-Gly: C4H8N2O3, monoisotopic 132.05349, average 2 × 57.0519 + 18.01524.
  const gg = protParam('GG');
  assert.equal(gg.formula, 'C4H8N2O3');
  near(gg.monoisotopicMass, 132.05349, 1e-4, 'GG monoisotopic');
  near(gg.molecularWeight, 132.11904, 1e-4, 'GG average');
  near(protParam(UBQ).monoisotopicMass, 8559.617, 0.01, 'ubiquitin monoisotopic');
  // N-end rule (ProtParam documentation table).
  const hl = (aa: string) => protParam(aa + 'GG').halfLife;
  assert.deepEqual(hl('M'), { nTerminal: 'M', mammalian: '30 hours', yeast: '>20 hours', ecoli: '>10 hours' });
  assert.deepEqual(hl('K'), { nTerminal: 'K', mammalian: '1.3 hours', yeast: '3 min', ecoli: '2 min' });
  assert.equal(hl('P')?.ecoli, '?');
  assert.equal(hl('R')?.yeast, '2 min');
  assert.equal(Object.keys(HALF_LIFE).length, 20);
  // Charge: ubiquitin is near neutral at 7.4 and the sign flips across the pI.
  const u = protParam(UBQ);
  assert.ok(u.chargeAtPH74 < 0 && u.chargeAtPH74 > -2);
  assert.ok(netCharge(UBQ, u.pI - 1) > 0 && netCharge(UBQ, u.pI + 1) < 0);
});

test('protParam handles lowercase, FASTA headers, whitespace and non-standard letters', () => {
  const base = protParam('MQIFVK');
  const p = protParam('>sp|test some protein\nmqif vk 12\n');
  assert.equal(p.sequence, 'MQIFVK');
  assert.deepEqual(p.ignored, []);
  near(p.molecularWeight, base.molecularWeight, 1e-9, 'header/whitespace/digits ignored');

  const q = protParam('MQIFVK*-J');
  assert.equal(q.sequence, 'MQIFVK');
  assert.deepEqual(q.ignored, [{ char: '*', count: 1 }, { char: '-', count: 1 }, { char: 'J', count: 1 }]);
  assert.ok(q.warnings.some((w) => w.includes('Ignored')));

  const x = protParam('MQIFVKXBZ');
  assert.equal(x.length, 9);
  assert.equal(x.ambiguous, 3);
  near(x.molecularWeight, base.molecularWeight, 1e-9, 'B/Z/X excluded from MW');
  assert.equal(x.formula, base.formula);
  near(x.gravy, base.gravy, 1e-12, 'B/Z/X excluded from GRAVY');
  assert.equal(x.composition.find((r) => r.letter === 'X')!.count, 1);
  assert.ok(x.warnings.some((w) => w.includes('ambiguous')));

  const u = protParam('MQIFVKU');
  near(u.molecularWeight, base.molecularWeight + 150.0388, 1e-9, 'Sec mass');
  assert.match(u.formula, /S1Se1$/);
  assert.equal(u.composition.find((r) => r.letter === 'U')!.count, 1);

  const none = protParam('HLVLRLRGG');
  assert.equal(none.extinction.cystines, 0);
  assert.ok(none.warnings.some((w) => w.includes('not be visible')));

  const empty = protParam('  \n');
  assert.equal(empty.length, 0);
  assert.ok(Number.isNaN(empty.pI));
  assert.equal(empty.formula, '');
});

// ---------------------------------------------------------------------------
// Sequence helpers

test('parseFasta, cleanSequence, composition and formatFasta', () => {
  const recs = parseFasta('>sp|P0CG48|UBC_HUMAN Polyubiquitin-C\r\nMQIF VKTL\r\n; comment\n  1 tgktitle\n>empty\n>b\nAC*\n');
  assert.deepEqual(recs, [
    { id: 'sp|P0CG48|UBC_HUMAN', description: 'Polyubiquitin-C', sequence: 'MQIFVKTLTGKTITLE' },
    { id: 'empty', description: '', sequence: '' },
    { id: 'b', description: '', sequence: 'AC*' },
  ]);
  assert.deepEqual(parseFasta('acdef\nghik'), [{ id: '', description: '', sequence: 'ACDEFGHIK' }]);
  assert.deepEqual(parseFasta(''), []);

  assert.equal(cleanSequence('>hdr\nmq-if 1 vk*\n;x\n'), 'MQIFVK');
  assert.deepEqual(composition('AABC'), [
    { letter: 'A', count: 2, percent: 50 },
    { letter: 'B', count: 1, percent: 25 },
    { letter: 'C', count: 1, percent: 25 },
  ]);

  const fa = formatFasta('ubq', UBQ);
  assert.equal(fa, `>ubq\n${UBQ.slice(0, 60)}\n${UBQ.slice(60)}\n`);
  assert.equal(formatFasta('x', 'ABCDE', 2), '>x\nAB\nCD\nE\n');
  assert.equal(parseFasta(fa)[0].sequence, UBQ);
});

test('chainSequencesFromStructure reads 1UBQ and 1CRN and counts chain breaks', () => {
  const ubq = chainSequencesFromStructure(parsePDB(pdbText('1ubq')));
  assert.equal(ubq.length, 1);
  assert.equal(ubq[0].id, '1UBQ_A');
  assert.equal(ubq[0].sequence, UBQ);
  assert.equal(ubq[0].gaps, 0);
  const crn = chainSequencesFromStructure(parsePDB(pdbText('1crn')));
  assert.equal(crn[0].sequence, 'TTCCPSIVARSNFNVCRLPGTPEAICATYTGCIIIPGATCPGDYAN');

  const s = parsePDB(pdbText('1ubq'));
  s.atoms = s.atoms.filter((a) => a.resSeq < 30 || a.resSeq > 35);
  const gapped = chainSequencesFromStructure(s)[0];
  assert.equal(gapped.sequence.length, 70);
  assert.equal(gapped.gaps, 1);
});

// ---------------------------------------------------------------------------
// Ramachandran

/** Independent dihedral (Blondel & Karplus 1996 form), used only to cross-check. */
function torsion(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3): number {
  const b1 = sub(p1, p0);
  const b2 = sub(p2, p1);
  const b3 = sub(p3, p2);
  const n1 = cross(b1, b2);
  const n2 = cross(b2, b3);
  return (Math.atan2(norm(b2) * dot(b1, n2), dot(n1, n2)) * 180) / Math.PI;
}

test('ramachandran: 1UBQ and 1CRN are high quality', () => {
  const ubq = ramachandran(parsePDB(pdbText('1ubq')));
  const su = ramachandranSummary(ubq);
  assert.equal(su.total, 74); // residues 2-75
  assert.ok(su.favouredPct >= 98, `1UBQ favoured ${su.favouredPct}`);
  assert.equal(su.outlier, 0);
  near(su.favouredPct + su.allowedPct + su.outlierPct, 100, 1e-9, 'percent sum');
  assert.equal(Object.values(su.byKind).reduce((a, c) => a + c.total, 0), su.total);

  const crn = ramachandranSummary(ramachandran(parsePDB(pdbText('1crn'))));
  assert.equal(crn.total, 44);
  assert.ok(crn.favouredPct >= 90, `1CRN favoured ${crn.favouredPct}`);
  assert.ok(crn.outlier <= 2);
});

test('ramachandran: 1UBQ angles, residue kinds and independent dihedral check', () => {
  const text = pdbText('1ubq');
  const pts = ramachandran(parsePDB(text));
  const at = (n: number) => pts.find((p) => p.resSeq === n)!;

  // α-helix 23-32 near (−63, −42); β-strand 2-7 extended.
  for (let n = 23; n <= 32; n++) {
    near(at(n).phi, -63, 15, `phi ${n}`);
    near(at(n).psi, -42, 15, `psi ${n}`);
  }
  for (let n = 2; n <= 7; n++) assert.ok(at(n).phi < -85 && at(n).psi > 110, `strand ${n}`);
  for (const n of [10, 35, 47]) assert.ok(at(n).phi > 0, `Gly${n} left-handed`);

  assert.equal(at(18).kind, 'pre-proline');
  assert.equal(at(19).kind, 'proline');
  assert.equal(at(19).table, 'trans-proline');
  assert.equal(at(36).kind, 'pre-proline'); // Ile36 precedes Pro37
  assert.equal(at(37).kind, 'proline');
  assert.equal(at(3).kind, 'general');
  assert.equal(at(3).table, 'ile-val');
  assert.equal(at(10).kind, 'glycine');
  assert.ok(pts.every((p) => p.omega !== null && Math.abs(Math.abs(p.omega) - 180) < 15), 'all trans');

  // Read backbone coordinates straight from the PDB columns and recompute.
  const bb = new Map<string, Vec3>();
  for (const line of text.split('\n'))
    if (line.startsWith('ATOM  ')) {
      const name = line.slice(12, 16).trim();
      if (name === 'N' || name === 'CA' || name === 'C')
        bb.set(`${parseInt(line.slice(22, 26), 10)}${name}`, [+line.slice(30, 38), +line.slice(38, 46), +line.slice(46, 54)]);
    }
  const g = (n: number, a: string) => bb.get(`${n}${a}`)!;
  for (const p of pts) {
    const n = p.resSeq;
    near(p.phi, torsion(g(n - 1, 'C'), g(n, 'N'), g(n, 'CA'), g(n, 'C')), 1e-6, `phi ${n}`);
    near(p.psi, torsion(g(n, 'N'), g(n, 'CA'), g(n, 'C'), g(n + 1, 'N')), 1e-6, `psi ${n}`);
  }
});

/** NeRF: place D so that |CD| = bond, ∠BCD = angle and dihedral ABCD = tors (degrees). */
function place(a: Vec3, b: Vec3, c: Vec3, bond: number, angle: number, tors: number): Vec3 {
  const r = Math.PI / 180;
  const bc = normalize(sub(c, b));
  const n = normalize(cross(sub(b, a), bc));
  const m = cross(n, bc);
  const d: Vec3 = [-bond * Math.cos(angle * r), bond * Math.sin(angle * r) * Math.cos(tors * r), bond * Math.sin(angle * r) * Math.sin(tors * r)];
  return add(c, add(scale(bc, d[0]), add(scale(m, d[1]), scale(n, d[2]))));
}

/** Ideal backbone (N, CA, C only) with the given per-residue φ/ψ/ω. */
function buildChain(res: { name: string; phi: number; psi: number; omega: number }[]): Structure {
  const atoms: StructAtom[] = [];
  let N: Vec3 = [0, 0, 0];
  let CA: Vec3 = [1.458, 0, 0];
  let C: Vec3 = place([0, 1, 0], N, CA, 1.525, 111.2, 180);
  res.forEach((r, i) => {
    if (i > 0) {
      const n2 = place(N, CA, C, 1.329, 116.2, res[i - 1].psi);
      const ca2 = place(CA, C, n2, 1.458, 121.7, r.omega);
      const c2 = place(C, n2, ca2, 1.525, 111.2, r.phi);
      [N, CA, C] = [n2, ca2, c2];
    }
    for (const [name, p] of [['N', N], ['CA', CA], ['C', C]] as const)
      atoms.push({
        serial: atoms.length + 1, name, altLoc: '', resName: r.name, chain: 'A', resSeq: i + 1, iCode: '',
        x: p[0], y: p[1], z: p[2], occupancy: 1, bfactor: 0, el: name[0], hetero: false,
      });
  });
  return { title: 'ideal', atoms, ssRecords: [], conect: [], header: {} };
}

test('ramachandran recovers φ/ψ/ω of an ideal backbone and respects chain breaks', () => {
  const spec = [
    { name: 'ALA', phi: -57, psi: -47, omega: 180 },
    { name: 'ALA', phi: -57, psi: -47, omega: 180 },
    { name: 'GLY', phi: 80, psi: 10, omega: 180 },
    { name: 'ALA', phi: -120, psi: 130, omega: 180 },
    { name: 'PRO', phi: -75, psi: 150, omega: 0 },
    { name: 'ALA', phi: -140, psi: 135, omega: -175 },
    { name: 'VAL', phi: 60, psi: -120, omega: 180 },
    { name: 'ALA', phi: -60, psi: -40, omega: 180 },
  ];
  const s = buildChain(spec);
  const pts = ramachandran(s);
  assert.deepEqual(pts.map((p) => p.resSeq), [2, 3, 4, 5, 6, 7]);
  for (const p of pts) {
    const r = spec[p.resSeq - 1];
    near(p.phi, r.phi, 1e-6, `phi ${p.resSeq}`);
    near(p.psi, r.psi, 1e-6, `psi ${p.resSeq}`);
    near(Math.abs(p.omega!), Math.abs(r.omega), 1e-6, `omega ${p.resSeq}`);
  }
  const by = (n: number) => pts.find((p) => p.resSeq === n)!;
  assert.deepEqual([by(2).kind, by(2).region], ['general', 'favoured']);
  assert.deepEqual([by(3).kind, by(3).region], ['glycine', 'favoured']);
  assert.equal(by(4).kind, 'pre-proline');
  assert.deepEqual([by(5).kind, by(5).table, by(5).region], ['proline', 'cis-proline', 'favoured']);
  assert.deepEqual([by(7).kind, by(7).table, by(7).region], ['general', 'ile-val', 'outlier']);

  // Break the chain between residues 4 and 5: residue 4 loses ψ and 5 loses φ.
  for (const a of s.atoms) if (a.resSeq >= 5) a.x += 10;
  assert.deepEqual(ramachandran(s).map((p) => p.resSeq), [2, 3, 6, 7]);
  assert.deepEqual(ramachandranSummary([]).favouredPct, 0);
});

test('classifyRama regions and angle wrapping', () => {
  assert.equal(classifyRama('general', -63, -43), 'favoured'); // α
  assert.equal(classifyRama('general', -120, 130), 'favoured'); // β
  assert.equal(classifyRama('general', 0, 0), 'outlier'); // backbone clash
  assert.equal(classifyRama('general', 120, -60), 'outlier');
  assert.equal(classifyRama('general', -63 + 360, -43 - 360), 'favoured');
  assert.equal(classifyRama('general', 180, 180), classifyRama('general', -180, -180));
  assert.equal(classifyRama('glycine', 80, 0), 'favoured');
  assert.equal(classifyRama('glycine', -80, 0), 'favoured');
  assert.equal(classifyRama('trans-proline', -65, 140), 'favoured');
  assert.equal(classifyRama('trans-proline', 60, 60), 'outlier');
  assert.equal(classifyRama('pre-proline', -120, 130), 'favoured');
  assert.equal(classifyRama('cis-proline', -75, 150), 'favoured');
});

test('ramaOutlines enclose exactly the classified bins', () => {
  const inside = (loops: [number, number][][], x: number, y: number) => {
    let c = false;
    for (const l of loops)
      for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
        const [xi, yi] = l[i];
        const [xj, yj] = l[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
    return c;
  };
  const area = (loops: [number, number][][]) =>
    loops.reduce((s, l) => s + l.reduce((a, [x, y], i) => a + (x * l[(i + 1) % l.length][1] - l[(i + 1) % l.length][0] * y) / 2, 0), 0);
  let seed = 12345;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (const t of RAMA_TABLES) {
    const g = ramaGrid(t);
    const fav = g.reduce((a, v) => a + (v === 2 ? 1 : 0), 0);
    const alw = g.reduce((a, v) => a + (v >= 1 ? 1 : 0), 0);
    const o = ramaOutlines(t);
    near(area(o.favoured), fav * 4, 1e-6, `${t} favoured area`);
    near(area(o.allowed), alw * 4, 1e-6, `${t} allowed area`);
    for (const l of [...o.favoured, ...o.allowed])
      for (const [x, y] of l) assert.ok(Math.abs(x) <= 180 && Math.abs(y) <= 180 && x % 2 === 0 && y % 2 === 0);
    for (let k = 0; k < 400; k++) {
      const x = -179 + 2 * Math.floor(rand() * RAMA_BINS) + (rand() - 0.5);
      const y = -179 + 2 * Math.floor(rand() * RAMA_BINS) + (rand() - 0.5);
      const cls = classifyRama(t, x, y);
      assert.equal(inside(o.favoured, x, y), cls === 'favoured', `${t} (${x}, ${y})`);
      assert.equal(inside(o.allowed, x, y), cls !== 'outlier', `${t} (${x}, ${y})`);
    }
  }
  assert.equal(ramaOutlines('proline'), ramaOutlines('trans-proline'));
});
