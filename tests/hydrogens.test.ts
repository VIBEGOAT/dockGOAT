import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupRDKit } from './setup';
import { perceive, parseSmiles, toMolblock } from '../lib/chem/rdkit';
import { parseSDF } from '../lib/chem/molfile';
import { addHydrogens3D } from '../lib/chem/hydrogens';
import { adjacency, removeAtoms, type Molecule } from '../lib/chem/molecule';
import { angle, dist, type Vec3 } from '../lib/chem/geometry';

const at = (m: Molecule, i: number): Vec3 => [m.atoms[i].x, m.atoms[i].y, m.atoms[i].z];

const IDEAL_XH: Record<string, [number, number]> = {
  C: [1.0, 1.15],
  N: [0.95, 1.08],
  O: [0.9, 1.02],
  S: [1.25, 1.42],
};

function checkHydrogens(m: Molecule, label: string) {
  const adj = adjacency(m);
  for (let i = 0; i < m.atoms.length; i++) {
    if (m.atoms[i].el !== 'H') continue;
    assert.equal(adj[i].length, 1, `${label}: H ${i} has one bond`);
    const heavy = adj[i][0][0];
    const el = m.atoms[heavy].el;
    const d = dist(at(m, i), at(m, heavy));
    const [lo, hi] = IDEAL_XH[el] ?? [0.9, 1.6];
    assert.ok(d > lo && d < hi, `${label}: ${el}-H length ${d.toFixed(3)} A`);

    // The angle to each other substituent must be chemically plausible.
    for (const [other] of adj[heavy]) {
      if (other === i) continue;
      const a = angle(at(m, i), at(m, heavy), at(m, other));
      assert.ok(a > 85 && a < 185, `${label}: H-${el}-X angle ${a.toFixed(1)} deg`);
    }
    // No hydrogen may sit on top of another atom.
    for (let j = 0; j < m.atoms.length; j++) {
      if (j === i || j === heavy) continue;
      if (adj[i].some(([k]) => k === j)) continue;
      assert.ok(dist(at(m, i), at(m, j)) > 1.2, `${label}: H ${i} clashes with atom ${j}`);
    }
  }
}

test('hydrogens are built onto a crystal ligand without moving its heavy atoms', async () => {
  const rd = await setupRDKit();
  const raw = parseSDF(readFileSync(new URL('./fixtures/dock/1iep_STI.sdf', import.meta.url), 'utf8'))[0];
  const p = perceive(rd, raw);
  assert.ok(!p.mol.atoms.some((a) => a.el === 'H'), 'the crystal ligand has no hydrogens');

  const withH = addHydrogens3D(p.mol, p.implicitH);
  assert.equal(withH.atoms.length, 37 + 31, 'imatinib: 37 heavy atoms + 31 hydrogens');

  // Every original atom keeps its index and its exact coordinates.
  for (let i = 0; i < p.mol.atoms.length; i++) {
    assert.equal(withH.atoms[i].el, p.mol.atoms[i].el);
    assert.equal(withH.atoms[i].x, p.mol.atoms[i].x, `atom ${i} x unchanged`);
    assert.equal(withH.atoms[i].y, p.mol.atoms[i].y);
    assert.equal(withH.atoms[i].z, p.mol.atoms[i].z);
  }
  checkHydrogens(withH, 'imatinib');

  // The chemistry must be unchanged.
  const back = rd.get_mol(toMolblock(withH), JSON.stringify({ removeHs: true }))!;
  try {
    assert.equal(back.get_smiles(), 'Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1');
  } finally {
    back.delete();
  }
});

test('re-adding stripped hydrogens reproduces sensible geometry', async () => {
  const rd = await setupRDKit();
  for (const smiles of ['OC[C@H](N)C(=O)O', 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', 'CSCC[C@H](N)C(=O)O', 'c1ccc2[nH]ccc2c1']) {
    const built = parseSmiles(rd, smiles);
    const { embed3D } = await import('../lib/chem/conformer');
    const full = embed3D(built.withH.mol, { seed: 7 }).mol;

    const hIdx = new Set(full.atoms.map((a, i) => (a.el === 'H' ? i : -1)).filter((i) => i >= 0));
    const stripped = removeAtoms(full, hIdx).mol;
    const perceived = perceive(rd, stripped);
    const rebuilt = addHydrogens3D(perceived.mol, perceived.implicitH);

    assert.equal(rebuilt.atoms.length, full.atoms.length, `${smiles}: hydrogen count restored`);
    checkHydrogens(rebuilt, smiles);
  }
});

test('addHydrogens3D is a no-op when nothing is implicit', async () => {
  const rd = await setupRDKit();
  const p = parseSmiles(rd, 'CCO');
  const same = addHydrogens3D(p.withH.mol, p.withH.mol.atoms.map(() => 0));
  assert.equal(same.atoms.length, p.withH.mol.atoms.length);
});
