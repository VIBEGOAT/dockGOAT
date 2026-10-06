import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupRDKit } from './setup';
import { perceive } from '../lib/chem/rdkit';
import { parseSDF } from '../lib/chem/molfile';
import { addHydrogens3D } from '../lib/chem/hydrogens';
import { prepareLigand } from '../lib/docking/ligand';
import { poseMolecule, redockingRmsd, heavyAtomAutomorphisms, symmetricRmsd } from '../lib/docking/poses';
import type { Vec3 } from '../lib/chem/geometry';

async function imatinibCrystal() {
  const rd = await setupRDKit();
  const raw = parseSDF(readFileSync(new URL('./fixtures/dock/1iep_STI.sdf', import.meta.url), 'utf8'))[0];
  const p = perceive(rd, raw);
  const mol = addHydrogens3D(p.mol, p.implicitH);
  return { rd, mol, prep: prepareLigand(mol, { resName: 'LIG' }) };
}

test('a pose identical to the input gives an RMSD of zero', async () => {
  const { rd, mol, prep } = await imatinibCrystal();
  // "Dock" the ligand to exactly where it already is.
  const coords: Vec3[] = prep.atomMap.map((i) => [mol.atoms[i].x, mol.atoms[i].y, mol.atoms[i].z]);
  const pose = poseMolecule(mol, prep.atomMap, coords);
  const rmsd = redockingRmsd(rd, mol, prep.atomMap, pose);
  assert.ok(rmsd < 1e-9, `expected 0, got ${rmsd}`);
});

test('a rigidly translated pose gives exactly the translation distance', async () => {
  const { rd, mol, prep } = await imatinibCrystal();
  const shift: Vec3 = [1.5, -2, 0.5];
  const expected = Math.hypot(...shift);
  const coords: Vec3[] = prep.atomMap.map((i) => [
    mol.atoms[i].x + shift[0],
    mol.atoms[i].y + shift[1],
    mol.atoms[i].z + shift[2],
  ]);
  const pose = poseMolecule(mol, prep.atomMap, coords);
  const rmsd = redockingRmsd(rd, mol, prep.atomMap, pose);
  assert.ok(Math.abs(rmsd - expected) < 1e-6, `expected ${expected.toFixed(4)}, got ${rmsd.toFixed(4)}`);
});

test('indexing the pose by source order would be wrong, and the helper avoids it', async () => {
  const { rd, mol, prep } = await imatinibCrystal();
  const coords: Vec3[] = prep.atomMap.map((i) => [mol.atoms[i].x, mol.atoms[i].y, mol.atoms[i].z]);
  const pose = poseMolecule(mol, prep.atomMap, coords);

  // The PDBQT order is a torsion-tree order, not the source order.
  assert.notDeepEqual(prep.atomMap.slice(0, 10), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

  // Comparing by source index pairs unrelated atoms and gives a large value.
  const heavy = mol.atoms.map((a, i) => (a.el === 'H' ? -1 : i)).filter((i) => i >= 0);
  const naive = Math.sqrt(
    heavy.reduce((s, i) => {
      const a = pose.atoms[i];
      const b = mol.atoms[i];
      return s + (a ? (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 : 0);
    }, 0) / heavy.length,
  );
  assert.ok(naive > 1, `the naive comparison should be badly wrong, got ${naive.toFixed(2)}`);
  assert.ok(redockingRmsd(rd, mol, prep.atomMap, pose) < 1e-9, 'the helper is correct');
});

test('symmetry-equivalent atoms do not inflate the RMSD', async () => {
  const rd = await setupRDKit();
  // Benzene: rotating the ring by one position is the same molecule.
  const { parseSmiles } = await import('../lib/chem/rdkit');
  const { embed3D } = await import('../lib/chem/conformer');
  const benzene = embed3D(parseSmiles(rd, 'c1ccccc1').withH.mol, { seed: 3 }).mol;
  const { heavy, maps } = heavyAtomAutomorphisms(rd, benzene);
  assert.equal(heavy.length, 6);
  assert.ok(maps.length >= 12, `benzene has 12 automorphisms, found ${maps.length}`);

  const coords = heavy.map((i) => [benzene.atoms[i].x, benzene.atoms[i].y, benzene.atoms[i].z] as Vec3);
  const rotated = [...coords.slice(1), coords[0]];
  assert.ok(symmetricRmsd(rotated, coords, maps) < 1e-6, 'a ring rotation is matched by symmetry');
});
