/**
 * RDKit (MinimalLib, WebAssembly) bridge.
 *
 * In the browser the library is loaded lazily from /rdkit (copied there from
 * node_modules by scripts/copy-vendor.mjs) so its 7 MB WebAssembly binary never
 * lands in a page bundle. Node tests call `registerRDKit()` with an instance
 * created from the npm package.
 */
import type { MainModule, Mol } from '@rdkit/rdkit';
import { elementByZ } from './elements';
import { writeMolfile } from './molfile';
import type { BondOrder, MolAtom, MolBond, Molecule } from './molecule';

export type RDKit = MainModule;
export type RDMol = Mol;

let instance: RDKit | null = null;
let loading: Promise<RDKit> | null = null;

export function registerRDKit(rdkit: RDKit): void {
  instance = rdkit;
}

declare global {
  interface Window {
    initRDKitModule?: (opts?: { locateFile?: (f: string) => string }) => Promise<RDKit>;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-rdkit]`);
    if (existing) {
      if (window.initRDKitModule) resolve();
      else existing.addEventListener('load', () => resolve(), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.rdkit = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load the RDKit cheminformatics engine'));
    document.head.appendChild(s);
  });
}

export function getRDKit(): Promise<RDKit> {
  if (instance) return Promise.resolve(instance);
  if (loading) return loading;
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('RDKit is not registered (call registerRDKit in Node)'));
  }
  loading = loadScript('/rdkit/RDKit_minimal.js')
    .then(() => window.initRDKitModule!({ locateFile: () => '/rdkit/RDKit_minimal.wasm' }))
    .then((rd) => {
      rd.prefer_coordgen(true);
      instance = rd;
      return rd;
    })
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
}

/** Synchronous access once loaded (throws if `getRDKit()` has not resolved yet). */
export function rdkitSync(): RDKit {
  if (!instance) throw new Error('RDKit has not finished loading');
  return instance;
}

/** Run `fn` with a parsed RDKit molecule and always free the WebAssembly handle. */
export function withMol<T>(rd: RDKit, input: string, fn: (mol: RDMol) => T, details?: object): T {
  const mol = details ? rd.get_mol(input, JSON.stringify(details)) : rd.get_mol(input);
  if (!mol) throw new Error('Could not parse structure');
  try {
    if (!mol.is_valid()) throw new Error('Invalid structure');
    return fn(mol);
  } finally {
    mol.delete();
  }
}

export function tryParse(rd: RDKit, input: string, details?: object): RDMol | null {
  try {
    const mol = details ? rd.get_mol(input, JSON.stringify(details)) : rd.get_mol(input);
    if (mol && mol.is_valid()) return mol;
    mol?.delete();
    return null;
  } catch {
    return null;
  }
}

interface RDJsonAtom {
  z?: number;
  impHs?: number;
  chg?: number;
}
interface RDJsonBond {
  bo?: number;
  atoms: [number, number];
}
interface RDJson {
  defaults: { atom: Required<RDJsonAtom>; bond: { bo: number } };
  molecules: {
    atoms: RDJsonAtom[];
    bonds?: RDJsonBond[];
    extensions?: { name: string; aromaticAtoms?: number[]; aromaticBonds?: number[]; cipCodes?: [number, string][] }[];
  }[];
}

export interface PerceivedMolecule {
  mol: Molecule;
  /** Implicit hydrogen count per atom (0 once hydrogens are explicit). */
  implicitH: number[];
  /** CIP labels by atom index. */
  cip: Map<number, string>;
}

/**
 * Convert an RDKit molecule into the toolkit's Molecule using RDKit's JSON
 * (Kekulé bond orders, aromaticity, charges, implicit H) and molblock
 * (coordinates). Atom order is preserved.
 */
export function fromRDMol(rdMol: RDMol, title = ''): PerceivedMolecule {
  const json = JSON.parse(rdMol.get_json()) as RDJson;
  const def = json.defaults;
  const jm = json.molecules[0];
  const ext = jm.extensions?.find((e) => e.name === 'rdkitRepresentation');
  const aromaticAtoms = new Set(ext?.aromaticAtoms ?? []);
  const aromaticBonds = new Set(ext?.aromaticBonds ?? []);

  const coords = rdMol.has_coords() ? parseCoords(rdMol.get_molblock()) : [];
  const atoms: MolAtom[] = jm.atoms.map((a, i) => ({
    el: elementByZ(a.z ?? def.atom.z).symbol,
    x: coords[i]?.[0] ?? 0,
    y: coords[i]?.[1] ?? 0,
    z: coords[i]?.[2] ?? 0,
    charge: a.chg ?? def.atom.chg,
    aromatic: aromaticAtoms.has(i),
  }));
  const bonds: MolBond[] = (jm.bonds ?? []).map((b, i) => ({
    a: b.atoms[0],
    b: b.atoms[1],
    order: (b.bo ?? def.bond.bo) as BondOrder,
    aromatic: aromaticBonds.has(i),
  }));
  // Carry wedge flags from the molblock so the 3D builder can honour stereo.
  if (rdMol.has_coords()) {
    const stereo = parseBondStereo(rdMol.get_molblock());
    bonds.forEach((b, i) => {
      if (stereo[i]) b.stereo = stereo[i];
    });
  }
  const cip = new Map<number, string>(ext?.cipCodes ?? []);
  return {
    mol: { title, atoms, bonds, props: {} },
    implicitH: jm.atoms.map((a) => a.impHs ?? def.atom.impHs),
    cip,
  };
}

function parseCoords(molblock: string): [number, number, number][] {
  const lines = molblock.replace(/\r/g, '').split('\n');
  const n = parseInt(lines[3].slice(0, 3), 10);
  const out: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const l = lines[4 + i];
    out.push([parseFloat(l.slice(0, 10)), parseFloat(l.slice(10, 20)), parseFloat(l.slice(20, 30))]);
  }
  return out;
}

function parseBondStereo(molblock: string): number[] {
  const lines = molblock.replace(/\r/g, '').split('\n');
  const nA = parseInt(lines[3].slice(0, 3), 10);
  const nB = parseInt(lines[3].slice(3, 6), 10);
  const out: number[] = [];
  for (let i = 0; i < nB; i++) out.push(parseInt(lines[4 + nA + i].slice(9, 12), 10) || 0);
  return out;
}

/**
 * Write a molblock that RDKit can sanitise: aromatic bonds whose Kekulé
 * assignment is unknown (e.g. read from MOL2 'ar' or SDF type 4) are written
 * as query type 4 so RDKit re-derives the Kekulé structure.
 */
export function toMolblock(m: Molecule): string {
  const block = writeMolfile(m);
  const aromatic = m.bonds.filter((b) => b.aromatic);
  // A Kekulé assignment is present when any aromatic bond is already double.
  if (!aromatic.length || aromatic.some((b) => b.order === 2)) return block;
  const lines = block.split('\n');
  const nA = m.atoms.length;
  m.bonds.forEach((b, i) => {
    if (b.aromatic && b.order === 1) {
      const l = lines[4 + nA + i];
      lines[4 + nA + i] = l.slice(0, 6) + '  4' + l.slice(9);
    }
  });
  return lines.join('\n');
}

/**
 * Sanitise a molecule read from a file through RDKit: assigns Kekulé orders,
 * aromaticity and charges while keeping the original coordinates and atom order.
 */
export function perceive(rd: RDKit, m: Molecule): PerceivedMolecule {
  const block = toMolblock(m);
  return withMol(
    rd,
    block,
    (rdMol) => {
      const p = fromRDMol(rdMol, m.title);
      p.mol.atoms.forEach((a, i) => {
        a.x = m.atoms[i].x;
        a.y = m.atoms[i].y;
        a.z = m.atoms[i].z;
        if (m.atoms[i].name) a.name = m.atoms[i].name;
      });
      p.mol.props = { ...m.props };
      return p;
    },
    { removeHs: false },
  );
}

/** Canonical isomeric SMILES for a toolkit molecule (hydrogens implicit). */
export function smilesOf(rd: RDKit, m: Molecule): string {
  return withMol(rd, toMolblock(m), (rdMol) => rdMol.get_smiles(), { removeHs: true });
}

export interface SmilesParse {
  canonical: string;
  /** 2D depiction with explicit hydrogens and wedge bonds. */
  withH: PerceivedMolecule;
  inchi: string;
  inchikey: string;
}

/** Parse SMILES, returning canonical form, identifiers and an explicit-H 2D molecule. */
export function parseSmiles(rd: RDKit, smiles: string, title = ''): SmilesParse {
  const trimmed = smiles.trim();
  if (!trimmed) throw new Error('Enter a SMILES string');
  return withMol(rd, trimmed, (rdMol) => {
    const canonical = rdMol.get_smiles();
    let inchi = '';
    let inchikey = '';
    try {
      inchi = rdMol.get_inchi();
      inchikey = inchi ? rd.get_inchikey_for_inchi(inchi) : '';
    } catch {
      /* InChI is optional */
    }
    const hBlock = rdMol.add_hs();
    const withH = withMol(rd, hBlock, (h) => fromRDMol(h, title), { removeHs: false });
    return { canonical, withH, inchi, inchikey };
  });
}

/** SVG depiction of a SMILES or molblock. */
export function depict(
  rd: RDKit,
  input: string,
  opts: { width?: number; height?: number; highlightAtoms?: number[]; transparent?: boolean } = {},
): string {
  return withMol(rd, input, (rdMol) => {
    const details: Record<string, unknown> = {
      width: opts.width ?? 320,
      height: opts.height ?? 240,
      bondLineWidth: 1.5,
      addStereoAnnotation: true,
      clearBackground: !opts.transparent,
    };
    if (opts.highlightAtoms?.length) details.atoms = opts.highlightAtoms;
    if (!rdMol.has_coords()) rdMol.set_new_coords(true);
    return rdMol.get_svg_with_highlights(JSON.stringify(details));
  });
}
