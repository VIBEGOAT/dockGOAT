import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { parsePDB, hetGroups } from '../lib/chem/pdb';
import { detectPockets } from '../lib/docking/pocket';
import { dist, type Vec3 } from '../lib/chem/geometry';

const pdb = (id: string) =>
  parsePDB(gunzipSync(readFileSync(new URL(`./fixtures/${id}.pdb.gz`, import.meta.url))).toString('utf8'));

/** Complexes with a well-known, buried orthosteric site. */
const CASES: { id: string; ligand: string; chains?: string[] }[] = [
  { id: '1hsg', ligand: 'MK1' },
  { id: '3ptb', ligand: 'BEN' },
  { id: '1stp', ligand: 'BTN' },
  { id: '1iep', ligand: 'STI', chains: ['A'] },
];

test('the top-ranked pockets cover the co-crystallised ligand site', () => {
  for (const c of CASES) {
    const s = pdb(c.id);
    const lig = hetGroups(s).find((h) => h.resName === c.ligand && (!c.chains || c.chains.includes(h.chain)));
    assert.ok(lig, `${c.id}: ${c.ligand} present in the fixture`);

    const started = Date.now();
    const pockets = detectPockets(s, { chains: c.chains });
    const ms = Date.now() - started;
    assert.ok(pockets.length > 0, `${c.id}: at least one pocket`);
    assert.ok(ms < 1500, `${c.id}: detection took ${ms} ms`);

    const top = pockets.slice(0, 3);
    const nearest = Math.min(
      ...top.map((p) => Math.min(...p.points.map((pt: Vec3) => dist(pt, lig.center)), dist(p.center, lig.center))),
    );
    assert.ok(nearest < 4, `${c.id}: ligand centre is ${nearest.toFixed(1)} A from the top-3 pockets`);

    const hit = top.find((p) => p.points.some((pt: Vec3) => dist(pt, lig.center) < 4));
    assert.ok(hit, `${c.id}: a top-3 pocket contains the ligand centre`);
    // The suggested box must be usable by Vina and actually enclose the ligand.
    for (const edge of hit.boxSize) assert.ok(edge >= 14 && edge <= 30, `${c.id}: box edge ${edge}`);
    for (let k = 0; k < 3; k++)
      assert.ok(
        Math.abs(hit.center[k] - lig.center[k]) < hit.boxSize[k] / 2,
        `${c.id}: ligand centre inside the suggested box on axis ${k}`,
      );
    assert.ok(hit.residues.length > 4, `${c.id}: pocket is lined by residues`);
    assert.ok(hit.buriedness > 0.5 && hit.buriedness <= 1, `${c.id}: buriedness ${hit.buriedness}`);
    assert.ok(hit.volume > 50, `${c.id}: volume ${hit.volume}`);
  }
});

test('pockets are ranked, capped and deterministic', () => {
  const s = pdb('3ptb');
  const a = detectPockets(s);
  const b = detectPockets(s);
  assert.deepEqual(
    a.map((p) => p.score),
    b.map((p) => p.score),
    'detection is deterministic',
  );
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].score >= a[i].score, 'sorted by score');
  assert.deepEqual(a.map((p) => p.rank), a.map((_, i) => i + 1));
  assert.ok(detectPockets(s, { maxPockets: 3 }).length <= 3);
  assert.deepEqual(detectPockets({ ...s, atoms: [] }), []);
});
