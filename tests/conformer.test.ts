import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupRDKit } from './setup';
import { parseSmiles, toMolblock } from '../lib/chem/rdkit';
import { embed3D } from '../lib/chem/conformer';
import { adjacency, findRings } from '../lib/chem/molecule';
import { dihedral, dist } from '../lib/chem/geometry';
import type { Molecule } from '../lib/chem/molecule';

const PANEL: [string, string][] = [
  ['aspirin', 'CC(=O)Oc1ccccc1C(=O)O'],
  ['ibuprofen', 'CC(C)Cc1ccc(cc1)C(C)C(=O)O'],
  ['caffeine', 'Cn1cnc2c1c(=O)n(C)c(=O)n2C'],
  ['imatinib', 'Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1'],
  ['oseltamivir', 'CCC(CC)O[C@@H]1C=C(C(=O)OCC)C[C@H](N)[C@H]1NC(C)=O'],
  ['celecoxib', 'Cc1ccc(-c2cc(C(F)(F)F)nn2-c2ccc(S(N)(=O)=O)cc2)cc1'],
  ['morphine', 'CN1CC[C@]23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5'],
  ['cholesterol', 'CC(C)CCC[C@@H](C)[C@H]1CC[C@H]2[C@@H]3CC=C4C[C@@H](O)CC[C@]4(C)[C@H]3CC[C@]12C'],
  ['penicillinG', 'CC1(C)S[C@@H]2[C@H](NC(=O)Cc3ccccc3)C(=O)N2[C@H]1C(=O)O'],
  ['testosterone', 'C[C@]12CC[C@H]3[C@@H](CC[C@H]4CC(=O)CC[C@]34C)[C@@H]1CC[C@@H]2O'],
  ['E-stilbene', 'C(=C/c1ccccc1)\c1ccccc1'],
  ['Z-stilbene', 'C(=C\c1ccccc1)/c1ccccc1'],
  ['cyclohexane', 'C1CCCCC1'],
  ['adamantane', 'C1C2CC3CC1CC(C2)C3'],
  ['spiro', 'O=C1CCC2(CC1)CCCC2'],
  ['cyclopropyl', 'OC(=O)C1CC1c1ccccc1'],
  ['macrocycle', 'O=C1CCCCCCCCCCCCN1'],
  ['carboxylate', 'CC(=O)[O-]'],
  ['ammonium', 'C[NH3+]'],
  ['alkyne', 'CC#CCO'],
  ['sulfonamide', 'NS(=O)(=O)c1ccccc1'],
];

function build(rd: Awaited<ReturnType<typeof setupRDKit>>, smiles: string) {
  const p = parseSmiles(rd, smiles);
  const { mol, report } = embed3D(p.withH.mol, { seed: 0xc0ffee });
  return { mol, report, canonical: p.canonical };
}

/**
 * RDKit re-perceives stereochemistry from 3D coordinates when the molblock says
 * 3D. Returns both the isomeric SMILES and the stereo-free skeleton, because a
 * 3D model necessarily assigns a configuration even to centres the input left
 * unspecified (ibuprofen is sold as a racemate, for instance).
 */
function smilesFrom3D(
  rd: Awaited<ReturnType<typeof setupRDKit>>,
  mol: Molecule,
): { isomeric: string; flat: string } {
  const block = toMolblock(mol);
  assert.match(block.split('\n')[1], /3D/, 'molblock must be flagged 3D');
  const m = rd.get_mol(block, JSON.stringify({ removeHs: true }));
  assert.ok(m, 'RDKit could not read the generated molblock');
  try {
    return { isomeric: m.get_smiles(), flat: m.get_smiles(JSON.stringify({ doIsomericSmiles: false })) };
  } finally {
    m.delete();
  }
}

function stereoFree(rd: Awaited<ReturnType<typeof setupRDKit>>, smiles: string): string {
  const m = rd.get_mol(smiles)!;
  try {
    return m.get_smiles(JSON.stringify({ doIsomericSmiles: false }));
  } finally {
    m.delete();
  }
}

test('embed3D builds valid, stereochemically correct 3D structures', async () => {
  const rd = await setupRDKit();
  const started = Date.now();
  for (const [name, smiles] of PANEL) {
    const { mol, report, canonical } = build(rd, smiles);
    assert.ok(
      mol.atoms.every((a) => Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z)),
      `${name}: finite coordinates`,
    );
    // Molecules with sp3 centres must have genuine depth; stilbene and the
    // other fully conjugated ones are planar by chemistry, not by failure.
    if (/C[@(]|C1C|CC\(C\)/.test(smiles) && !/stilbene/.test(name))
      assert.ok(
        mol.atoms.some((a) => Math.abs(a.z) > 0.1),
        `${name}: sp3 centres should give the conformer depth`,
      );
    assert.ok(report.maxBondError < 0.08, `${name}: max bond error ${report.maxBondError.toFixed(3)} A`);
    assert.equal(report.chiralOk, true, `${name}: chirality preserved`);
    assert.equal(report.stereoBondsOk, true, `${name}: E/Z preserved`);
    assert.ok(report.minNonbonded > 2.4, `${name}: closest non-bonded ${report.minNonbonded.toFixed(2)} A`);

    const back = smilesFrom3D(rd, mol);
    assert.equal(back.flat, stereoFree(rd, canonical), `${name}: connectivity survives the 3D round trip`);
    // Only centres the input actually specified have a configuration to keep.
    if (/@|\/|\\/.test(canonical)) {
      assert.equal(back.isomeric, canonical, `${name}: stereochemistry survives the 3D round trip`);
    }
  }
  const secs = (Date.now() - started) / 1000;
  assert.ok(secs < 25, `panel of ${PANEL.length} molecules took ${secs.toFixed(1)}s`);
});

test('aromatic rings stay planar and cyclohexane puckers into a chair', async () => {
  const rd = await setupRDKit();
  const { mol: benzene } = build(rd, 'c1ccccc1');
  const ring = findRings(benzene).find((r) => r.length === 6)!;
  // Out-of-plane deviation: every ring torsion of a planar ring is ~0 or ~180.
  for (let i = 0; i < ring.length; i++) {
    const t = Math.abs(
      dihedral(
        ...([ring[i], ring[(i + 1) % 6], ring[(i + 2) % 6], ring[(i + 3) % 6]].map((k) => [
          benzene.atoms[k].x,
          benzene.atoms[k].y,
          benzene.atoms[k].z,
        ]) as [number[], number[], number[], number[]] as never),
      ),
    );
    assert.ok(t < 6 || t > 174, `benzene ring torsion ${t.toFixed(1)} deg`);
  }

  const { mol: chx } = build(rd, 'C1CCCCC1');
  const cring = findRings(chx).find((r) => r.length === 6)!;
  const torsions: number[] = [];
  for (let i = 0; i < 6; i++) {
    const idx = [cring[i], cring[(i + 1) % 6], cring[(i + 2) % 6], cring[(i + 3) % 6]];
    const [a, b, c, d] = idx.map((k) => [chx.atoms[k].x, chx.atoms[k].y, chx.atoms[k].z] as [number, number, number]);
    torsions.push(dihedral(a, b, c, d));
  }
  // A chair alternates +/-55 deg; a flat or boat ring does not.
  for (const t of torsions) assert.ok(Math.abs(Math.abs(t) - 55) < 15, `cyclohexane torsion ${t.toFixed(1)} deg`);
  for (let i = 0; i < 6; i++) assert.ok(torsions[i] * torsions[(i + 1) % 6] < 0, 'chair torsions alternate sign');
});

test('bond lengths to hydrogen are chemically sensible', async () => {
  const rd = await setupRDKit();
  const { mol } = build(rd, 'OC[C@H](N)C(=O)O');
  const adj = adjacency(mol);
  const expect: Record<string, [number, number]> = { C: [1.0, 1.15], N: [0.95, 1.08], O: [0.9, 1.02] };
  for (let i = 0; i < mol.atoms.length; i++) {
    if (mol.atoms[i].el !== 'H') continue;
    const [heavy] = adj[i][0];
    const el = mol.atoms[heavy].el;
    const d = dist(
      [mol.atoms[i].x, mol.atoms[i].y, mol.atoms[i].z],
      [mol.atoms[heavy].x, mol.atoms[heavy].y, mol.atoms[heavy].z],
    );
    const [lo, hi] = expect[el];
    assert.ok(d > lo && d < hi, `${el}-H length ${d.toFixed(3)} A`);
  }
});

test('embedding is deterministic for a given seed', async () => {
  const rd = await setupRDKit();
  const p = parseSmiles(rd, 'CC(C)Cc1ccc(cc1)C(C)C(=O)O');
  const a = embed3D(p.withH.mol, { seed: 42 }).mol;
  const b = embed3D(p.withH.mol, { seed: 42 }).mol;
  for (let i = 0; i < a.atoms.length; i++) {
    assert.ok(Math.abs(a.atoms[i].x - b.atoms[i].x) < 1e-9, 'same seed gives identical coordinates');
  }
});
