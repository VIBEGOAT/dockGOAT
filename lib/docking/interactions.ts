/**
 * Protein–ligand interaction profiling in the style of PLIP (Salentin et al.,
 * Nucleic Acids Res 2015; Adasme et al., Nucleic Acids Res 2021).
 *
 * Detection rules and thresholds follow PLIP's `plip/basic/config.py` and
 * `plip/structure/detection.py`; feature typing (donors, acceptors, charged
 * groups, rings) is reimplemented here because PLIP relies on OpenBabel. The
 * receptor is typed from AutoDock 4 atom types when present (prepared PDBQT)
 * and from amino-acid templates otherwise; the ligand is typed from its
 * bond graph (Kekulé orders + aromatic flags) with implicit hydrogens derived
 * from standard valences, so both explicit-H and heavy-atom-only inputs work.
 *
 * When a donor's hydrogens are not modelled (crystal structures, heavy-atom
 * ligands), or can rotate freely (OH, SH, NH3+, whose modelled orientation
 * is arbitrary after preparation or docking), the hydrogen is placed at the ideal position closest to the
 * acceptor — on the cone its bond can rotate on, or at the fixed position of
 * a planar/tertiary donor — and PLIP's own D–H···A test is applied to that
 * estimate, with a heavy-atom distance cutoff of 3.5 Å instead of 4.1 Å.
 */
import { HALOGENS, METALS, element } from '../chem/elements';
import { planeNormal, type Vec3 } from '../chem/geometry';
import { findRings, type Molecule } from '../chem/molecule';
import { AMINO_ACIDS, WATER_NAMES, residueKey, type StructAtom, type Structure } from '../chem/pdb';

export type InteractionType = 'hbond' | 'hydrophobic' | 'pi-stacking' | 'pi-cation' | 'salt-bridge' | 'halogen' | 'metal';

export interface Interaction {
  type: InteractionType;
  /** residueKey of the receptor residue (or metal ion). */
  residue: string;
  resName: string;
  resSeq: number;
  chain: string;
  /** Indices into ligand.atoms. */
  ligandAtoms: number[];
  /** Indices into receptor.atoms. */
  receptorAtoms: number[];
  /** Å: donor–acceptor, atom–atom, or centroid–centroid as appropriate. */
  distance: number;
  /** Degrees: D–H···A for H-bonds with explicit H, ring-plane angle for π-stacking, C–X···A for halogen bonds. */
  angle?: number;
  detail: string;
  ligandPoint: Vec3;
  receptorPoint: Vec3;
}

export interface ContactResidue {
  residue: string;
  minDistance: number;
}

export interface InteractionReport {
  interactions: Interaction[];
  /** Receptor residues with a heavy atom within `contactCutoff` of a ligand heavy atom, closest first. */
  contactResidues: ContactResidue[];
  counts: Record<InteractionType, number>;
}

/**
 * Detection thresholds. Values marked PLIP are copied from PLIP 2.x
 * `plip/basic/config.py` (names in brackets).
 */
export const PLIP_THRESHOLDS = {
  /** PLIP [MIN_DIST]: lower bound for every distance. */
  minDist: 0.5,
  /** PLIP [HYDROPH_DIST_MAX]. */
  hydrophobicMax: 4.0,
  /** PLIP [HBOND_DIST_MAX]: donor–acceptor (Hubbard & Haider 2001, + 0.6 Å). */
  hbondMax: 4.1,
  /** PLIP [HBOND_DON_ANGLE_MIN]: D–H···A angle at H. */
  hbondDonorAngleMin: 100,
  /**
   * Not PLIP: donor–acceptor cutoff when the donor H is not modelled. The
   * idealised H can always rotate towards the acceptor, so PLIP's lenient
   * 4.1 Å would over-report; 3.5 Å is the usual heavy-atom criterion.
   */
  hbondMaxNoH: 3.5,
  /** PLIP [PISTACK_DIST_MAX]: ring centroid distance (McGaughey 1998). */
  pistackMax: 5.5,
  /** PLIP [PISTACK_ANG_DEV]: deviation from parallel / perpendicular. */
  pistackAngleDev: 30,
  /** PLIP [PISTACK_OFFSET_MAX]: also used for π–cation offsets. */
  pistackOffsetMax: 2.0,
  /** PLIP [PICATION_DIST_MAX] (Gallivan & Dougherty 1999). */
  picationMax: 6.0,
  /** PLIP [SALTBRIDGE_DIST_MAX]: between charge centres (Barlow & Thornton 1983, + 1.5 Å). */
  saltBridgeMax: 5.5,
  /** PLIP [HALOGEN_DIST_MAX]: X···A (Auffinger 2004, + 0.5 Å). */
  halogenMax: 4.0,
  /** PLIP [HALOGEN_ACC_ANGLE]: Y–A···X. */
  halogenAccAngle: 120,
  /** PLIP [HALOGEN_DON_ANGLE]: C–X···A. */
  halogenDonAngle: 165,
  /** PLIP [HALOGEN_ANGLE_DEV]. */
  halogenAngleDev: 30,
  /** PLIP [METAL_DIST_MAX] (Harding 2001). */
  metalMax: 3.0,
};

export type InteractionThresholds = typeof PLIP_THRESHOLDS;

export interface InteractionOptions {
  thresholds?: Partial<InteractionThresholds>;
  /** Treat non-water hetero groups (cofactors) as receptor; metal ions are always included. Default false. */
  includeHetero?: boolean;
  /**
   * Also count Cl/Br/I and carbon-only-bonded S as hydrophobic (default true).
   * PLIP itself only uses carbons bonded exclusively to C/H.
   */
  extendedHydrophobic?: boolean;
  /** Cutoff for `contactResidues` (default 4.5 Å). */
  contactCutoff?: number;
}

const TYPE_ORDER: InteractionType[] = ['salt-bridge', 'hbond', 'metal', 'halogen', 'pi-stacking', 'pi-cation', 'hydrophobic'];

/** Binding-site selection radius: covers the largest centre-based threshold plus group radii. */
const SITE_RADIUS = 9;

// ---------------------------------------------------------------------------
// small numeric helpers (no allocation)
// ---------------------------------------------------------------------------

function d3(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const dx = ax - bx, dy = ay - by, dz = az - bz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Angle ABC in degrees. */
function ang(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): number {
  const ux = ax - bx, uy = ay - by, uz = az - bz;
  const vx = cx - bx, vy = cy - by, vz = cz - bz;
  const nu = Math.sqrt(ux * ux + uy * uy + uz * uz);
  const nv = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (nu < 1e-9 || nv < 1e-9) return 0;
  const c = (ux * vx + uy * vy + uz * vz) / (nu * nv);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

const dist = (a: Vec3, b: Vec3) => d3(a[0], a[1], a[2], b[0], b[1], b[2]);

/** Smallest angle between two plane normals (0–90°). */
function planeAngle(n1: Vec3, n2: Vec3): number {
  const c = Math.abs(n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2]);
  return (Math.acos(Math.min(1, c)) * 180) / Math.PI;
}

/** Distance between `p` projected onto the plane (point `c`, unit normal `n`) and `c`. */
function inPlaneOffset(n: Vec3, c: Vec3, p: Vec3): number {
  const vx = p[0] - c[0], vy = p[1] - c[1], vz = p[2] - c[2];
  const t = vx * n[0] + vy * n[1] + vz * n[2];
  return Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - t * t));
}

function centroidOf(xs: number[], ys: number[], zs: number[]): Vec3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < xs.length; i++) {
    x += xs[i];
    y += ys[i];
    z += zs[i];
  }
  const n = xs.length || 1;
  return [x / n, y / n, z / n];
}

function titleCase(resName: string): string {
  return resName.length > 1 ? resName[0] + resName.slice(1).toLowerCase() : resName;
}

// ---------------------------------------------------------------------------
// ligand typing
// ---------------------------------------------------------------------------

interface Ring {
  atoms: number[];
  center: Vec3;
  normal: Vec3;
}

interface ChargeGroup {
  atoms: number[];
  center: Vec3;
  label: string;
}

interface LigandFeatures {
  heavy: number[];
  nbrs: number[][];
  /** Explicit hydrogens bonded to each atom. */
  hs: number[][];
  donors: number[];
  acceptors: number[];
  hydrophobic: number[];
  rings: Ring[];
  positive: ChargeGroup[];
  negative: ChargeGroup[];
  halogens: { x: number; c: number }[];
  metalBinders: number[];
  /** Tertiary amines: π–cation additionally needs the PLIP amine-plane check. */
  tertiaryAmines: Set<number>;
  /** Planar (sp2) nitrogens: aromatic, double-bonded or conjugated (amide, aniline). */
  planarN: Uint8Array;
  label: (i: number) => string;
}

/** Default valence after accounting for formal charge (N+ → 4, O− → 1, C± → 3). */
function targetValence(el: string, charge: number): number[] {
  switch (el) {
    case 'C':
      return [4 - Math.abs(charge)];
    case 'N':
    case 'P':
      return el === 'P' ? [3 + charge, 5 + charge] : [3 + charge];
    case 'O':
      return [2 + charge];
    case 'S':
    case 'Se':
      return [2 + charge, 4 + charge, 6 + charge];
    case 'B':
      return [3 - charge];
    default:
      return HALOGENS.has(el) ? [1 + charge] : [];
  }
}

/** Feature perception for a ligand Molecule (works with or without explicit hydrogens). */
function perceiveLigand(m: Molecule, extendedHydrophobic: boolean): LigandFeatures {
  const n = m.atoms.length;
  const atoms = m.atoms;
  const nbrs: number[][] = atoms.map(() => []);
  const bondSum = new Float64Array(n);
  const isPi = new Uint8Array(n);
  const aromatic = new Uint8Array(n);
  // Aromatic bonds without any Kekulé double bond (e.g. MOL2 'ar') count 1.5.
  const kekulized = m.bonds.some((b) => b.aromatic && b.order === 2) || !m.bonds.some((b) => b.aromatic);
  const doubleTo: number[][] = atoms.map(() => []);
  for (const b of m.bonds) {
    nbrs[b.a].push(b.b);
    nbrs[b.b].push(b.a);
    const o = b.aromatic && !kekulized ? 1.5 : b.order;
    bondSum[b.a] += o;
    bondSum[b.b] += o;
    if (b.order >= 2 || b.aromatic) {
      isPi[b.a] = 1;
      isPi[b.b] = 1;
    }
    if (b.order === 2 && !b.aromatic) {
      doubleTo[b.a].push(b.b);
      doubleTo[b.b].push(b.a);
    }
    if (b.aromatic) {
      aromatic[b.a] = 1;
      aromatic[b.b] = 1;
    }
  }
  atoms.forEach((a, i) => {
    if (a.aromatic) aromatic[i] = 1;
  });

  const heavy: number[] = [];
  const hs: number[][] = atoms.map(() => []);
  const heavyNbrs: number[][] = atoms.map(() => []);
  for (let i = 0; i < n; i++) {
    if (atoms[i].el === 'H') continue;
    heavy.push(i);
    for (const j of nbrs[i]) (atoms[j].el === 'H' ? hs[i] : heavyNbrs[i]).push(j);
  }
  const totalH = new Int32Array(n);
  for (const i of heavy) {
    const a = atoms[i];
    const vals = targetValence(a.el, a.charge);
    let implicit = 0;
    const s = bondSum[i];
    for (const v of vals) {
      if (v >= s - 1e-6) {
        implicit = Math.floor(v - s + 1e-6);
        break;
      }
    }
    totalH[i] = hs[i].length + implicit;
  }

  const el = (i: number) => atoms[i].el;
  const terminal = (i: number) => heavyNbrs[i].length === 1;
  const hasDoubleTo = (i: number, elements: string[]) => doubleTo[i].some((j) => elements.includes(el(j)));
  const oppositeChargedNeighbour = (i: number) =>
    heavyNbrs[i].some((j) => Math.sign(atoms[j].charge) === -Math.sign(atoms[i].charge) && atoms[j].charge !== 0);
  const pos = (i: number): Vec3 => [atoms[i].x, atoms[i].y, atoms[i].z];
  const centroidAtoms = (idx: number[]): Vec3 =>
    centroidOf(
      idx.map((i) => atoms[i].x),
      idx.map((i) => atoms[i].y),
      idx.map((i) => atoms[i].z),
    );

  // ---- rings: aromatic flag or planar (PLIP accepts either), 5–6 members --
  const rings: Ring[] = [];
  for (const r of findRings(m, 6)) {
    if (r.length < 5 || r.length > 6) continue;
    const pts = r.map(pos);
    if (!(r.every((i) => aromatic[i]) || ringIsPlanar(pts))) continue;
    rings.push({ atoms: r, center: centroidAtoms(r), normal: planeNormal(pts) });
  }

  // ---- ionisable groups at pH 7.4 -------------------------------------------
  const used = new Uint8Array(n);
  const positive: ChargeGroup[] = [];
  const negative: ChargeGroup[] = [];
  const tertiaryAmines = new Set<number>();

  for (const i of heavy) {
    if (el(i) !== 'C' || aromatic[i]) continue;
    const ns = heavyNbrs[i].filter((j) => el(j) === 'N');
    if (ns.length < 2 || heavyNbrs[i].length > 3) continue;
    // Amidine / guanidine with one C=N. Acyl-, sulfonyl-, cyano-, nitro- and
    // N-hydroxy substitution (amidoximes) remove the basicity; N-aryl does not.
    if (!ns.some((j) => doubleTo[i].includes(j))) continue;
    if (heavyNbrs[i].some((j) => el(j) === 'O' || el(j) === 'S')) continue;
    const deactivated = ns.some(
      (j) => aromatic[j] || heavyNbrs[j].some((k) => k !== i && ((isPi[k] && !aromatic[k]) || el(k) === 'O')),
    );
    if (deactivated) continue;
    ns.forEach((j) => (used[j] = 1));
    positive.push({ atoms: ns, center: pos(i), label: ns.length === 3 ? 'guanidine' : 'amidine' });
  }
  for (const i of heavy) {
    if (el(i) !== 'N' || used[i] || aromatic[i] || isPi[i] || atoms[i].charge < 0) continue;
    const hn = heavyNbrs[i];
    if (!hn.length || hn.length + totalH[i] > 4) continue;
    // Aliphatic amine: every neighbour an sp3 carbon (not aryl/acyl/vinyl, not N–X).
    if (!hn.every((j) => el(j) === 'C' && !isPi[j])) continue;
    used[i] = 1;
    if (hn.length === 3 && atoms[i].charge === 0) tertiaryAmines.add(i);
    positive.push({ atoms: [i], center: pos(i), label: hn.length === 4 ? 'ammonium' : 'amine' });
  }
  for (const i of heavy) {
    const e = el(i);
    const termO = heavyNbrs[i].filter((j) => el(j) === 'O' && terminal(j));
    if (e === 'C' && !aromatic[i] && termO.length === 2 && heavyNbrs[i].length <= 3) {
      termO.forEach((j) => (used[j] = 1));
      negative.push({ atoms: termO, center: centroidAtoms(termO), label: 'carboxylate' });
    } else if (e === 'P' && termO.length >= 2) {
      termO.forEach((j) => (used[j] = 1));
      negative.push({ atoms: [i, ...termO], center: pos(i), label: 'phosphate' });
    } else if (e === 'S' && termO.length >= 3) {
      termO.forEach((j) => (used[j] = 1));
      negative.push({ atoms: [i, ...termO], center: pos(i), label: 'sulfonate' });
    }
  }
  for (const r of rings) {
    // 1H-tetrazole (carboxylic-acid isostere, pKa ≈ 4.9) unless N-alkylated.
    const ns = r.atoms.filter((i) => el(i) === 'N');
    if (r.atoms.length !== 5 || ns.length !== 4) continue;
    if (ns.some((j) => heavyNbrs[j].some((k) => !r.atoms.includes(k)))) continue;
    ns.forEach((j) => (used[j] = 1));
    negative.push({ atoms: ns, center: r.center, label: 'tetrazole' });
  }
  for (const i of heavy) {
    const c = atoms[i].charge;
    if (!c || used[i] || oppositeChargedNeighbour(i)) continue; // skip nitro / N-oxide zwitterions
    used[i] = 1;
    (c > 0 ? positive : negative).push({ atoms: [i], center: pos(i), label: c > 0 ? 'cation' : 'anion' });
  }
  const cationicN = new Set<number>();
  for (const g of positive) for (const i of g.atoms) if (el(i) === 'N') cationicN.add(i);

  // ---- H-bond donors / acceptors -------------------------------------------------
  const donors: number[] = [];
  const acceptors: number[] = [];
  for (const i of heavy) {
    const e = el(i);
    const charge = atoms[i].charge;
    // Ionisable amines/amidines are treated as protonated, hence donors.
    if ((e === 'N' || e === 'O' || e === 'S') && (totalH[i] > 0 || cationicN.has(i))) donors.push(i);
    if (e === 'O') {
      // OpenBabel/PLIP exclusions: oxonium, furan O, nitro O, aryl ethers, ester alkoxy O.
      if (charge > 0 || aromatic[i]) continue;
      if (heavyNbrs[i].some((j) => el(j) === 'N' && heavyNbrs[j].filter((k) => el(k) === 'O').length >= 2)) continue;
      const hn = heavyNbrs[i];
      if (hn.length === 2 && hn.every((j) => aromatic[j])) continue;
      if (hn.length === 2 && hn.some((j) => el(j) === 'C' && hasDoubleTo(j, ['O']))) continue;
      acceptors.push(i);
    } else if (e === 'N') {
      if (charge > 0 || cationicN.has(i)) continue;
      const degree = heavyNbrs[i].length + totalH[i];
      if (degree >= 4) continue;
      // Amide, aniline, sulfonamide, pyrrole-type N: lone pair is delocalised.
      if (degree === 3 && (aromatic[i] || isPi[i] || heavyNbrs[i].some((j) => isPi[j]))) continue;
      acceptors.push(i);
    } else if (e === 'S' && charge < 0) {
      acceptors.push(i);
    }
  }

  // ---- hydrophobic, halogen donors, metal binders -----------------------------
  const hydrophobic: number[] = [];
  const halogens: { x: number; c: number }[] = [];
  const metalBinders: number[] = [];
  for (const i of heavy) {
    const e = el(i);
    const hn = heavyNbrs[i];
    if (e === 'C' && hn.every((j) => el(j) === 'C')) hydrophobic.push(i);
    else if (extendedHydrophobic && (e === 'Cl' || e === 'Br' || e === 'I') && hn.length === 1 && el(hn[0]) === 'C')
      hydrophobic.push(i);
    else if (extendedHydrophobic && e === 'S' && hn.length === 2 && hn.every((j) => el(j) === 'C') && !doubleTo[i].length)
      hydrophobic.push(i);
    if (HALOGENS.has(e)) {
      const cs = hn.filter((j) => el(j) === 'C');
      if (cs.length === 1) halogens.push({ x: i, c: cs[0] });
    }
    if (e === 'N' || e === 'O' || e === 'S') metalBinders.push(i);
  }

  const planarN = new Uint8Array(n);
  for (const i of heavy)
    if (el(i) === 'N' && (aromatic[i] || isPi[i] || heavyNbrs[i].some((j) => isPi[j]))) planarN[i] = 1;

  const label = (i: number) => atoms[i].name?.trim() || `${atoms[i].el}${i + 1}`;
  return {
    heavy,
    nbrs: heavyNbrs,
    hs,
    donors,
    acceptors,
    hydrophobic,
    rings,
    positive,
    negative,
    halogens,
    metalBinders,
    tertiaryAmines,
    planarN,
    label,
  };
}

/** PLIP's ring_is_planar: all per-atom local normals within 5° of each other (AROMATIC_PLANARITY). */
function ringIsPlanar(pts: Vec3[]): boolean {
  const k = pts.length;
  const normals: Vec3[] = [];
  for (let i = 0; i < k; i++) {
    const a = pts[i], p = pts[(i + k - 1) % k], q = pts[(i + 1) % k];
    const u: Vec3 = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const v: Vec3 = [q[0] - a[0], q[1] - a[1], q[2] - a[2]];
    const c: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(c[0], c[1], c[2]) || 1;
    normals.push([c[0] / l, c[1] / l, c[2] / l]);
  }
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) if (planeAngle(normals[i], normals[j]) > 5) return false;
  return true;
}

// ---------------------------------------------------------------------------
// receptor typing
// ---------------------------------------------------------------------------

const RES_ALIAS: Record<string, string> = {
  HID: 'HIS', HIE: 'HIS', HIP: 'HIS', HSD: 'HIS', HSE: 'HIS', HSP: 'HIS',
  CYX: 'CYS', CYM: 'CYS', ASH: 'ASP', GLH: 'GLU', LYN: 'LYS', MSE: 'MET',
};

const SC_DONORS: Record<string, string[]> = {
  SER: ['OG'], THR: ['OG1'], TYR: ['OH'], ASN: ['ND2'], GLN: ['NE2'], HIS: ['ND1', 'NE2'],
  LYS: ['NZ'], ARG: ['NE', 'NH1', 'NH2'], TRP: ['NE1'],
};
const SC_ACCEPTORS: Record<string, string[]> = {
  SER: ['OG'], THR: ['OG1'], TYR: ['OH'], ASN: ['OD1'], GLN: ['OE1'], HIS: ['ND1', 'NE2'],
  ASP: ['OD1', 'OD2'], GLU: ['OE1', 'OE2'],
};
/** Thioether sulfur: a weak acceptor. */
const WEAK_ACCEPTORS: Record<string, string[]> = { MET: ['SD', 'SE'] };
const RING_TEMPLATES: Record<string, string[][]> = {
  PHE: [['CG', 'CD1', 'CE1', 'CZ', 'CE2', 'CD2']],
  TYR: [['CG', 'CD1', 'CE1', 'CZ', 'CE2', 'CD2']],
  HIS: [['CG', 'ND1', 'CE1', 'NE2', 'CD2']],
  TRP: [
    ['CG', 'CD1', 'NE1', 'CE2', 'CD2'],
    ['CD2', 'CE2', 'CZ2', 'CH2', 'CZ3', 'CE3'],
  ],
};
/** Charged side chains as PLIP defines them (all side-chain N of ARG/HIS/LYS, O of ASP/GLU). */
const POSITIVE: Record<string, { atoms: string[]; label: string }> = {
  LYS: { atoms: ['NZ'], label: 'ammonium' },
  ARG: { atoms: ['NE', 'NH1', 'NH2'], label: 'guanidinium' },
  HIS: { atoms: ['ND1', 'NE2'], label: 'imidazolium' },
};
const NEGATIVE: Record<string, { atoms: string[]; label: string }> = {
  ASP: { atoms: ['OD1', 'OD2'], label: 'carboxylate' },
  GLU: { atoms: ['OE1', 'OE2'], label: 'carboxylate' },
};

interface RecGroup {
  atoms: number[]; // local indices
  center: Vec3;
  label: string;
}

interface RecRing {
  atoms: number[]; // local indices
  center: Vec3;
  normal: Vec3;
}

interface ReceptorSite {
  /** local → receptor.atoms index */
  idx: number[];
  atoms: StructAtom[];
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  heavyNbrs: number[][];
  hs: number[][];
  donor: Uint8Array;
  acceptor: Uint8Array;
  weakAcceptor: Uint8Array;
  hydrophobic: Uint8Array;
  rings: RecRing[];
  positive: RecGroup[];
  negative: RecGroup[];
  metals: number[];
  halAcceptors: { a: number; y: number }[];
}

function isMetalAtom(a: StructAtom): boolean {
  return a.hetero && METALS.has(a.el) && !AMINO_ACIDS.has(a.resName);
}

/** Atoms of residues with any heavy atom within `radius` of a ligand heavy atom. */
function selectSite(
  s: Structure,
  lig: { x: number[]; y: number[]; z: number[] },
  radius: number,
  includeHetero: boolean,
): number[] {
  const atoms = s.atoms;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < lig.x.length; i++) {
    minX = Math.min(minX, lig.x[i]);
    minY = Math.min(minY, lig.y[i]);
    minZ = Math.min(minZ, lig.z[i]);
    maxX = Math.max(maxX, lig.x[i]);
    maxY = Math.max(maxY, lig.y[i]);
    maxZ = Math.max(maxZ, lig.z[i]);
  }
  minX -= radius;
  minY -= radius;
  minZ -= radius;
  maxX += radius;
  maxY += radius;
  maxZ += radius;
  const r2 = radius * radius;
  const keepAtom = (a: StructAtom) => {
    if (WATER_NAMES.has(a.resName)) return false;
    if (!a.hetero || AMINO_ACIDS.has(a.resName) || isMetalAtom(a)) return true;
    return includeHetero;
  };
  const sameRes = (a: StructAtom, b: StructAtom) =>
    a.resSeq === b.resSeq && a.chain === b.chain && a.iCode === b.iCode && a.resName === b.resName;

  const out: number[] = [];
  let start = 0;
  while (start < atoms.length) {
    let end = start + 1;
    while (end < atoms.length && sameRes(atoms[end], atoms[start])) end++;
    const first = atoms[start];
    if (keepAtom(first)) {
      let near = false;
      let overlapsLigand = false;
      for (let i = start; i < end && !overlapsLigand; i++) {
        const a = atoms[i];
        if (a.el === 'H' || a.x < minX || a.x > maxX || a.y < minY || a.y > maxY || a.z < minZ || a.z > maxZ) continue;
        for (let k = 0; k < lig.x.length; k++) {
          const dx = a.x - lig.x[k], dy = a.y - lig.y[k], dz = a.z - lig.z[k];
          const dd = dx * dx + dy * dy + dz * dz;
          if (dd <= r2) near = true;
          // A hetero group sitting on the ligand is the ligand itself (left in the file).
          if (first.hetero && !isMetalAtom(first) && dd < 1) overlapsLigand = true;
        }
      }
      if (near && !overlapsLigand) for (let i = start; i < end; i++) out.push(i);
    }
    start = end;
  }
  return out;
}

function perceiveReceptor(s: Structure, idx: number[], extendedHydrophobic: boolean): ReceptorSite {
  const n = idx.length;
  const atoms = idx.map((i) => s.atoms[i]);
  const x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n);
  const cov = new Float64Array(n);
  atoms.forEach((a, i) => {
    x[i] = a.x;
    y[i] = a.y;
    z[i] = a.z;
    cov[i] = element(a.el).covalent;
  });
  const isH = (i: number) => atoms[i].el === 'H';

  // ---- covalent connectivity by distance (sweep along x) ---------------------
  const heavyNbrs: number[][] = atoms.map(() => []);
  const hs: number[][] = atoms.map(() => []);
  const hParent = new Int32Array(n).fill(-1);
  const hParentDist = new Float64Array(n).fill(Infinity);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]);
  for (let oi = 0; oi < n; oi++) {
    const i = order[oi];
    if (isMetalAtom(atoms[i])) continue;
    for (let oj = oi + 1; oj < n; oj++) {
      const j = order[oj];
      if (x[j] - x[i] > 2.8) break;
      if (isMetalAtom(atoms[j])) continue;
      const hi = isH(i), hj = isH(j);
      if (hi && hj) continue;
      const d = d3(x[i], y[i], z[i], x[j], y[j], z[j]);
      if (hi || hj) {
        const h = hi ? i : j;
        const p = hi ? j : i;
        // X–H: bonded when ≤ 1.15 Å for N/O (AutoDock HD convention), covalent + 0.3 otherwise.
        const el = atoms[p].el;
        const lim = el === 'N' || el === 'O' ? 1.15 : cov[p] + cov[h] + 0.3;
        if (d <= lim && d < hParentDist[h]) {
          hParent[h] = p;
          hParentDist[h] = d;
        }
      } else if (d <= cov[i] + cov[j] + 0.45) {
        heavyNbrs[i].push(j);
        heavyNbrs[j].push(i);
      }
    }
  }
  let hasH = false;
  for (let i = 0; i < n; i++)
    if (isH(i)) {
      hasH = true;
      if (hParent[i] >= 0) hs[hParent[i]].push(i);
    }

  const donor = new Uint8Array(n);
  const acceptor = new Uint8Array(n);
  const weakAcceptor = new Uint8Array(n);
  const hydrophobic = new Uint8Array(n);
  const rings: RecRing[] = [];
  const positive: RecGroup[] = [];
  const negative: RecGroup[] = [];
  const metals: number[] = [];
  const halAcceptors: { a: number; y: number }[] = [];

  // ---- per-residue templates -------------------------------------------------
  let start = 0;
  while (start < n) {
    let end = start + 1;
    const r0 = atoms[start];
    while (
      end < n &&
      atoms[end].resSeq === r0.resSeq &&
      atoms[end].chain === r0.chain &&
      atoms[end].iCode === r0.iCode &&
      atoms[end].resName === r0.resName
    )
      end++;
    const res = RES_ALIAS[r0.resName] ?? r0.resName;
    const byName = new Map<string, number>();
    for (let i = start; i < end; i++) byName.set(atoms[i].name, i);
    const isAA = AMINO_ACIDS.has(r0.resName);

    for (let i = start; i < end; i++) {
      const a = atoms[i];
      if (isH(i)) continue;
      if (isMetalAtom(a)) {
        metals.push(i);
        continue;
      }
      const e = a.el;
      const hn = heavyNbrs[i];
      const nH = hs[i].length;
      if (a.adType) {
        // Prepared receptor: trust the AutoDock types.
        if (a.adType === 'OA' || a.adType === 'NA') acceptor[i] = 1;
        else if (a.adType === 'SA') weakAcceptor[i] = 1;
        if ((e === 'N' || e === 'O') && nH > 0) donor[i] = 1;
      } else if (isAA) {
        const name = a.name;
        const backbone = name === 'N' || name === 'O' || name === 'OXT';
        let don = (name === 'N' && res !== 'PRO') || !!SC_DONORS[res]?.includes(name);
        let acc = name === 'O' || name === 'OXT' || !!SC_ACCEPTORS[res]?.includes(name);
        if (hasH) {
          // Explicit hydrogens decide tautomers/protonation (HID/HIE, ASH…).
          don = (e === 'N' || e === 'O') && nH > 0;
          if (e === 'N' && nH > 0) acc = false;
        }
        if (!backbone && WEAK_ACCEPTORS[res]?.includes(name)) weakAcceptor[i] = 1;
        donor[i] = don ? 1 : 0;
        acceptor[i] = acc ? 1 : 0;
      } else {
        // Unknown hetero group (cofactor): element-based typing.
        if (e === 'O') acceptor[i] = 1;
        if (e === 'N' && nH === 0 && hn.length <= 2) acceptor[i] = 1;
        if ((e === 'N' || e === 'O') && nH > 0) donor[i] = 1;
      }
      if (e === 'C' && hn.every((j) => atoms[j].el === 'C')) hydrophobic[i] = 1;
      else if (extendedHydrophobic && (e === 'S' || e === 'Se') && hn.length && hn.every((j) => atoms[j].el === 'C'))
        hydrophobic[i] = 1;
      // PLIP halogen-bond acceptor: O/N/S with exactly one C/N/P/S neighbour.
      if (e === 'O' || e === 'N' || e === 'S') {
        const ys = hn.filter((j) => ['C', 'N', 'P', 'S'].includes(atoms[j].el));
        if (ys.length === 1) halAcceptors.push({ a: i, y: ys[0] });
      }
    }

    if (isAA) {
      for (const tpl of RING_TEMPLATES[res] ?? []) {
        const ring = tpl.map((nm) => byName.get(nm));
        if (ring.some((v) => v === undefined)) continue;
        const r = ring as number[];
        const pts = r.map((i): Vec3 => [x[i], y[i], z[i]]);
        rings.push({
          atoms: r,
          center: centroidOf(r.map((i) => x[i]), r.map((i) => y[i]), r.map((i) => z[i])),
          normal: planeNormal(pts),
        });
      }
      const groupOf = (def: { atoms: string[]; label: string } | undefined) => {
        if (!def) return null;
        const g = def.atoms.map((nm) => byName.get(nm)).filter((v): v is number => v !== undefined);
        if (!g.length) return null;
        return { atoms: g, center: centroidOf(g.map((i) => x[i]), g.map((i) => y[i]), g.map((i) => z[i])), label: def.label };
      };
      const pg = groupOf(POSITIVE[res]);
      if (pg) {
        // With explicit H, only charged forms count: HIS needs both ring NH, LYS three NZ hydrogens.
        const neutral =
          hasH &&
          ((res === 'HIS' && pg.atoms.some((i) => hs[i].length === 0)) || (res === 'LYS' && hs[pg.atoms[0]].length < 3));
        if (!neutral) positive.push(pg);
      }
      const ng = groupOf(NEGATIVE[res]);
      if (ng && !(hasH && ng.atoms.some((i) => hs[i].length > 0))) negative.push(ng);
    }
    start = end;
  }

  return { idx, atoms, x, y, z, heavyNbrs, hs, donor, acceptor, weakAcceptor, hydrophobic, rings, positive, negative, metals, halAcceptors };
}

// ---------------------------------------------------------------------------
// detection
// ---------------------------------------------------------------------------

interface HBondCandidate {
  ligDonor: boolean;
  /** ligand atom index */
  lig: number;
  /** receptor local atom index */
  rec: number;
  distance: number;
  /** Measured D–H···A angle (explicit H). */
  angle?: number;
  weak: boolean;
  /** Set when, without hydrogens, both partners could be the donor. */
  ambiguous?: boolean;
}

/** Profile non-covalent interactions between a receptor structure and a posed ligand. */
export function analyzeInteractions(receptor: Structure, ligand: Molecule, opts: InteractionOptions = {}): InteractionReport {
  const T: InteractionThresholds = { ...PLIP_THRESHOLDS, ...opts.thresholds };
  const extended = opts.extendedHydrophobic ?? true;
  const contactCutoff = opts.contactCutoff ?? 4.5;
  const counts = Object.fromEntries(TYPE_ORDER.map((t) => [t, 0])) as Record<InteractionType, number>;

  const L = perceiveLigand(ligand, extended);
  const la = ligand.atoms;
  const lx = L.heavy.map((i) => la[i].x);
  const ly = L.heavy.map((i) => la[i].y);
  const lz = L.heavy.map((i) => la[i].z);
  if (!L.heavy.length) return { interactions: [], contactResidues: [], counts };

  const site = selectSite(receptor, { x: lx, y: ly, z: lz }, SITE_RADIUS, !!opts.includeHetero);
  const R = perceiveReceptor(receptor, site, extended);
  const out: Interaction[] = [];

  const lp = (i: number): Vec3 => [la[i].x, la[i].y, la[i].z];
  const rp = (i: number): Vec3 => [R.x[i], R.y[i], R.z[i]];
  const ra = (i: number) => R.atoms[i];
  const resLabel = (i: number) => `${titleCase(ra(i).resName)}${ra(i).resSeq}${ra(i).iCode}`;
  const recLabel = (i: number) => `${resLabel(i)} ${ra(i).name}`;
  const ligLabel = (i: number) => `Ligand ${L.label(i)}`;
  const push = (
    type: InteractionType,
    recLocal: number,
    ligandAtoms: number[],
    receptorLocal: number[],
    distance: number,
    detail: string,
    ligandPoint: Vec3,
    receptorPoint: Vec3,
    angle?: number,
  ) => {
    const a = ra(recLocal);
    out.push({
      type,
      residue: residueKey(a),
      resName: a.resName,
      resSeq: a.resSeq,
      chain: a.chain,
      ligandAtoms,
      receptorAtoms: receptorLocal.map((i) => R.idx[i]),
      distance: round(distance, 2),
      ...(angle !== undefined ? { angle: round(angle, 1) } : {}),
      detail,
      ligandPoint,
      receptorPoint,
    });
  };

  // ---- salt bridges (centres within 5.5 Å) ----------------------------------------
  const saltPairs: { lig: number[]; rec: number[] }[] = [];
  const salt = (lg: ChargeGroup, rg: RecGroup, ligPositive: boolean) => {
    const d = dist(lg.center, rg.center);
    if (!(d > T.minDist && d < T.saltBridgeMax)) return;
    saltPairs.push({ lig: lg.atoms, rec: rg.atoms });
    const ls = ligPositive ? '(+)' : '(−)';
    const rs = ligPositive ? '(−)' : '(+)';
    push(
      'salt-bridge',
      rg.atoms[0],
      lg.atoms,
      rg.atoms,
      d,
      `Ligand ${lg.label} ${ls} – ${resLabel(rg.atoms[0])} ${rg.label} ${rs}`,
      lg.center,
      rg.center,
    );
  };
  for (const lg of L.negative) for (const rg of R.positive) salt(lg, rg, false);
  for (const lg of L.positive) for (const rg of R.negative) salt(lg, rg, true);
  const inSaltBridge = (lig: number, rec: number) => saltPairs.some((p) => p.lig.includes(lig) && p.rec.includes(rec));

  // ---- hydrogen bonds -------------------------------------------------------------
  const hbCandidates: HBondCandidate[] = [];
  // Template N donors are planar (amide, guanidinium, ring NH) except lysine NZ and a free N-terminus.
  const recPlanarN = (r: number) => {
    const a = ra(r);
    if (a.el !== 'N') return false;
    if (a.name === 'NZ' && (RES_ALIAS[a.resName] ?? a.resName) === 'LYS') return false;
    return AMINO_ACIDS.has(a.resName) && !(a.name === 'N' && R.heavyNbrs[r].length < 2);
  };
  const tryHBond = (ligDonor: boolean, lig: number, rec: number, weak: boolean) => {
    const D = ligDonor ? lp(lig) : rp(rec);
    const A = ligDonor ? rp(rec) : lp(lig);
    const dDA = dist(D, A);
    if (!(dDA > T.minDist)) return;
    const subs = ligDonor ? L.nbrs[lig].map(lp) : R.heavyNbrs[rec].map(rp);
    const planar = ligDonor ? !!L.planarN[lig] : recPlanarN(rec);
    // Hydroxyl, thiol and sp3 NH2/NH3+ hydrogens spin freely: their modelled
    // orientation (template-built or carried through docking) is arbitrary.
    const rotatable = subs.length === 1 && !planar;
    // Ignore placeholder hydrogens (e.g. all at the origin) that are not bonded geometrically.
    const hList = rotatable
      ? []
      : (ligDonor ? L.hs[lig].map(lp) : R.hs[rec].map(rp)).filter((H) => {
          const dh = dist(D, H);
          return dh > 0.8 && dh < 1.3;
        });
    if (hList.length) {
      if (dDA >= T.hbondMax) return;
      let best = -1;
      for (const H of hList) {
        const a = ang(D[0], D[1], D[2], H[0], H[1], H[2], A[0], A[1], A[2]);
        if (a > T.hbondDonorAngleMin && a > best) best = a;
      }
      if (best < 0) return;
      hbCandidates.push({ ligDonor, lig, rec, distance: dDA, angle: best, weak });
      return;
    }
    if (dDA >= T.hbondMaxNoH) return;
    if (idealHAngle(D, A, subs, planar) <= T.hbondDonorAngleMin) return;
    hbCandidates.push({ ligDonor, lig, rec, distance: dDA, weak });
  };
  const nR = R.idx.length;
  for (const d of L.donors)
    for (let r = 0; r < nR; r++) if (R.acceptor[r] || R.weakAcceptor[r]) tryHBond(true, d, r, !R.acceptor[r]);
  for (const a of L.acceptors) for (let r = 0; r < nR; r++) if (R.donor[r]) tryHBond(false, a, r, false);

  // PLIP refinement: no H-bond between partners of the same salt bridge; one H-bond
  // per donor atom (largest D–H···A angle; shortest distance when H is not modelled).
  const bestPerDonor = new Map<string, HBondCandidate>();
  for (const c of hbCandidates) {
    if (inSaltBridge(c.lig, c.rec)) continue;
    const key = c.ligDonor ? `L${c.lig}` : `R${c.rec}`;
    const cur = bestPerDonor.get(key);
    // A rotatable idealised H reaches most acceptors equally well, so without H the closest wins.
    const better = !cur || (c.angle !== undefined ? c.angle > (cur.angle ?? 0) : c.distance < cur.distance);
    if (better) bestPerDonor.set(key, c);
  }
  // Without hydrogens a hydroxyl–hydroxyl pair passes in both directions: report it once.
  const byPair = new Map<string, HBondCandidate>();
  for (const c of bestPerDonor.values()) {
    const key = `${c.lig}:${c.rec}`;
    const cur = byPair.get(key);
    if (!cur) byPair.set(key, c);
    else if (c.angle !== undefined && cur.angle === undefined) byPair.set(key, c);
    else if (c.angle === undefined && cur.angle === undefined) cur.ambiguous = true;
  }
  for (const c of byPair.values()) {
    const donorTxt = c.ligDonor ? ligLabel(c.lig) : recLabel(c.rec);
    const accTxt = c.ligDonor ? recLabel(c.rec) : ligLabel(c.lig);
    const role = c.ambiguous ? 'donor: ambiguous' : `donor: ${c.ligDonor ? 'ligand' : 'protein'}`;
    push(
      'hbond',
      c.rec,
      [c.lig],
      [c.rec],
      c.distance,
      `${donorTxt} → ${accTxt} (${role}${c.weak ? ', weak acceptor' : ''})`,
      lp(c.lig),
      rp(c.rec),
      c.angle,
    );
  }

  // ---- π-stacking ------------------------------------------------------------------
  const stacks: { rec: RecRing; lig: Ring }[] = [];
  for (const rr of R.rings)
    for (const lr of L.rings) {
      const d = dist(rr.center, lr.center);
      if (!(d > T.minDist && d < T.pistackMax)) continue;
      const a = planeAngle(rr.normal, lr.normal);
      const offset = Math.min(inPlaneOffset(lr.normal, lr.center, rr.center), inPlaneOffset(rr.normal, rr.center, lr.center));
      if (offset >= T.pistackOffsetMax) continue;
      let kind: string | null = null;
      if (a < T.pistackAngleDev) kind = 'parallel';
      else if (a > 90 - T.pistackAngleDev) kind = 'T-shaped';
      if (!kind) continue;
      stacks.push({ rec: rr, lig: lr });
      push('pi-stacking', rr.atoms[0], lr.atoms, rr.atoms, d, kind, lr.center, rr.center, a);
    }

  // ---- π–cation (both directions) ----------------------------------------------------
  for (const lr of L.rings)
    for (const g of R.positive) {
      const d = dist(lr.center, g.center);
      if (!(d > T.minDist && d < T.picationMax)) continue;
      if (inPlaneOffset(lr.normal, lr.center, g.center) >= T.pistackOffsetMax) continue;
      // PLIP refine_pication: a histidine stacking on the same ligand ring is reported as stacking only.
      const res = RES_ALIAS[ra(g.atoms[0]).resName] ?? ra(g.atoms[0]).resName;
      if (res === 'HIS' && stacks.some((s) => s.lig === lr && s.rec.atoms.some((i) => g.atoms.includes(i)))) continue;
      push(
        'pi-cation',
        g.atoms[0],
        lr.atoms,
        g.atoms,
        d,
        `Ligand aromatic ring ··· ${resLabel(g.atoms[0])} ${g.label} (cation: protein)`,
        lr.center,
        g.center,
      );
    }
  for (const rr of R.rings)
    for (const g of L.positive) {
      const d = dist(rr.center, g.center);
      if (!(d > T.minDist && d < T.picationMax)) continue;
      if (inPlaneOffset(rr.normal, rr.center, g.center) >= T.pistackOffsetMax) continue;
      if (g.atoms.length === 1 && L.tertiaryAmines.has(g.atoms[0])) {
        // PLIP: a tertiary amine must face the ring (amine plane within 30° of the ring plane).
        const nb = L.nbrs[g.atoms[0]].map(lp);
        if (nb.length >= 3 && planeAngle(rr.normal, planeNormal(nb.slice(0, 3))) > 30) continue;
      }
      push(
        'pi-cation',
        rr.atoms[0],
        g.atoms,
        rr.atoms,
        d,
        `Ligand ${g.label} ··· ${resLabel(rr.atoms[0])} aromatic ring (cation: ligand)`,
        g.center,
        rr.center,
      );
    }

  // ---- halogen bonds (C–X···A–Y) --------------------------------------------------------
  const lo = T.halogenAccAngle - T.halogenAngleDev;
  const hi = T.halogenAccAngle + T.halogenAngleDev;
  const dlo = T.halogenDonAngle - T.halogenAngleDev;
  const dhi = T.halogenDonAngle + T.halogenAngleDev;
  for (const { x: xi, c: ci } of L.halogens) {
    const X = lp(xi);
    const C = lp(ci);
    for (const { a, y } of R.halAcceptors) {
      const A = rp(a);
      const d = dist(X, A);
      if (!(d > T.minDist && d < T.halogenMax)) continue;
      const accAngle = ang(R.x[y], R.y[y], R.z[y], A[0], A[1], A[2], X[0], X[1], X[2]);
      const donAngle = ang(C[0], C[1], C[2], X[0], X[1], X[2], A[0], A[1], A[2]);
      if (!(accAngle > lo && accAngle < hi && donAngle > dlo && donAngle < dhi)) continue;
      push('halogen', a, [xi], [a], d, `${ligLabel(xi)} → ${recLabel(a)}`, X, A, donAngle);
    }
  }

  // ---- metal coordination -------------------------------------------------------------
  for (const m of R.metals) {
    const M = rp(m);
    for (const i of L.metalBinders) {
      const d = dist(M, lp(i));
      if (!(d > T.minDist && d < T.metalMax)) continue;
      push('metal', m, [i], [m], d, `${resLabel(m)} – ${ligLabel(i)}`, lp(i), M);
    }
  }

  // ---- hydrophobic contacts (PLIP refine_hydrophobic) ------------------------------------
  interface HC {
    lig: number;
    rec: number;
    d: number;
    res: string;
  }
  let hcs: HC[] = [];
  for (const l of L.hydrophobic) {
    const P = lp(l);
    for (let r = 0; r < nR; r++) {
      if (!R.hydrophobic[r]) continue;
      const d = d3(P[0], P[1], P[2], R.x[r], R.y[r], R.z[r]);
      if (d > T.minDist && d < T.hydrophobicMax) hcs.push({ lig: l, rec: r, d, res: residueKey(R.atoms[r]) });
    }
  }
  // 1. Atoms of rings already π-stacked with each other add no hydrophobic contact.
  hcs = hcs.filter((h) => !stacks.some((s) => s.rec.atoms.includes(h.rec) && s.lig.atoms.includes(h.lig)));
  // 2. Per ligand atom and residue keep the closest contact.
  const perLigRes = new Map<string, HC>();
  for (const h of hcs) {
    const k = `${h.lig}|${h.res}`;
    const cur = perLigRes.get(k);
    if (!cur || h.d < cur.d) perLigRes.set(k, h);
  }
  // 3. Per receptor atom, bonded ligand atoms form a hydrophobic patch: keep the closest
  //    contact of each patch. (PLIP drops non-bonded singletons here; we keep them.)
  const byRec = new Map<number, HC[]>();
  for (const h of perLigRes.values()) {
    const list = byRec.get(h.rec);
    if (list) list.push(h);
    else byRec.set(h.rec, [h]);
  }
  for (const list of byRec.values()) {
    const ligSet = new Set(list.map((h) => h.lig));
    const seen = new Set<number>();
    for (const h of list) {
      if (seen.has(h.lig)) continue;
      // Flood the bonded patch containing h.lig within this receptor atom's partners.
      const stack = [h.lig];
      seen.add(h.lig);
      let best = h;
      while (stack.length) {
        const u = stack.pop()!;
        const hu = list.find((q) => q.lig === u)!;
        if (hu.d < best.d) best = hu;
        for (const v of L.nbrs[u])
          if (ligSet.has(v) && !seen.has(v)) {
            seen.add(v);
            stack.push(v);
          }
      }
      push(
        'hydrophobic',
        best.rec,
        [best.lig],
        [best.rec],
        best.d,
        `${ligLabel(best.lig)} – ${recLabel(best.rec)}`,
        lp(best.lig),
        rp(best.rec),
      );
    }
  }

  // ---- contacts and summary ----------------------------------------------------------------
  const contactResidues = nearestResidues(
    R.atoms,
    R.atoms.map((a) => a.el !== 'H'),
    L.heavy.map(lp),
    contactCutoff,
  );
  out.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.distance - b.distance);
  for (const i of out) counts[i.type]++;
  return { interactions: out, contactResidues, counts };
}

/**
 * Best D–H···A angle an unmodelled hydrogen can reach. H is put 1.0 Å from D
 * on a cone about v (the direction opposite D's heavy substituents) with
 * half-angle θ: 0° when the H position is fixed (planar N with two
 * substituents, tertiary ammonium), 60° for planar NH2, 54.7° for sp3 NH with
 * two substituents and 70.5° for a freely rotating X–H (OH, NH3+).
 */
function idealHAngle(D: Vec3, A: Vec3, subs: Vec3[], planar: boolean): number {
  const ax = A[0] - D[0], ay = A[1] - D[1], az = A[2] - D[2];
  const d = Math.sqrt(ax * ax + ay * ay + az * az);
  let vx = 0, vy = 0, vz = 0;
  for (const X of subs) {
    const ux = D[0] - X[0], uy = D[1] - X[1], uz = D[2] - X[2];
    const l = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    vx += ux / l;
    vy += uy / l;
    vz += uz / l;
  }
  const vn = Math.sqrt(vx * vx + vy * vy + vz * vz);
  if (!subs.length || vn < 1e-6 || d < 1e-6) return 180;
  const phi = Math.acos(Math.max(-1, Math.min(1, (vx * ax + vy * ay + vz * az) / (vn * d))));
  const k = subs.length;
  const thetaDeg = k >= 3 ? 0 : planar ? (k === 2 ? 0 : 60) : k === 2 ? 54.7 : 70.5;
  const delta = Math.abs(phi - (thetaDeg * Math.PI) / 180);
  const ha = Math.sqrt(1 + d * d - 2 * d * Math.cos(delta));
  const cosH = (1 + ha * ha - d * d) / (2 * ha);
  return (Math.acos(Math.max(-1, Math.min(1, cosH))) * 180) / Math.PI;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** Residues of `atoms` (filtered by `use`) within `cutoff` of any point, closest first. */
function nearestResidues(atoms: StructAtom[], use: boolean[], points: Vec3[], cutoff: number): ContactResidue[] {
  if (!points.length) return [];
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    minZ = Math.min(minZ, p[2]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
    maxZ = Math.max(maxZ, p[2]);
  }
  const best = new Map<string, number>();
  const c2 = cutoff * cutoff;
  for (let i = 0; i < atoms.length; i++) {
    if (!use[i]) continue;
    const a = atoms[i];
    if (a.x < minX - cutoff || a.x > maxX + cutoff || a.y < minY - cutoff || a.y > maxY + cutoff) continue;
    if (a.z < minZ - cutoff || a.z > maxZ + cutoff) continue;
    let m = Infinity;
    for (const p of points) {
      const dx = a.x - p[0], dy = a.y - p[1], dz = a.z - p[2];
      const dd = dx * dx + dy * dy + dz * dz;
      if (dd < m) m = dd;
    }
    if (m > c2) continue;
    const key = residueKey(a);
    const cur = best.get(key);
    if (cur === undefined || m < cur) best.set(key, m);
  }
  return [...best.entries()]
    .map(([residue, d2]) => ({ residue, minDistance: round(Math.sqrt(d2), 2) }))
    .sort((a, b) => a.minDistance - b.minDistance);
}

/**
 * Residues with a heavy atom within `cutoff` Å of any of `points` (waters
 * excluded), closest first. Useful for docked poses and pocket points alike.
 */
export function residuesNear(s: Structure, points: Vec3[], cutoff = 4.5): ContactResidue[] {
  return nearestResidues(
    s.atoms,
    s.atoms.map((a) => a.el !== 'H' && !WATER_NAMES.has(a.resName)),
    points,
    cutoff,
  );
}
