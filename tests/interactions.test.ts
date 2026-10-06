import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { setupRDKit } from './setup';
import { perceive } from '../lib/chem/rdkit';
import { parseSDF } from '../lib/chem/molfile';
import { parsePDB, type Structure } from '../lib/chem/pdb';
import { analyzeInteractions, type InteractionReport } from '../lib/docking/interactions';
import type { Molecule } from '../lib/chem/molecule';

const pdb = (id: string): Structure =>
  parsePDB(gunzipSync(readFileSync(new URL(`./fixtures/${id}.pdb.gz`, import.meta.url))).toString('utf8'));

async function ligand(rd: Awaited<ReturnType<typeof setupRDKit>>, file: string): Promise<Molecule> {
  const raw = parseSDF(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8'))[0];
  return perceive(rd, raw).mol;
}

const residuesOfType = (r: InteractionReport, type: string) =>
  new Set(r.interactions.filter((i) => i.type === type).map((i) => `${i.resName}${i.resSeq}`));
const allResidues = (r: InteractionReport) => new Set(r.interactions.map((i) => `${i.resName}${i.resSeq}`));

test('trypsin + benzamidine: the Asp189 salt bridge is found', async () => {
  const rd = await setupRDKit();
  const report = analyzeInteractions(pdb('3ptb'), await ligand(rd, '3ptb_BEN.sdf'));

  // The amidinium/Asp189 carboxylate pair is the textbook anchor of this complex.
  assert.ok(
    residuesOfType(report, 'salt-bridge').has('ASP189') || residuesOfType(report, 'hbond').has('ASP189'),
    `expected an Asp189 contact, got ${[...allResidues(report)].join(', ')}`,
  );
  // Specificity pocket residues line the site.
  const contacts = new Set(report.contactResidues.map((c) => c.residue.split(':')[1]));
  for (const r of ['ASP189', 'GLY216', 'SER190']) assert.ok(contacts.has(r), `${r} should be a contact residue`);
  assert.ok(report.interactions.length >= 3, 'several interactions detected');
  for (const i of report.interactions) {
    assert.ok(i.distance > 0 && i.distance < 10, `${i.type} distance ${i.distance}`);
    assert.ok(i.ligandAtoms.length > 0 && i.receptorAtoms.length > 0);
    assert.ok(i.detail.length > 0);
  }
});

test('streptavidin + biotin: the hydrogen-bond network is reproduced', async () => {
  const rd = await setupRDKit();
  const report = analyzeInteractions(pdb('1stp'), await ligand(rd, '1stp_BTN.sdf'));
  const hb = residuesOfType(report, 'hbond');
  // Biotin's ureido and carboxylate groups hydrogen bond to this well-known set.
  const known = ['ASN23', 'TYR43', 'SER27', 'SER45', 'ASN49', 'SER88', 'THR90', 'ASP128'];
  const found = known.filter((r) => hb.has(r));
  assert.ok(found.length >= 4, `expected >=4 of ${known.join('/')}, found ${found.join(', ') || 'none'}`);
  assert.ok(residuesOfType(report, 'hydrophobic').size > 0, 'hydrophobic contacts in the biotin pocket');
});

test('HIV-1 protease + indinavir: catalytic aspartates are engaged', async () => {
  const rd = await setupRDKit();
  const report = analyzeInteractions(pdb('1hsg'), await ligand(rd, '1hsg_MK1.sdf'));
  const polar = new Set([...residuesOfType(report, 'hbond'), ...residuesOfType(report, 'salt-bridge')]);
  assert.ok(polar.has('ASP25') || polar.has('ASP29') || polar.has('ASP30'), `catalytic/flap Asp contact, got ${[...polar].join(', ')}`);
  assert.ok(report.counts.hydrophobic > 3, 'indinavir makes many hydrophobic contacts');
  // The report must be self-consistent.
  const total = Object.values(report.counts).reduce((a, b) => a + b, 0);
  assert.equal(total, report.interactions.length);
});

test('contactResidues are sorted and the report is JSON-safe', async () => {
  const rd = await setupRDKit();
  const report = analyzeInteractions(pdb('3ptb'), await ligand(rd, '3ptb_BEN.sdf'));
  for (let i = 1; i < report.contactResidues.length; i++)
    assert.ok(report.contactResidues[i - 1].minDistance <= report.contactResidues[i].minDistance);
  assert.deepEqual(JSON.parse(JSON.stringify(report)).counts, report.counts);
});
