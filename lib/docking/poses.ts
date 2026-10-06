/**
 * Turning Vina poses back into molecules, plus symmetry-corrected RMSD.
 */
import type { Vec3 } from '../chem/geometry';
import { dist2 } from '../chem/geometry';
import type { Molecule } from '../chem/molecule';
import { toMolblock, withMol, type RDKit } from '../chem/rdkit';

/**
 * Molecule for one pose: the atoms written to the PDBQT (heavy atoms + polar
 * H) at the docked coordinates, with the bonds between them.
 */
export function poseMolecule(source: Molecule, atomMap: number[], coords: Vec3[], title = source.title): Molecule {
  const newIndex = new Map<number, number>();
  const atoms = atomMap.map((src, k) => {
    newIndex.set(src, k);
    const a = source.atoms[src];
    const c = coords[k] ?? [a.x, a.y, a.z];
    return { ...a, x: c[0], y: c[1], z: c[2] };
  });
  const bonds = source.bonds
    .filter((b) => newIndex.has(b.a) && newIndex.has(b.b))
    .map((b) => ({ ...b, a: newIndex.get(b.a)!, b: newIndex.get(b.b)!, stereo: 0 }));
  return { title, atoms, bonds, props: { ...source.props } };
}

/**
 * Graph automorphisms of the heavy-atom skeleton (via RDKit substructure
 * matching of the molecule onto itself), used for symmetry-corrected RMSD.
 * Returned mappings are over heavy-atom indices of `m`.
 */
export function heavyAtomAutomorphisms(rd: RDKit, m: Molecule, max = 2000): { heavy: number[]; maps: number[][] } {
  const heavy = m.atoms.map((a, i) => (a.el === 'H' ? -1 : i)).filter((i) => i >= 0);
  const block = toMolblock(m);
  try {
    return withMol(
      rd,
      block,
      (mol) => {
        // With removeHs the RDKit atom order is the heavy-atom order of the input.
        const query = rd.get_qmol(mol.get_smarts());
        if (!query) return { heavy, maps: [heavy.map((_, k) => k)] };
        try {
          const json = mol.get_substruct_matches(query, JSON.stringify({ uniquify: false, maxMatches: max, useChirality: false }));
          const matches = JSON.parse(json) as { atoms: number[] }[];
          const maps = matches.map((mm) => mm.atoms).filter((a) => a.length === heavy.length);
          return { heavy, maps: maps.length ? maps : [heavy.map((_, k) => k)] };
        } finally {
          query.delete();
        }
      },
      { removeHs: true },
    );
  } catch {
    return { heavy, maps: [heavy.map((_, k) => k)] };
  }
}

/**
 * Minimum heavy-atom RMSD between two conformers of the same molecule over all
 * symmetry-equivalent atom mappings (no superposition — the docking frame is shared).
 */
export function symmetricRmsd(a: Vec3[], b: Vec3[], maps: number[][]): number {
  let best = Infinity;
  for (const map of maps) {
    let s = 0;
    for (let k = 0; k < map.length; k++) s += dist2(a[k], b[map[k]]);
    best = Math.min(best, Math.sqrt(s / map.length));
  }
  return best;
}

/**
 * Symmetry-corrected heavy-atom RMSD between a docked pose and the
 * conformation the ligand was built from. When that input was the ligand's own
 * crystal pose this is the redocking validation: below 2 A is the usual success
 * criterion.
 *
 * `pose` is a molecule from `poseMolecule`, whose atoms are indexed by position
 * in the PDBQT (`atomMap`), not by position in `source` — mixing the two
 * silently compares unrelated atoms.
 */
export function redockingRmsd(rd: RDKit, source: Molecule, atomMap: number[], pose: Molecule): number {
  const poseIndexOf = new Map<number, number>();
  atomMap.forEach((original, k) => poseIndexOf.set(original, k));

  const { heavy, maps } = heavyAtomAutomorphisms(rd, source);
  const reference: Vec3[] = [];
  const docked: Vec3[] = [];
  for (const i of heavy) {
    const k = poseIndexOf.get(i);
    const atom = k === undefined ? undefined : pose.atoms[k];
    // Every heavy atom is written to the PDBQT, so a gap means the pose and the
    // source are not the same molecule and no RMSD is meaningful.
    if (!atom) return NaN;
    reference.push([source.atoms[i].x, source.atoms[i].y, source.atoms[i].z]);
    docked.push([atom.x, atom.y, atom.z]);
  }
  return symmetricRmsd(docked, reference, maps);
}
