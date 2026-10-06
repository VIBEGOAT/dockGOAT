import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { setupRDKit } from './setup';
import { loadLigand, prepareLigandForDocking, boxAroundHetero, boxWarning, clampEdge } from '../lib/workbench/inputs';
import { hetGroups, parsePDB } from '../lib/chem/pdb';
import { parseSDF } from '../lib/chem/molfile';
import { dist } from '../lib/chem/geometry';

test('a ligand from SMILES becomes a valid flexible PDBQT', async () => {
  await setupRDKit();
  const lig = await loadLigand({ kind: 'smiles', smiles: 'CC(=O)Oc1ccccc1C(=O)O', name: 'Aspirin' });
  assert.equal(lig.geometry, 'generated');
  assert.equal(lig.smiles, 'CC(=O)Oc1ccccc1C(=O)O');
  assert.ok(lig.molecule.atoms.some((a) => a.el === 'H'), 'explicit hydrogens');
  assert.ok(lig.molecule.atoms.some((a) => Math.abs(a.z) > 0.05), '3D coordinates');

  const prep = prepareLigandForDocking(lig);
  assert.match(prep.pdbqt, /^ROOT$/m);
  assert.match(prep.pdbqt, /^TORSDOF \d+$/m);
  const atomLines = prep.pdbqt.split('\n').filter((l) => l.startsWith('ATOM'));
  assert.equal(atomLines.length, prep.atomMap.length);
  for (const l of atomLines) assert.ok(l.length >= 78, `PDBQT line too short: ${l}`);
  // Aspirin: 13 heavy atoms + 1 polar H on the acid.
  assert.equal(atomLines.length, 14);
});

test('salts are stripped to the largest fragment', async () => {
  await setupRDKit();
  const lig = await loadLigand({ kind: 'smiles', smiles: 'CC(=O)Oc1ccccc1C(=O)[O-].[Na+]', name: 'Sodium acetylsalicylate' });
  assert.ok(lig.warnings.some((w) => /counter-ion/i.test(w)), 'warns about the removed salt');
  assert.ok(!lig.molecule.atoms.some((a) => a.el === 'Na'), 'sodium removed');
});

test('an SDF file that already has 3D coordinates and hydrogens is used as supplied', async () => {
  await setupRDKit();
  const text = readFileSync(new URL('./fixtures/dock/imatinib_3d.sdf', import.meta.url), 'utf8');
  const lig = await loadLigand({ kind: 'file', name: 'imatinib_3d.sdf', text });
  assert.equal(lig.geometry, 'file', 'coordinates came from the file, not from us');
  assert.equal(lig.molecule.atoms.length, 68);
  assert.equal(lig.embedReport, undefined, 'no conformer was generated');
  const prep = prepareLigandForDocking(lig);
  assert.match(prep.pdbqt, /^TORSDOF 7$/m);
});

test('a ligand file without hydrogens gains them without losing its pose', async () => {
  await setupRDKit();
  const text = readFileSync(new URL('./fixtures/dock/1iep_STI.sdf', import.meta.url), 'utf8');
  const lig = await loadLigand({ kind: 'file', name: '1iep_STI.sdf', text });
  assert.equal(lig.geometry, 'file', 'the supplied geometry is kept, not regenerated');
  assert.ok(lig.molecule.atoms.some((a) => a.el === 'H'), 'hydrogens added');
  assert.equal(lig.embedReport, undefined, 'no conformer was generated');
  // The heavy atoms still match the deposited coordinates.
  const crystal = parseSDF(text)[0];
  for (let i = 0; i < crystal.atoms.length; i++) {
    assert.ok(
      Math.abs(lig.molecule.atoms[i].x - crystal.atoms[i].x) < 1e-6,
      `heavy atom ${i} moved`,
    );
  }
});

test('PDB ligands are rejected with an explanation rather than guessed at', async () => {
  await setupRDKit();
  await assert.rejects(
    () => loadLigand({ kind: 'file', name: 'lig.pdb', text: 'HETATM    1  C1  LIG A   1       0.000   0.000   0.000  1.00  0.00           C\nEND\n' }),
    /no bond orders/i,
  );
});

test('the suggested box encloses a co-crystallised ligand', () => {
  const s = parsePDB(gunzipSync(readFileSync(new URL('./fixtures/1iep.pdb.gz', import.meta.url))).toString('utf8'));
  const sti = hetGroups(s).find((h) => h.resName === 'STI' && h.chain === 'A')!;
  const box = boxAroundHetero(sti);
  for (let k = 0; k < 3; k++) {
    assert.ok(box.size[k] >= sti.max[k] - sti.min[k], 'box spans the ligand');
    assert.ok(Math.abs(box.center[k] - sti.center[k]) < 1e-6);
  }
  assert.ok(dist(box.center, sti.center) < 1e-6);
  assert.equal(clampEdge(500), 40);
  assert.equal(clampEdge(1), 8);
  assert.ok(boxWarning({ center: [0, 0, 0], size: [35, 35, 35] }, 5)?.includes('very large'));
  assert.equal(boxWarning(box, 7), null);
});
