/**
 * Turning whatever the user supplies into the two things Vina needs: a prepared
 * receptor and a prepared ligand. Everything here runs in the browser.
 */
import { embed3D } from '../chem/conformer';
import { addHydrogens3D } from '../chem/hydrogens';
import type { Vec3 } from '../chem/geometry';
import { parseMol2 } from '../chem/mol2';
import { largestFragment, type Molecule } from '../chem/molecule';
import { parseSDF } from '../chem/molfile';
import { hetGroups, parseStructure, residues, type HetGroup, type Structure } from '../chem/pdb';
import { getRDKit, parseSmiles, perceive, smilesOf, type RDKit } from '../chem/rdkit';
import { prepareLigand, type PreparedLigand } from '../docking/ligand';
import { prepareReceptor, type PreparedReceptor, type ReceptorOptions } from '../docking/receptor';
import * as pubchem from '../services/pubchem';
import * as rcsb from '../services/rcsb';

/* ────────────────────────────────── targets ─────────────────────────────── */

export type TargetSource =
  | { kind: 'pdb'; id: string }
  | { kind: 'alphafold'; uniprot: string }
  | { kind: 'file'; name: string; text: string };

export interface LoadedTarget {
  source: TargetSource;
  label: string;
  /** Raw coordinate text, kept so the viewer and downloads can use the original. */
  text: string;
  format: 'pdb' | 'cif';
  structure: Structure;
  chains: { id: string; residues: number; polymer: boolean }[];
  hetero: HetGroup[];
  info?: rcsb.EntryInfo | null;
  /** AlphaFold models store per-residue pLDDT in the B-factor column. */
  isPredicted: boolean;
}

function describe(s: Structure, source: TargetSource, info?: rcsb.EntryInfo | null): string {
  if (info?.title) return info.title;
  if (source.kind === 'file') return source.name;
  if (source.kind === 'alphafold') return `AlphaFold model of ${source.uniprot}`;
  return s.title || source.id;
}

export async function loadTarget(source: TargetSource): Promise<LoadedTarget> {
  let text: string;
  let format: 'pdb' | 'cif' = 'pdb';
  let info: rcsb.EntryInfo | null = null;
  let isPredicted = false;

  if (source.kind === 'pdb') {
    const [file, entry] = await Promise.all([
      rcsb.fetchStructureFile(source.id),
      rcsb.fetchEntryInfo(source.id).catch(() => null),
    ]);
    text = file.text;
    format = file.format;
    info = entry;
  } else if (source.kind === 'alphafold') {
    const af = await rcsb.fetchAlphaFold(source.uniprot);
    text = af.text;
    isPredicted = true;
  } else {
    text = source.text;
    format = /^data_/m.test(text.slice(0, 2000)) && text.includes('_atom_site.') ? 'cif' : 'pdb';
  }

  const structure = parseStructure(text, source.kind === 'pdb' ? source.id.toUpperCase() : '');
  if (!structure.atoms.length) throw new Error('No atoms found — is this a coordinate file?');

  // AlphaFold files are plain PDB; detect them by their pLDDT B-factors.
  if (!isPredicted && source.kind === 'file') {
    isPredicted = /ALPHAFOLD/i.test(text.slice(0, 4000));
  }

  const chainList = new Map<string, { id: string; residues: Set<string>; polymer: boolean }>();
  for (const r of residues(structure)) {
    let c = chainList.get(r.chain);
    if (!c) {
      c = { id: r.chain, residues: new Set(), polymer: false };
      chainList.set(r.chain, c);
    }
    if (!r.hetero) {
      c.residues.add(r.key);
      c.polymer = true;
    }
  }

  return {
    source,
    label: describe(structure, source, info),
    text,
    format,
    structure,
    chains: [...chainList.values()]
      .map((c) => ({ id: c.id, residues: c.residues.size, polymer: c.polymer }))
      .filter((c) => c.polymer)
      .sort((a, b) => b.residues - a.residues),
    hetero: hetGroups(structure).filter((h) => !h.isAdditive || h.atomCount > 6),
    info,
    isPredicted,
  };
}

export function prepareTargetForDocking(target: LoadedTarget, opts: ReceptorOptions): PreparedReceptor {
  return prepareReceptor(target.structure, opts);
}

/* ────────────────────────────────── ligands ─────────────────────────────── */

export type LigandSource =
  | { kind: 'smiles'; smiles: string; name?: string }
  | { kind: 'name'; query: string }
  | { kind: 'file'; name: string; text: string }
  | { kind: 'hetero'; target: LoadedTarget; group: HetGroup };

export interface LoadedLigand {
  name: string;
  /** 3D molecule with explicit hydrogens, ready for prepareLigand. */
  molecule: Molecule;
  smiles: string;
  /** How the 3D coordinates were obtained. */
  geometry: 'generated' | 'experimental' | 'file';
  /** Set when the conformer was generated here. */
  embedReport?: { energy: number; maxBondError: number; chiralOk: boolean };
  warnings: string[];
  pubchemCid?: number;
}

function fileFormat(name: string, text: string): 'sdf' | 'mol2' | 'pdb' | 'pdbqt' | 'smi' {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'mol2') return 'mol2';
  if (ext === 'pdbqt') return 'pdbqt';
  if (ext === 'pdb' || ext === 'ent') return 'pdb';
  if (ext === 'sdf' || ext === 'mol' || ext === 'sd') return 'sdf';
  if (ext === 'smi' || ext === 'smiles' || ext === 'txt') return 'smi';
  if (text.includes('@<TRIPOS>')) return 'mol2';
  if (text.includes('M  END')) return 'sdf';
  if (/^(ATOM|HETATM)/m.test(text)) return 'pdb';
  return 'smi';
}

/**
 * Make sure a ligand has 3D coordinates and explicit hydrogens.
 *
 * A structure that already has 3D coordinates keeps them: when only hydrogens
 * are missing they are built onto the existing heavy-atom frame, because
 * re-embedding would discard an experimentally determined pose (and with it any
 * chance of a meaningful redocking RMSD).
 */
async function ensure3D(
  rd: RDKit,
  mol: Molecule,
  warnings: string[],
): Promise<{ mol: Molecule; geometry: LoadedLigand['geometry']; report?: LoadedLigand['embedReport'] }> {
  const flat = mol.atoms.every((a) => Math.abs(a.z) < 1e-3);
  const hasH = mol.atoms.some((a) => a.el === 'H');

  if (!flat && hasH) return { mol, geometry: 'experimental' };

  if (!flat) {
    // 3D heavy atoms, no hydrogens: add them geometrically and keep the pose.
    const perceived = perceive(rd, mol);
    const withH = addHydrogens3D(perceived.mol, perceived.implicitH);
    withH.title = mol.title;
    return { mol: withH, geometry: 'experimental' };
  }

  // A flat depiction carries no conformation at all, so build one.
  const smiles = smilesOf(rd, mol);
  const parsed = parseSmiles(rd, smiles, mol.title);
  const { mol: embedded, report } = embed3D(parsed.withH.mol, { seed: 0xd0c });
  embedded.title = mol.title;
  warnings.push('The file held a flat 2D structure, so a 3D conformer was generated.');
  if (!report.chiralOk) warnings.push('A stereocentre could not be reproduced exactly in 3D — check the geometry.');
  return {
    mol: embedded,
    geometry: 'generated',
    report: { energy: report.energy, maxBondError: report.maxBondError, chiralOk: report.chiralOk },
  };
}

export async function loadLigand(source: LigandSource): Promise<LoadedLigand> {
  const rd = await getRDKit();
  const warnings: string[] = [];

  if (source.kind === 'smiles' || source.kind === 'name') {
    let smiles: string;
    let name: string;
    let cid: number | undefined;

    if (source.kind === 'name') {
      const hits = await pubchem.searchByName(source.query, 1);
      if (!hits.length || !hits[0].smiles) throw new Error(`PubChem has no compound called “${source.query}”`);
      smiles = hits[0].smiles;
      name = hits[0].title;
      cid = hits[0].cid;
    } else {
      smiles = source.smiles.trim();
      name = source.name?.trim() || 'Ligand';
    }

    const parsed = parseSmiles(rd, smiles, name);
    const whole = parsed.withH.mol;
    const single = largestFragment(whole);
    if (single.atoms.length !== whole.atoms.length) warnings.push('Salt or counter-ion removed; the largest fragment was kept.');

    const { mol: embedded, report } = embed3D(single, { seed: 0xd0c });
    embedded.title = name;
    if (!report.chiralOk) warnings.push('A stereocentre could not be reproduced exactly in 3D — check the geometry.');
    return {
      name,
      molecule: embedded,
      smiles: parsed.canonical,
      geometry: 'generated',
      embedReport: { energy: report.energy, maxBondError: report.maxBondError, chiralOk: report.chiralOk },
      warnings,
      pubchemCid: cid,
    };
  }

  if (source.kind === 'hetero') {
    const { target, group } = source;
    // The instance SDF from RCSB carries bond orders in the crystal frame;
    // the PDB block alone has neither.
    if (target.source.kind === 'pdb') {
      try {
        const sdf = await rcsb.fetchLigandInstanceSdf(target.source.id, group.chain, group.resSeq);
        const raw = parseSDF(sdf)[0];
        if (raw?.atoms.length) {
          const { mol } = perceive(rd, raw);
          mol.title = group.resName;
          const out = await ensure3D(rd, mol, warnings);
          return {
            name: `${group.resName} (${target.source.id.toUpperCase()} ${group.chain}${group.resSeq})`,
            molecule: out.mol,
            smiles: smilesOf(rd, out.mol),
            geometry: out.geometry === 'generated' ? 'generated' : 'experimental',
            embedReport: out.report,
            warnings,
          };
        }
      } catch {
        warnings.push('Could not fetch bond orders from RCSB; they were inferred from the coordinates.');
      }
    }
    throw new Error(
      `Bond orders for ${group.resName} are not available offline. Load it by name or SMILES, or download its SDF from the PDB.`,
    );
  }

  // File input.
  const format = fileFormat(source.name, source.text);
  const title = source.name.replace(/\.[^.]+$/, '');

  if (format === 'smi') {
    const first = source.text.split('\n').map((l) => l.trim()).filter(Boolean)[0];
    if (!first) throw new Error('The file is empty.');
    const [smi, ...rest] = first.split(/\s+/);
    return loadLigand({ kind: 'smiles', smiles: smi, name: rest.join(' ') || title });
  }

  let raw: Molecule | undefined;
  if (format === 'sdf') raw = parseSDF(source.text)[0];
  else if (format === 'mol2') raw = parseMol2(source.text)[0];
  else {
    // Neither PDB nor PDBQT records bond orders, and guessing them from
    // distances alone silently changes the chemistry being docked.
    throw new Error(
      'PDB and PDBQT ligands carry no bond orders. Supply the ligand as SDF, MOL2 or SMILES so the chemistry is unambiguous.',
    );
  }
  if (!raw?.atoms.length) throw new Error('No molecule could be read from this file.');

  const { mol } = perceive(rd, raw);
  mol.title = raw.title || title;
  const single = largestFragment(mol);
  if (single.atoms.length !== mol.atoms.length) warnings.push('Salt or counter-ion removed; the largest fragment was kept.');
  const out = await ensure3D(rd, single, warnings);
  return {
    name: mol.title || title,
    molecule: out.mol,
    smiles: smilesOf(rd, out.mol),
    geometry: out.geometry === 'generated' ? 'generated' : 'file',
    embedReport: out.report,
    warnings,
  };
}

export function prepareLigandForDocking(ligand: LoadedLigand): PreparedLigand {
  return prepareLigand(ligand.molecule, { resName: 'LIG' });
}

/* ──────────────────────────────── search box ────────────────────────────── */

export interface SearchBox {
  center: Vec3;
  size: Vec3;
}

export const BOX_LIMITS = { min: 8, max: 40 };

/** Box that encloses a hetero group with padding, which is the usual redocking setup. */
export function boxAroundHetero(group: HetGroup, padding = 5): SearchBox {
  const size = group.max.map((v, i) => clampEdge(v - group.min[i] + 2 * padding)) as Vec3;
  return { center: [...group.center] as Vec3, size };
}

export function clampEdge(v: number): number {
  return Math.max(BOX_LIMITS.min, Math.min(BOX_LIMITS.max, Math.round(v * 10) / 10));
}

/** Rough guide to how long a run will take, used to warn about huge boxes. */
export function boxVolume(box: SearchBox): number {
  return box.size[0] * box.size[1] * box.size[2];
}

export function boxWarning(box: SearchBox, torsions: number): string | null {
  const v = boxVolume(box);
  if (v > 27000) return 'This search space is very large; docking will be slow and less reliable. Consider a box around one site.';
  if (v > 13824 && torsions > 10) return 'A large box combined with a flexible ligand needs high exhaustiveness to sample properly.';
  if (v < 1000) return 'This box is small — check that the whole ligand can fit inside it.';
  return null;
}
