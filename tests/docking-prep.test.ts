import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupRDKit } from './setup';
import { perceive } from '../lib/chem/rdkit';
import { parseSDF } from '../lib/chem/molfile';
import { parsePDB, hetGroups } from '../lib/chem/pdb';
import { prepareReceptor } from '../lib/docking/receptor';
import { assignAdTypes, prepareLigand, rotatableBonds } from '../lib/docking/ligand';
import { gasteigerCharges } from '../lib/chem/gasteiger';
import { dist } from '../lib/chem/geometry';

const fx = (f: string) => readFileSync(new URL(`./fixtures/dock/${f}`, import.meta.url), 'utf8');

test('receptor preparation of 1IEP chain A', () => {
  const s = parsePDB(fx('1IEP.pdb'));
  const het = hetGroups(s);
  assert.ok(het.some((h) => h.resName === 'STI' && h.chain === 'A'));
  const r = prepareReceptor(s, { chains: ['A'] });
  assert.deepEqual(r.stats.chains, ['A']);
  assert.ok(r.stats.removedWaters > 0);
  assert.ok(r.stats.removedHetero.some((k) => k.includes('STI')));
  assert.ok(r.stats.polarHydrogens > 200, `polar H ${r.stats.polarHydrogens}`);
  const lines = r.pdbqt.split('\n').filter((l) => l.startsWith('ATOM') || l.startsWith('HETATM'));
  for (const l of lines) {
    assert.ok(l.length >= 79, `short line: ${l}`);
    assert.match(l.slice(77, 79).trim(), /^(C|A|N|NA|OA|SA|HD|Zn|Fe|Mg|Ca|Mn|P|F|Cl|Br|I)$/);
  }
  // Every added H must sit ~1 Å from its parent and not clash with other heavy atoms.
  const atoms = r.structure.atoms;
  const heavy = atoms.filter((a) => a.el !== 'H');
  for (const h of atoms.filter((a) => a.el === 'H')) {
    const d = Math.min(...heavy.map((a) => dist([a.x, a.y, a.z], [h.x, h.y, h.z])));
    assert.ok(d > 0.9 && d < 1.4, `H ${h.name} ${h.resName}${h.resSeq} nearest heavy ${d.toFixed(2)}`);
  }
  // Backbone amide N with H must be typed N, His NE2 (HIE) N, ND1 NA.
  const his = atoms.filter((a) => a.resName === 'HIS' && (a.name === 'ND1' || a.name === 'NE2'));
  assert.ok(his.some((a) => a.name === 'ND1' && a.adType === 'NA'));
});

test('ligand preparation of imatinib (PubChem 3D)', async () => {
  const rd = await setupRDKit();
  const raw = parseSDF(fx('imatinib_3d.sdf'))[0];
  const { mol } = perceive(rd, raw);
  assert.equal(mol.atoms.length, 68);
  const types = assignAdTypes(mol);
  const count = (t: string) => types.filter((x) => x === t).length;
  assert.equal(count('A'), 21, 'aromatic carbons (6 + 6 + 4 pyrimidine + 5 pyridine)');
  assert.equal(count('OA'), 1);
  assert.equal(count('HD'), 2, 'two N-H donors');
  // Imatinib: amide N and aniline NH are N; pyridine, 2 pyrimidine N, piperazine N's are NA.
  assert.equal(count('N') + count('NA'), 7);
  assert.equal(count('NA'), 5);
  const rot = rotatableBonds(mol);
  // biaryl, 2× aryl–NH, aryl–N(amide), C(=O)–aryl, aryl–CH2, CH2–N(piperazine); amide C–N rigid
  assert.equal(rot.length, 7);
  const q = gasteigerCharges(mol);
  assert.ok(Math.abs(q.reduce((s, v) => s + v, 0)) < 1e-6, 'neutral molecule sums to 0');
  const p = prepareLigand(mol);
  assert.match(p.pdbqt, /^ROOT$/m);
  assert.match(p.pdbqt, /^TORSDOF 7$/m);
  const atomLines = p.pdbqt.split('\n').filter((l) => l.startsWith('ATOM'));
  assert.equal(atomLines.length, 37 + 2, 'heavy atoms + 2 polar H');
  assert.equal(p.atomMap.length, atomLines.length);
  const branches = p.pdbqt.split('\n').filter((l) => l.startsWith('BRANCH')).length;
  assert.equal(branches, 7);
});
