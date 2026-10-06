/**
 * Adding hydrogens to a molecule that already has 3D heavy-atom coordinates.
 *
 * Crystal structures and most downloaded SDFs omit hydrogens. Regenerating a
 * whole conformer to get them would throw away the experimentally determined
 * geometry — which is exactly the geometry a redocking validation needs — so
 * here the heavy atoms are kept exactly where they are and only the hydrogens
 * are built, from the local geometry of each centre.
 */
import { freeDirections, leastCrowded, perceiveTyping, xhLength, type AtomTyping } from './conformer';
import type { Vec3 } from './geometry';
import { adjacency, type MolAtom, type Molecule } from './molecule';

const pos = (a: MolAtom): Vec3 => [a.x, a.y, a.z];

function addDirection(centre: Vec3, dir: Vec3, length: number): Vec3 {
  return [centre[0] + dir[0] * length, centre[1] + dir[1] * length, centre[2] + dir[2] * length];
}

/**
 * Append `implicitH[i]` hydrogens to each atom `i`, keeping every existing atom
 * at its current index and coordinates. New hydrogens are appended in atom
 * order, so an index map into the original molecule stays valid.
 *
 * Heavier centres are filled first and each hydrogen is placed in the least
 * crowded free direction, so added hydrogens do not clash with each other or
 * with nearby heavy atoms.
 */
export function addHydrogens3D(mol: Molecule, implicitH: number[]): Molecule {
  const total = implicitH.reduce((s, n) => s + Math.max(0, n | 0), 0);
  if (!total) return { ...mol, atoms: mol.atoms.map((a) => ({ ...a })), bonds: mol.bonds.map((b) => ({ ...b })) };

  const atoms: MolAtom[] = mol.atoms.map((a) => ({ ...a }));
  const bonds = mol.bonds.map((b) => ({ ...b }));
  const adj = adjacency(mol);
  const typing: AtomTyping = perceiveTyping(mol, implicitH);

  // Coordinates of everything placed so far, used for the crowding test.
  const coords: Vec3[] = atoms.map(pos);
  const placed = atoms.map(() => true);

  // Fill the most substituted centres first: they have the fewest free
  // directions, so their hydrogens are the most constrained.
  const order = mol.atoms
    .map((_, i) => i)
    .filter((i) => implicitH[i] > 0)
    .sort((a, b) => adj[b].length - adj[a].length);

  for (const i of order) {
    const count = implicitH[i] | 0;
    const centre = coords[i];
    const nbrs = adj[i].map(([j]) => j);
    const nbrPos = nbrs.map((j) => coords[j]);

    // With a single neighbour the torsion is undetermined; a second-shell atom
    // fixes it so the hydrogens come out staggered (or in-plane for sp2).
    let ref: Vec3 | null = null;
    if (nbrs.length === 1) {
      const far = adj[nbrs[0]].map(([k]) => k).find((k) => k !== i);
      if (far !== undefined) ref = coords[far];
    }

    const dirs = freeDirections(centre, nbrPos, typing.geom[i], ref);
    if (!dirs.length) continue;
    const length = xhLength(mol.atoms[i].el, typing.geom[i]);
    const chosen = leastCrowded(dirs, count, centre, length, coords, placed, i, nbrs);

    for (const dir of chosen) {
      const p = addDirection(centre, dir, length);
      const index = atoms.length;
      atoms.push({
        el: 'H',
        x: p[0],
        y: p[1],
        z: p[2],
        charge: 0,
        aromatic: false,
      });
      bonds.push({ a: i, b: index, order: 1, aromatic: false, stereo: 0 });
      coords.push(p);
      placed.push(true);
    }
  }

  return {
    title: mol.title,
    atoms,
    bonds,
    // The result is real 3D geometry even if the molecule happens to be planar.
    props: { ...mol.props, dimensionality: '3D' },
  };
}

/**
 * Place one extra hydrogen on `atomIndex`, e.g. when protonating an amine or a
 * carboxylate. Returns a new molecule with the hydrogen appended.
 */
export function addHydrogenTo(mol: Molecule, atomIndex: number): Molecule {
  const implicit = mol.atoms.map((_, i) => (i === atomIndex ? 1 : 0));
  return addHydrogens3D(mol, implicit);
}
