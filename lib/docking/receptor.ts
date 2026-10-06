/**
 * Receptor preparation: PDB/mmCIF structure → rigid AutoDock PDBQT.
 *
 * Mirrors what MGLTools' prepare_receptor4 does for Vina: strip waters and
 * unwanted hetero groups, rebuild polar hydrogens from residue templates (so
 * Vina can recognise H-bond donors), and assign AutoDock 4 atom types. Vina's
 * scoring is heavy-atom based and ignores partial charges, so non-polar
 * hydrogens are not added and the charge column is written as zero.
 */
import { add, cross, dist, normalize, scale, sub, type Vec3 } from '../chem/geometry';
import {
  AMINO_ACIDS,
  WATER_NAMES,
  atomVec,
  formatAtomLine,
  residueKey,
  residues,
  type StructAtom,
  type Structure,
} from '../chem/pdb';

export type HisState = 'HIE' | 'HID' | 'HIP';

export interface ReceptorOptions {
  /** Chains to keep (default: all polymer chains). */
  chains?: string[];
  /** Hetero groups (residueKey) to keep, e.g. metal ions or cofactors. Everything else hetero is removed. */
  keepHetero?: string[];
  /** Histidine tautomer for all histidines (default HIE, H on NE2). */
  histidine?: HisState;
}

export interface PreparedReceptor {
  /** Cleaned structure including the added polar hydrogens; every atom has `adType`. */
  structure: Structure;
  pdbqt: string;
  stats: {
    chains: string[];
    residues: number;
    heavyAtoms: number;
    polarHydrogens: number;
    removedWaters: number;
    removedHetero: string[];
    keptHetero: string[];
    disulfides: number;
    warnings: string[];
  };
}

/** AutoDock types Vina 1.2 accepts for receptor atoms other than C/N/O/S/H. */
const VINA_METALS = new Set(['Zn', 'Fe', 'Mg', 'Ca', 'Mn']);
const VINA_OTHER = new Set(['P', 'F', 'Cl', 'Br', 'I']);

const AROMATIC_C: Record<string, Set<string>> = {
  PHE: new Set(['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ']),
  TYR: new Set(['CG', 'CD1', 'CD2', 'CE1', 'CE2', 'CZ']),
  TRP: new Set(['CG', 'CD1', 'CD2', 'CE2', 'CE3', 'CZ2', 'CZ3', 'CH2']),
  HIS: new Set(['CG', 'CD2', 'CE1']),
};

const HIS_NAMES = new Set(['HIS', 'HID', 'HIE', 'HIP', 'HSD', 'HSE', 'HSP']);

/**
 * NeRF: place atom D bonded to C, with |CD| = bond, angle BCD and dihedral ABCD (degrees).
 */
export function placeAtom(a: Vec3, b: Vec3, c: Vec3, bond: number, angleDeg: number, dihedralDeg: number): Vec3 {
  const ang = (angleDeg * Math.PI) / 180;
  const tor = (dihedralDeg * Math.PI) / 180;
  const bc = normalize(sub(c, b));
  const n = normalize(cross(sub(b, a), bc));
  const m = cross(n, bc);
  const d2: Vec3 = [-bond * Math.cos(ang), bond * Math.sin(ang) * Math.cos(tor), bond * Math.sin(ang) * Math.sin(tor)];
  return add(c, add(add(scale(bc, d2[0]), scale(m, d2[1])), scale(n, d2[2])));
}

/** The two free tetrahedral positions on an sp3 centre with two substituents. */
function tetrahedralPair(center: Vec3, a: Vec3, b: Vec3, bond: number): [Vec3, Vec3] {
  const bis = normalize(add(normalize(sub(a, center)), normalize(sub(b, center))));
  const perp = normalize(cross(sub(a, center), sub(b, center)));
  const half = ((109.47 / 2) * Math.PI) / 180;
  const along = scale(bis, -Math.cos(half));
  return [
    add(center, scale(normalize(add(along, scale(perp, Math.sin(half)))), bond)),
    add(center, scale(normalize(add(along, scale(perp, -Math.sin(half)))), bond)),
  ];
}

/** H on an sp2 atom with two heavy neighbours: along the external bisector. */
function bisectorH(center: Vec3, n1: Vec3, n2: Vec3, bond: number): Vec3 {
  const u = normalize(add(normalize(sub(center, n1)), normalize(sub(center, n2))));
  return add(center, scale(u, bond));
}

function makeH(parent: StructAtom, name: string, p: Vec3): StructAtom {
  return {
    ...parent,
    name,
    x: p[0],
    y: p[1],
    z: p[2],
    el: 'H',
    occupancy: 1,
    bfactor: 0,
    adType: 'HD',
    charge: 0,
  };
}

function adTypeFor(a: StructAtom, hasH: boolean): string | null {
  switch (a.el) {
    case 'C': {
      const res = HIS_NAMES.has(a.resName) ? 'HIS' : a.resName;
      return AROMATIC_C[res]?.has(a.name) ? 'A' : 'C';
    }
    case 'N':
      // A nitrogen without hydrogen and with a free lone pair (His ring N, or hetero N) is an acceptor.
      if (hasH) return 'N';
      if (HIS_NAMES.has(a.resName) && (a.name === 'ND1' || a.name === 'NE2')) return 'NA';
      if (a.hetero) return 'NA';
      return 'N';
    case 'O':
      return 'OA';
    case 'S':
      return 'SA';
    case 'Se':
      return 'SA';
    case 'H':
      return 'HD';
    default:
      if (VINA_METALS.has(a.el) || VINA_OTHER.has(a.el)) return a.el;
      return null;
  }
}

/**
 * Prepare a receptor for Vina. Throws if nothing dockable remains.
 */
export function prepareReceptor(input: Structure, opts: ReceptorOptions = {}): PreparedReceptor {
  const warnings: string[] = [];
  const keepHetero = new Set(opts.keepHetero ?? []);
  const his = opts.histidine ?? 'HIE';
  const chainSet = opts.chains?.length ? new Set(opts.chains) : null;

  let removedWaters = 0;
  const removedHetero = new Set<string>();
  const keptHetero = new Set<string>();

  // 1. Filter atoms: chains, waters, hetero groups, existing hydrogens.
  const kept: StructAtom[] = [];
  for (const a of input.atoms) {
    if (a.el === 'H' || a.el === 'D') continue;
    if (WATER_NAMES.has(a.resName)) {
      removedWaters++;
      continue;
    }
    const key = residueKey(a);
    const polymer = AMINO_ACIDS.has(a.resName) && (!a.hetero || a.resName === 'MSE');
    if (!polymer) {
      if (keepHetero.has(key)) keptHetero.add(key);
      else {
        removedHetero.add(key);
        continue;
      }
    }
    if (chainSet && !chainSet.has(a.chain) && !keepHetero.has(key)) continue;
    const atom: StructAtom = { ...a, altLoc: '' };
    // Selenomethionine → methionine (Se is not a Vina type).
    if (atom.resName === 'MSE') {
      atom.resName = 'MET';
      atom.hetero = false;
      if (atom.el === 'Se') {
        atom.el = 'S';
        atom.name = 'SD';
      }
    }
    kept.push(atom);
  }
  if (!kept.length) throw new Error('No receptor atoms left after cleaning — check the chain selection.');

  const struct: Structure = { ...input, atoms: kept };
  const resList = residues(struct);
  const atomsOut: StructAtom[] = [];
  let polarH = 0;
  let disulfides = 0;

  // Disulfide detection (no HG on bonded cysteines).
  const sg = kept.filter((a) => a.resName === 'CYS' && a.name === 'SG');
  const bondedSG = new Set<StructAtom>();
  for (let i = 0; i < sg.length; i++)
    for (let j = i + 1; j < sg.length; j++)
      if (dist(atomVec(sg[i]), atomVec(sg[j])) < 2.5) {
        bondedSG.add(sg[i]);
        bondedSG.add(sg[j]);
        disulfides++;
      }

  // Map residue → atom by name, and previous residue C for backbone amide H.
  const byName = resList.map((r) => {
    const m = new Map<string, StructAtom>();
    for (const i of r.atoms) m.set(kept[i].name, kept[i]);
    return m;
  });

  resList.forEach((r, ri) => {
    const names = byName[ri];
    const get = (n: string) => names.get(n);
    const v = (n: string) => {
      const a = get(n);
      return a ? atomVec(a) : null;
    };
    const hydrogens: { parent: StructAtom; name: string; pos: Vec3 }[] = [];
    const isAA = AMINO_ACIDS.has(r.resName) && !r.hetero;
    const resName = HIS_NAMES.has(r.resName) ? 'HIS' : r.resName;

    if (isAA) {
      const N = get('N');
      const CA = v('CA');
      const C = v('C');
      // Peptide bond to the previous residue in the same chain?
      const prev = ri > 0 && resList[ri - 1].chain === r.chain ? byName[ri - 1].get('C') : undefined;
      const linked = !!(N && prev && dist(atomVec(prev), atomVec(N)) < 2.0);
      if (N && CA) {
        const n = atomVec(N);
        if (linked && resName !== 'PRO') {
          hydrogens.push({ parent: N, name: 'H', pos: bisectorH(n, atomVec(prev!), CA, 1.01) });
        } else if (!linked && C) {
          // N-terminus: protonated amine (NH3+, or NH2+ for proline).
          const CD = v('CD');
          if (resName === 'PRO' && CD) {
            tetrahedralPair(n, CA, CD, 1.01).forEach((pos, k) => hydrogens.push({ parent: N, name: `H${k + 1}`, pos }));
          } else if (resName !== 'PRO') {
            [60, 180, 300].forEach((d, k) =>
              hydrogens.push({ parent: N, name: `H${k + 1}`, pos: placeAtom(C, CA, n, 1.01, 109.5, d) }),
            );
          }
        }
      }

      const sc = (parentName: string, hName: string, a: string, b: string, bond: number, ang: number, dih: number) => {
        const p = get(parentName);
        const pa = v(a);
        const pb = v(b);
        if (!p || !pa || !pb) return;
        hydrogens.push({ parent: p, name: hName, pos: placeAtom(pa, pb, atomVec(p), bond, ang, dih) });
      };
      const bis = (parentName: string, hName: string, a: string, b: string) => {
        const p = get(parentName);
        const pa = v(a);
        const pb = v(b);
        if (!p || !pa || !pb) return;
        hydrogens.push({ parent: p, name: hName, pos: bisectorH(atomVec(p), pa, pb, 1.01) });
      };

      switch (resName) {
        case 'SER':
          sc('OG', 'HG', 'CA', 'CB', 0.96, 109.5, 180);
          break;
        case 'THR':
          sc('OG1', 'HG1', 'CA', 'CB', 0.96, 109.5, 180);
          break;
        case 'TYR':
          sc('OH', 'HH', 'CE1', 'CZ', 0.96, 109.5, 180);
          break;
        case 'CYS': {
          const s = get('SG');
          if (s && !bondedSG.has(s)) sc('SG', 'HG', 'CA', 'CB', 1.34, 96, 180);
          break;
        }
        case 'LYS':
          for (const [k, d] of [60, 180, 300].entries()) sc('NZ', `HZ${k + 1}`, 'CD', 'CE', 1.01, 109.5, d);
          break;
        case 'ARG':
          bis('NE', 'HE', 'CD', 'CZ');
          sc('NH1', 'HH11', 'NE', 'CZ', 1.01, 120, 0);
          sc('NH1', 'HH12', 'NE', 'CZ', 1.01, 120, 180);
          sc('NH2', 'HH21', 'NE', 'CZ', 1.01, 120, 180);
          sc('NH2', 'HH22', 'NE', 'CZ', 1.01, 120, 0);
          break;
        case 'ASN':
          sc('ND2', 'HD21', 'OD1', 'CG', 1.01, 120, 180);
          sc('ND2', 'HD22', 'OD1', 'CG', 1.01, 120, 0);
          break;
        case 'GLN':
          sc('NE2', 'HE21', 'OE1', 'CD', 1.01, 120, 180);
          sc('NE2', 'HE22', 'OE1', 'CD', 1.01, 120, 0);
          break;
        case 'TRP':
          bis('NE1', 'HE1', 'CD1', 'CE2');
          break;
        case 'HIS': {
          const state = r.resName === 'HID' || r.resName === 'HSD' ? 'HID' : r.resName === 'HIP' || r.resName === 'HSP' ? 'HIP' : r.resName === 'HIE' || r.resName === 'HSE' ? 'HIE' : his;
          if (state === 'HID' || state === 'HIP') bis('ND1', 'HD1', 'CG', 'CE1');
          if (state === 'HIE' || state === 'HIP') bis('NE2', 'HE2', 'CD2', 'CE1');
          break;
        }
      }
    }

    const hParents = new Set(hydrogens.map((h) => h.parent));
    for (const i of r.atoms) {
      const a = kept[i];
      const type = adTypeFor(a, hParents.has(a));
      if (!type) {
        warnings.push(`Removed ${a.el} atom ${a.name} in ${residueKey(a)} (not an AutoDock Vina atom type)`);
        continue;
      }
      atomsOut.push({ ...a, adType: type, charge: 0 });
      for (const h of hydrogens.filter((x) => x.parent === a)) {
        atomsOut.push(makeH(a, h.name, h.pos));
        polarH++;
      }
    }
  });

  const lines = atomsOut.map((a, i) => pdbqtLine(a, i + 1));
  const chainsKept = [...new Set(atomsOut.filter((a) => !a.hetero).map((a) => a.chain))];
  const heavy = atomsOut.filter((a) => a.el !== 'H').length;

  return {
    structure: { ...input, atoms: atomsOut },
    pdbqt: `REMARK  Prepared by dockGOAT (polar H, AutoDock 4 types)\n${lines.join('\n')}\nTER\n`,
    stats: {
      chains: chainsKept,
      residues: resList.filter((r) => AMINO_ACIDS.has(r.resName)).length,
      heavyAtoms: heavy,
      polarHydrogens: polarH,
      removedWaters,
      removedHetero: [...removedHetero],
      keptHetero: [...keptHetero],
      disulfides,
      warnings: [...new Set(warnings)].slice(0, 20),
    },
  };
}

/** One PDBQT ATOM/HETATM line: PDB columns 1-66, charge in 71-76, AD type in 78-79. */
export function pdbqtLine(a: StructAtom, serial: number): string {
  const base = formatAtomLine({ ...a, occupancy: a.occupancy ?? 1, bfactor: a.bfactor ?? 0 }, serial).slice(0, 66);
  const q = (a.charge ?? 0).toFixed(3);
  return `${base}    ${(q.startsWith('-') ? q : `+${q}`).padStart(6)} ${(a.adType ?? a.el).padEnd(2)}`;
}

/** Check that a user-supplied PDBQT looks like a rigid receptor (no torsion tree). */
export function validateReceptorPdbqt(text: string): string | null {
  if (/^(ROOT|BRANCH)/m.test(text)) return 'This PDBQT contains a torsion tree (ROOT/BRANCH) — it looks like a ligand, not a receptor.';
  if (!/^(ATOM|HETATM)/m.test(text)) return 'No ATOM/HETATM records found.';
  return null;
}

