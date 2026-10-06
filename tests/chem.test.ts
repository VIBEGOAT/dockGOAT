import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupRDKit } from './setup';
import { parseSmiles, perceive, smilesOf } from '../lib/chem/rdkit';
import { parseSDF, writeMolfile } from '../lib/chem/molfile';
import { findRings, molecularFormula, ringBondFlags } from '../lib/chem/molecule';

test('parseSmiles gives explicit-H 2D molecule with wedges', async () => {
  const rd = await setupRDKit();
  const p = parseSmiles(rd, 'C[C@H](N)C(=O)O', 'alanine');
  assert.equal(p.canonical, 'C[C@H](N)C(=O)O');
  assert.equal(p.inchikey, 'QNAYBMKLOCPYGJ-REOHCLBHSA-N');
  const m = p.withH.mol;
  assert.equal(molecularFormula(m), 'C3H7NO2');
  assert.ok(m.atoms.every((a) => Number.isFinite(a.x)));
  assert.ok(m.bonds.some((b) => b.stereo === 1 || b.stereo === 6), 'has a wedge');
  assert.equal(p.withH.cip.get(1), 'S');
});

test('aromaticity, rings and round trip', async () => {
  const rd = await setupRDKit();
  const p = parseSmiles(rd, 'c1ccc2c(c1)cc[nH]2');
  const m = p.withH.mol;
  assert.equal(m.atoms.filter((a) => a.aromatic).length, 9);
  const rings = findRings(m);
  assert.deepEqual(rings.map((r) => r.length).sort(), [5, 6]);
  assert.equal(ringBondFlags(m).filter(Boolean).length, 10);
  const back = parseSDF(writeMolfile(m) + '\n$$$$\n')[0];
  const again = perceive(rd, back);
  assert.equal(smilesOf(rd, again.mol), 'c1ccc2[nH]ccc2c1');
});
