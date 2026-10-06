/**
 * Macromolecular structure model with PDB, PDBQT and mmCIF readers and a PDB
 * writer. Only the first model is read; alternate locations are resolved to
 * the highest-occupancy conformer.
 */
import { normalizeSymbol } from './elements';
import type { Vec3 } from './geometry';

export interface StructAtom {
  serial: number;
  name: string;
  altLoc: string;
  resName: string;
  chain: string;
  resSeq: number;
  iCode: string;
  x: number;
  y: number;
  z: number;
  occupancy: number;
  bfactor: number;
  el: string;
  hetero: boolean;
  /** PDBQT only: partial charge and AutoDock atom type. */
  charge?: number;
  adType?: string;
}

export interface Structure {
  title: string;
  atoms: StructAtom[];
  /** HELIX/SHEET records, kept so viewers can draw secondary structure. */
  ssRecords: string[];
  /** CONECT records verbatim (useful for hetero groups). */
  conect: string[];
  header: { id?: string; classification?: string; method?: string; resolution?: number };
}

export const WATER_NAMES = new Set(['HOH', 'WAT', 'H2O', 'DOD', 'TIP', 'TIP3', 'SOL']);

export const AMINO_ACIDS = new Set([
  'ALA', 'ARG', 'ASN', 'ASP', 'CYS', 'GLN', 'GLU', 'GLY', 'HIS', 'ILE', 'LEU', 'LYS', 'MET',
  'PHE', 'PRO', 'SER', 'THR', 'TRP', 'TYR', 'VAL',
  // common protonation-state / modified names
  'HID', 'HIE', 'HIP', 'HSD', 'HSE', 'HSP', 'CYX', 'CYM', 'ASH', 'GLH', 'LYN', 'MSE', 'SEC', 'PYL',
]);

export const NUCLEOTIDES = new Set(['A', 'C', 'G', 'U', 'T', 'DA', 'DC', 'DG', 'DT', 'DU', 'I', 'DI']);

/** Common crystallisation additives and buffer components that are rarely real ligands. */
export const ADDITIVES = new Set([
  'SO4', 'PO4', 'GOL', 'EDO', 'PEG', 'PGE', 'PG4', '1PE', 'ACT', 'ACE', 'DMS', 'MPD', 'BME', 'TRS',
  'EPE', 'MES', 'CL', 'NA', 'K', 'IOD', 'BR', 'NO3', 'FMT', 'IMD', 'CIT', 'TLA', 'MLI', 'SCN',
  'NH4', 'AZI', 'BOG', 'LDA', 'P6G', 'PEO', 'HEZ', 'IPA', 'EOH', 'MOH', 'UNX', 'UNL', 'CAC', 'DTT',
]);

function elementFromName(name: string, resName: string, hetero: boolean): string {
  const n = name.trim();
  // Metal ions in hetero groups are usually named by their element (ZN, MG, CA…).
  if (hetero && n.length <= 2 && n === resName.trim()) return normalizeSymbol(n);
  const letters = n.replace(/[^A-Za-z]/g, '');
  if (!letters) return 'X';
  if (/^[0-9]/.test(name.trim()) || name[0] === ' ') return normalizeSymbol(letters[0]);
  // Columns 13-14 hold the element for 2-letter elements (e.g. 'FE  ').
  const two = normalizeSymbol(letters.slice(0, 2));
  if (['Cl', 'Br', 'Fe', 'Zn', 'Mg', 'Mn', 'Ca', 'Cu', 'Co', 'Ni', 'Na', 'Se', 'Cd', 'Hg'].includes(two) && hetero)
    return two;
  return normalizeSymbol(letters[0]);
}

/** Pick, per residue atom, the alternate location with highest occupancy. */
function resolveAltLocs(atoms: StructAtom[]): StructAtom[] {
  const best = new Map<string, StructAtom>();
  const order: string[] = [];
  for (const a of atoms) {
    const key = `${a.chain}|${a.resSeq}|${a.iCode}|${a.resName}|${a.name}`;
    const cur = best.get(key);
    if (!cur) {
      best.set(key, a);
      order.push(key);
    } else if (a.occupancy > cur.occupancy) best.set(key, a);
  }
  return order.map((k) => ({ ...best.get(k)!, altLoc: '' }));
}

/** Parse PDB or PDBQT text (first MODEL only). */
export function parsePDB(text: string, title = ''): Structure {
  const atoms: StructAtom[] = [];
  const ssRecords: string[] = [];
  const conect: string[] = [];
  const header: Structure['header'] = {};
  let inFirstModel = true;
  let sawModel = false;

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const rec = raw.slice(0, 6);
    if (rec === 'MODEL ') {
      if (sawModel) inFirstModel = false;
      sawModel = true;
      continue;
    }
    if (rec === 'ENDMDL') {
      inFirstModel = false;
      continue;
    }
    if (rec === 'HEADER') {
      header.classification = raw.slice(10, 50).trim();
      header.id = raw.slice(62, 66).trim() || undefined;
    } else if (rec === 'EXPDTA') header.method = raw.slice(10).trim();
    else if (rec.startsWith('REMARK') && raw.slice(7, 10) === '  2' && raw.includes('RESOLUTION.')) {
      const m = raw.match(/RESOLUTION\.\s+([\d.]+)/);
      if (m) header.resolution = parseFloat(m[1]);
    } else if (rec === 'HELIX ' || rec === 'SHEET ') ssRecords.push(raw);
    else if (rec === 'CONECT') conect.push(raw);
    if ((rec !== 'ATOM  ' && rec !== 'HETATM') || !inFirstModel) continue;

    const hetero = rec === 'HETATM';
    const name = raw.slice(12, 16);
    const resName = raw.slice(17, 20).trim();
    const isPdbqt = raw.length >= 77 && /^\s*[A-Za-z]{1,2}\s*$/.test(raw.slice(77, 79)) && raw.slice(70, 76).trim() !== '';
    let el = raw.slice(76, 78).trim();
    let adType: string | undefined;
    let charge: number | undefined;
    if (isPdbqt) {
      adType = raw.slice(77, 79).trim();
      charge = parseFloat(raw.slice(68, 76));
      el = adToElement(adType);
    }
    atoms.push({
      serial: parseInt(raw.slice(6, 11), 10),
      name: name.trim(),
      altLoc: raw[16]?.trim() ?? '',
      resName,
      chain: raw[21]?.trim() || 'A',
      resSeq: parseInt(raw.slice(22, 26), 10) || 0,
      iCode: raw[26]?.trim() ?? '',
      x: parseFloat(raw.slice(30, 38)),
      y: parseFloat(raw.slice(38, 46)),
      z: parseFloat(raw.slice(46, 54)),
      occupancy: parseFloat(raw.slice(54, 60)) || 1,
      bfactor: parseFloat(raw.slice(60, 66)) || 0,
      el: el ? normalizeSymbol(el) : elementFromName(name, resName, hetero),
      hetero,
      charge,
      adType,
    });
  }
  return { title: title || header.id || '', atoms: resolveAltLocs(atoms), ssRecords, conect, header };
}

/** Map an AutoDock 4 atom type to its element. */
export function adToElement(t: string): string {
  switch (t) {
    case 'A':
      return 'C';
    case 'NA':
    case 'NS':
      return 'N';
    case 'OA':
    case 'OS':
      return 'O';
    case 'SA':
      return 'S';
    case 'HD':
    case 'HS':
      return 'H';
    case 'G0':
    case 'G1':
    case 'G2':
    case 'G3':
    case 'CG0':
    case 'CG1':
    case 'CG2':
    case 'CG3':
      return 'C';
    default:
      return normalizeSymbol(t);
  }
}

/** Minimal mmCIF reader for the `_atom_site` loop (first model). */
export function parseMMCIF(text: string, title = ''): Structure {
  const lines = text.replace(/\r/g, '').split('\n');
  const header: Structure['header'] = {};
  const idLine = lines.find((l) => l.startsWith('data_'));
  if (idLine) header.id = idLine.slice(5).trim();
  const resLine = lines.find((l) => l.startsWith('_refine.ls_d_res_high') || l.startsWith('_em_3d_reconstruction.resolution '));
  if (resLine) {
    const v = parseFloat(resLine.split(/\s+/)[1]);
    if (Number.isFinite(v)) header.resolution = v;
  }
  const methodLine = lines.find((l) => l.startsWith('_exptl.method'));
  if (methodLine) header.method = methodLine.replace('_exptl.method', '').trim().replace(/^'|'$/g, '');

  const atoms: StructAtom[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === 'loop_' && lines[i + 1]?.startsWith('_atom_site.')) {
      const cols: string[] = [];
      i++;
      while (lines[i]?.startsWith('_atom_site.')) cols.push(lines[i++].trim().slice('_atom_site.'.length));
      const col = (n: string) => cols.indexOf(n);
      const c = {
        group: col('group_PDB'),
        id: col('id'),
        el: col('type_symbol'),
        name: col('auth_atom_id') >= 0 ? col('auth_atom_id') : col('label_atom_id'),
        alt: col('label_alt_id'),
        res: col('auth_comp_id') >= 0 ? col('auth_comp_id') : col('label_comp_id'),
        chain: col('auth_asym_id') >= 0 ? col('auth_asym_id') : col('label_asym_id'),
        seq: col('auth_seq_id') >= 0 ? col('auth_seq_id') : col('label_seq_id'),
        ins: col('pdbx_PDB_ins_code'),
        x: col('Cartn_x'),
        y: col('Cartn_y'),
        z: col('Cartn_z'),
        occ: col('occupancy'),
        b: col('B_iso_or_equiv'),
        model: col('pdbx_PDB_model_num'),
      };
      let firstModel: string | null = null;
      for (; i < lines.length; i++) {
        const l = lines[i];
        if (!l.trim() || l.startsWith('#') || l.startsWith('loop_') || l.startsWith('_')) break;
        const f = tokenizeCif(l);
        if (f.length < cols.length) continue;
        if (c.model >= 0) {
          firstModel ??= f[c.model];
          if (f[c.model] !== firstModel) continue;
        }
        const v = (k: number) => (k >= 0 && f[k] !== '?' && f[k] !== '.' ? f[k] : '');
        atoms.push({
          serial: parseInt(v(c.id), 10) || atoms.length + 1,
          name: v(c.name).replace(/"/g, ''),
          altLoc: v(c.alt),
          resName: v(c.res),
          chain: v(c.chain) || 'A',
          resSeq: parseInt(v(c.seq), 10) || 0,
          iCode: v(c.ins),
          x: parseFloat(v(c.x)),
          y: parseFloat(v(c.y)),
          z: parseFloat(v(c.z)),
          occupancy: parseFloat(v(c.occ)) || 1,
          bfactor: parseFloat(v(c.b)) || 0,
          el: normalizeSymbol(v(c.el) || 'X'),
          hetero: v(c.group) === 'HETATM',
        });
      }
      break;
    }
    i++;
  }
  return { title: title || header.id || '', atoms: resolveAltLocs(atoms), ssRecords: [], conect: [], header };
}

function tokenizeCif(line: string): string[] {
  const out: string[] = [];
  const re = /'([^']*)'|"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/** Auto-detect PDB/PDBQT vs mmCIF. */
export function parseStructure(text: string, title = ''): Structure {
  const head = text.slice(0, 2000);
  if (/^data_/m.test(head) && text.includes('_atom_site.')) return parseMMCIF(text, title);
  return parsePDB(text, title);
}

/** Format one PDB ATOM/HETATM line (columns 1-80). */
export function formatAtomLine(a: StructAtom, serial = a.serial): string {
  const rec = a.hetero ? 'HETATM' : 'ATOM  ';
  // Atom names shorter than 4 characters start in column 14 for 1-letter elements.
  const name = a.name.length >= 4 || a.el.length === 2 ? a.name.padEnd(4) : ` ${a.name.padEnd(3)}`;
  return (
    rec +
    String(serial % 100000).padStart(5) +
    ' ' +
    name.slice(0, 4) +
    (a.altLoc || ' ') +
    a.resName.padStart(3).slice(-3) +
    ' ' +
    (a.chain || 'A').slice(0, 1) +
    String(a.resSeq).padStart(4) +
    (a.iCode || ' ') +
    '   ' +
    a.x.toFixed(3).padStart(8) +
    a.y.toFixed(3).padStart(8) +
    a.z.toFixed(3).padStart(8) +
    a.occupancy.toFixed(2).padStart(6) +
    a.bfactor.toFixed(2).padStart(6) +
    '          ' +
    a.el.toUpperCase().padStart(2)
  );
}

export function writePDB(s: Structure, opts: { includeHetero?: boolean } = {}): string {
  const lines: string[] = [];
  if (s.title) lines.push(`REMARK   1 ${s.title}`);
  lines.push(...s.ssRecords);
  let serial = 1;
  let lastChain = '';
  for (const a of s.atoms) {
    if (a.hetero && opts.includeHetero === false) continue;
    if (lastChain && a.chain !== lastChain && !a.hetero) lines.push('TER');
    lastChain = a.chain;
    lines.push(formatAtomLine(a, serial++));
  }
  lines.push('END');
  return lines.join('\n') + '\n';
}

export function atomVec(a: { x: number; y: number; z: number }): Vec3 {
  return [a.x, a.y, a.z];
}

export interface ResidueInfo {
  key: string;
  chain: string;
  resSeq: number;
  iCode: string;
  resName: string;
  atoms: number[];
  hetero: boolean;
}

/** Group atoms into residues in file order. */
export function residues(s: Structure): ResidueInfo[] {
  const out: ResidueInfo[] = [];
  const index = new Map<string, ResidueInfo>();
  s.atoms.forEach((a, i) => {
    const key = residueKey(a);
    let r = index.get(key);
    if (!r) {
      r = { key, chain: a.chain, resSeq: a.resSeq, iCode: a.iCode, resName: a.resName, atoms: [], hetero: a.hetero };
      index.set(key, r);
      out.push(r);
    }
    r.atoms.push(i);
  });
  return out;
}

export function residueKey(a: Pick<StructAtom, 'chain' | 'resSeq' | 'iCode' | 'resName'>): string {
  return `${a.chain}:${a.resName}${a.resSeq}${a.iCode}`;
}

export interface HetGroup {
  key: string;
  resName: string;
  chain: string;
  resSeq: number;
  atomCount: number;
  center: Vec3;
  min: Vec3;
  max: Vec3;
  isAdditive: boolean;
  isMetal: boolean;
}

/** Hetero groups (non-water, non-polymer), e.g. co-crystallised ligands and cofactors. */
export function hetGroups(s: Structure): HetGroup[] {
  return residues(s)
    .filter((r) => r.hetero && !WATER_NAMES.has(r.resName) && !AMINO_ACIDS.has(r.resName))
    .map((r) => {
      const pts = r.atoms.map((i) => atomVec(s.atoms[i]));
      const min: Vec3 = [Infinity, Infinity, Infinity];
      const max: Vec3 = [-Infinity, -Infinity, -Infinity];
      const c: Vec3 = [0, 0, 0];
      for (const p of pts)
        for (let k = 0; k < 3; k++) {
          c[k] += p[k] / pts.length;
          min[k] = Math.min(min[k], p[k]);
          max[k] = Math.max(max[k], p[k]);
        }
      return {
        key: r.key,
        resName: r.resName,
        chain: r.chain,
        resSeq: r.resSeq,
        atomCount: r.atoms.length,
        center: c,
        min,
        max,
        isAdditive: ADDITIVES.has(r.resName),
        isMetal: r.atoms.length === 1 && s.atoms[r.atoms[0]].el !== 'C',
      };
    });
}

export function chains(s: Structure): { id: string; residues: number; polymer: boolean }[] {
  const map = new Map<string, { id: string; residues: Set<string>; polymer: boolean }>();
  for (const a of s.atoms) {
    let c = map.get(a.chain);
    if (!c) {
      c = { id: a.chain, residues: new Set(), polymer: false };
      map.set(a.chain, c);
    }
    if (!a.hetero || AMINO_ACIDS.has(a.resName)) {
      c.residues.add(`${a.resSeq}${a.iCode}`);
      if (AMINO_ACIDS.has(a.resName) || NUCLEOTIDES.has(a.resName)) c.polymer = true;
    }
  }
  return [...map.values()].map((c) => ({ id: c.id, residues: c.residues.size, polymer: c.polymer }));
}

const THREE_TO_ONE: Record<string, string> = {
  ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
  LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
  HID: 'H', HIE: 'H', HIP: 'H', HSD: 'H', HSE: 'H', HSP: 'H', CYX: 'C', CYM: 'C', ASH: 'D', GLH: 'E',
  LYN: 'K', MSE: 'M', SEC: 'U', PYL: 'O',
};

export function oneLetter(resName: string): string {
  return THREE_TO_ONE[resName] ?? 'X';
}

/** Amino-acid sequence per chain (from CA atoms). */
export function sequences(s: Structure): { chain: string; seq: string; residues: ResidueInfo[] }[] {
  const byChain = new Map<string, ResidueInfo[]>();
  for (const r of residues(s)) {
    if (!AMINO_ACIDS.has(r.resName)) continue;
    if (!r.atoms.some((i) => s.atoms[i].name === 'CA')) continue;
    const list = byChain.get(r.chain) ?? [];
    list.push(r);
    byChain.set(r.chain, list);
  }
  return [...byChain.entries()].map(([chain, list]) => ({
    chain,
    seq: list.map((r) => oneLetter(r.resName)).join(''),
    residues: list,
  }));
}
