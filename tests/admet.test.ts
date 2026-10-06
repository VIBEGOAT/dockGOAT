import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupRDKit } from './setup';
import {
  BOILED_EGG,
  RADAR_AXES,
  alertCatalogStatus,
  isInside,
  profileMany,
  profileMolecule,
  profilesToCSV,
  solubilityClass,
  type AdmetProfile,
} from '../lib/admet';
import { molGraph, tpsa } from '../lib/admet/descriptors';

const SMILES = {
  aspirin: 'CC(=O)Oc1ccccc1C(=O)O',
  caffeine: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C',
  ibuprofen: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O',
  atorvastatin:
    'CC(C)c1c(C(=O)Nc2ccccc2)c(-c2ccccc2)c(-c2ccc(F)cc2)n1CC[C@@H](O)C[C@@H](O)CC(=O)O',
  sucrose: 'OC[C@H]1O[C@@](CO)(O[C@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@@H](O)[C@@H]1O',
  benzylideneRhodanine: 'O=C1NC(=S)SC1=Cc1ccccc1',
  nitrobenzene: 'O=[N+]([O-])c1ccccc1',
  verapamil: 'COc1ccc(CCN(C)CCCC(C#N)(C(C)C)c2ccc(OC)c(OC)c2)cc1OC',
  benzene: 'c1ccccc1',
  paracetamol: 'CC(=O)Nc1ccc(O)cc1',
  thiophene: 'c1ccsc1',
  nicotine: 'CN1CCC[C@H]1c1cccnc1',
};

/** Absolute-tolerance comparison with a readable failure message. */
function close(actual: number, expected: number, tol: number, what: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: expected ${expected} +/- ${tol}, got ${actual}`,
  );
}

/* ------------------------------------------------------------- identity */

test('aspirin: identity and physicochemical reference values', async () => {
  const rd = await setupRDKit();
  const p = profileMolecule(rd, SMILES.aspirin, 'aspirin');

  assert.equal(p.identity.name, 'aspirin');
  assert.equal(p.identity.canonicalSmiles, 'CC(=O)Oc1ccccc1C(=O)O');
  assert.equal(p.identity.formula, 'C9H8O4');
  assert.equal(p.identity.inchiKey, 'BSYNRYMUTXBXSQ-UHFFFAOYSA-N');
  assert.ok(p.identity.inchi.startsWith('InChI=1S/C9H8O4'));

  close(p.physicochemical.mw, 180.16, 0.01, 'aspirin MW');
  close(p.physicochemical.exactMass, 180.0423, 0.001, 'aspirin exact mass');
  close(p.physicochemical.tpsa, 63.6, 0.01, 'aspirin TPSA');
  close(p.lipophilicity.wlogp, 1.31, 0.01, 'aspirin WLOGP');
  assert.equal(p.physicochemical.heavyAtoms, 13);
  assert.equal(p.physicochemical.aromaticHeavyAtoms, 6);
  assert.equal(p.physicochemical.hbaLipinski, 4);
  assert.equal(p.physicochemical.hbdLipinski, 1);
  assert.equal(p.physicochemical.rotatableBonds, 2);
  assert.equal(p.physicochemical.formalCharge, 0);
  assert.equal(p.drugLikeness.rules[0].violations, 0);
  assert.equal(p.drugLikeness.rules[0].pass, true);
});

test('caffeine and ibuprofen reference values', async () => {
  const rd = await setupRDKit();
  const caffeine = profileMolecule(rd, SMILES.caffeine, 'caffeine');
  assert.equal(caffeine.identity.formula, 'C8H10N4O2');
  assert.equal(caffeine.identity.inchiKey, 'RYYVLZVUVIJVGH-UHFFFAOYSA-N');
  close(caffeine.physicochemical.mw, 194.19, 0.01, 'caffeine MW');
  close(caffeine.physicochemical.tpsa, 58.44, 0.01, 'caffeine TPSA');
  close(caffeine.lipophilicity.wlogp, -1.03, 0.01, 'caffeine WLOGP');
  assert.equal(caffeine.drugLikeness.rules[0].violations, 0);

  const ibuprofen = profileMolecule(rd, SMILES.ibuprofen, 'ibuprofen');
  assert.equal(ibuprofen.identity.formula, 'C13H18O2');
  close(ibuprofen.physicochemical.mw, 206.28, 0.02, 'ibuprofen MW');
  close(ibuprofen.physicochemical.tpsa, 37.3, 0.01, 'ibuprofen TPSA');
  close(ibuprofen.lipophilicity.wlogp, 3.07, 0.02, 'ibuprofen WLOGP');
  assert.equal(ibuprofen.drugLikeness.rules[0].violations, 0);
  // Carboxylic acid, no basic centre, TPSA < 75 -> the top Abbott band.
  assert.equal(ibuprofen.drugLikeness.bioavailability.anionic, true);
  assert.equal(ibuprofen.drugLikeness.bioavailability.score, 0.85);
});

test('atorvastatin breaks the rule of five on size and lipophilicity', async () => {
  const rd = await setupRDKit();
  const p = profileMolecule(rd, SMILES.atorvastatin, 'atorvastatin');
  close(p.physicochemical.mw, 558.64, 0.05, 'atorvastatin MW');
  const lipinski = p.drugLikeness.rules[0];
  assert.equal(lipinski.violations, 2);
  assert.equal(lipinski.pass, false);
  const failed = lipinski.criteria.filter((c) => !c.pass).map((c) => c.label);
  assert.deepEqual(failed, ['MW', 'WLOGP']);
  assert.equal(p.drugLikeness.rules[1].name, 'Ghose');
  assert.ok(p.drugLikeness.rules[1].violations > 0, 'Ghose should also fail');
});

/* ------------------------------------------------------------------ TPSA */

test('our Ertl TPSA port reproduces RDKit, and adds S/P only when asked', async () => {
  const rd = await setupRDKit();
  // On RDKit's own aromaticity model the port must agree to the last digit.
  for (const smiles of [SMILES.aspirin, SMILES.caffeine, SMILES.atorvastatin, SMILES.sucrose, SMILES.nicotine]) {
    const mol = rd.get_mol(smiles)!;
    try {
      const rdkitTpsa = (JSON.parse(mol.get_descriptors()) as { tpsa: number }).tpsa;
      const ours = tpsa(molGraph(mol), false, 'rdkit');
      close(ours, rdkitTpsa, 1e-6, `TPSA(N,O only) for ${smiles}`);
    } finally {
      mol.delete();
    }
  }
  // The reported value uses Ertl's own convention, where a ring with an
  // exocyclic C=O is not aromatic. These are PubChem's published values.
  const ertl: [string, number][] = [
    [SMILES.caffeine, 58.44],
    ['Cn1c(=O)c2[nH]cnc2n(C)c1=O', 69.3], // theophylline
    ['O=c1cc[nH]c(=O)[nH]1', 58.2], // uracil
    ['O=c1ccc2ccccc2o1', 26.3], // coumarin
    ['O=c1cccc[nH]1', 29.1], // 2-pyridone
    ['c1ccncc1', 12.89], // pyridine is untouched: no exocyclic carbonyl
  ];
  for (const [smiles, value] of ertl) {
    const mol = rd.get_mol(smiles)!;
    try {
      close(tpsa(molGraph(mol), false), value, 0.06, `Ertl TPSA for ${smiles}`);
    } finally {
      mol.delete();
    }
  }
  // Thiophene has no N or O: the default TPSA is 0, the SwissADME one is 28.24.
  const thiophene = profileMolecule(rd, SMILES.thiophene);
  assert.equal(thiophene.physicochemical.tpsaNoSulfurPhosphorus, 0);
  close(thiophene.physicochemical.tpsa, 28.24, 0.01, 'thiophene TPSA with S');
});

/* ------------------------------------------------------------------- QED */

test('QED matches RDKit to +/- 0.01', async () => {
  const rd = await setupRDKit();
  const expected: [string, number][] = [
    [SMILES.aspirin, 0.55],
    [SMILES.caffeine, 0.538],
    [SMILES.ibuprofen, 0.822],
  ];
  for (const [smiles, value] of expected) {
    const p = profileMolecule(rd, smiles);
    close(p.qed.score, value, 0.01, `QED for ${smiles}`);
    assert.ok(p.qed.score > 0 && p.qed.score <= 1);
  }
  // The eight QED properties are the ones QED.py computes, in its definitions.
  const aspirin = profileMolecule(rd, SMILES.aspirin);
  assert.equal(aspirin.qed.properties.AROM, 1);
  assert.equal(aspirin.qed.properties.HBD, 1);
  assert.equal(aspirin.qed.properties.ROTB, 2);
  close(aspirin.qed.properties.PSA, 63.6, 0.01, 'QED PSA');
  // Benzene has one aromatic ring and no aliphatic ring atoms to delete.
  assert.equal(profileMolecule(rd, SMILES.benzene).qed.properties.AROM, 1);
  // Nicotine's pyrrolidine is deleted before the ring count, leaving pyridine.
  assert.equal(profileMolecule(rd, SMILES.nicotine).qed.properties.AROM, 1);
});

/* ------------------------------------------------------------------ ESOL */

test('ESOL reproduces the Delaney regression', async () => {
  const rd = await setupRDKit();
  const p = profileMolecule(rd, SMILES.aspirin);
  const { clogp, mw, rotatableBonds, aromaticProportion } = p.solubility.terms;
  const byHand =
    0.16 - 0.63 * clogp - 0.0062 * mw + 0.066 * rotatableBonds - 0.74 * aromaticProportion;
  close(p.solubility.logS, byHand, 0.01, 'aspirin ESOL log S');
  // SwissADME reports log S -1.99 / 1.84 mg/mL / "Very soluble" for aspirin.
  close(p.solubility.logS, -1.99, 0.02, 'aspirin ESOL vs SwissADME');
  close(p.solubility.mgPerMl, 1.84, 0.05, 'aspirin solubility in mg/mL');
  assert.equal(p.solubility.class, 'Very soluble');

  // Delaney's own worked example: benzene, 6/6 aromatic atoms, no rotors.
  const benzene = profileMolecule(rd, SMILES.benzene);
  close(benzene.solubility.logS, -2.13, 0.05, 'benzene ESOL log S');
  assert.ok(
    Math.abs(benzene.solubility.logS - -1.64) < 1,
    'benzene ESOL should be within a log unit of the measured -1.64',
  );

  assert.equal(solubilityClass(-11), 'Insoluble');
  assert.equal(solubilityClass(-7), 'Poorly soluble');
  assert.equal(solubilityClass(-5), 'Moderately soluble');
  assert.equal(solubilityClass(-3), 'Soluble');
  assert.equal(solubilityClass(-1), 'Very soluble');
  assert.equal(solubilityClass(0.5), 'Highly soluble');
});

/* ------------------------------------------------------------ BOILED-Egg */

test('BOILED-Egg classification and geometry', async () => {
  const rd = await setupRDKit();

  const ibuprofen = profileMolecule(rd, SMILES.ibuprofen);
  assert.equal(ibuprofen.pharmacokinetics.gastrointestinalAbsorption, 'High');
  assert.equal(ibuprofen.pharmacokinetics.bbbPermeant, true);

  const atorvastatin = profileMolecule(rd, SMILES.atorvastatin);
  assert.equal(atorvastatin.pharmacokinetics.gastrointestinalAbsorption, 'Low');
  assert.equal(atorvastatin.pharmacokinetics.bbbPermeant, false);

  const sucrose = profileMolecule(rd, SMILES.sucrose);
  assert.equal(sucrose.pharmacokinetics.gastrointestinalAbsorption, 'Low');
  assert.equal(sucrose.pharmacokinetics.bbbPermeant, false);

  // Caffeine sits in the white but below the yolk (its WLOGP is -1.03 and the
  // yolk bottoms out near +0.41), so it is HIA-high but not BBB-permeant.
  const caffeine = profileMolecule(rd, SMILES.caffeine);
  assert.equal(caffeine.pharmacokinetics.gastrointestinalAbsorption, 'High');
  assert.equal(caffeine.pharmacokinetics.bbbPermeant, false);

  // Geometry: the yolk sits inside the white, both centred near the published
  // extents (white spans TPSA 0-142, yolk 0-79).
  close(BOILED_EGG.hia.cx + BOILED_EGG.hia.rx, 142.05, 0.1, 'white TPSA upper extent');
  close(BOILED_EGG.bbb.cx + BOILED_EGG.bbb.rx, 79.1, 0.1, 'yolk TPSA upper extent');
  assert.equal(isInside(BOILED_EGG.bbb, 38.07, 3.18), true, 'yolk centre is inside the yolk');
  assert.equal(isInside(BOILED_EGG.hia, 38.07, 3.18), true, 'yolk centre is inside the white');
  assert.equal(isInside(BOILED_EGG.hia, 200, 0), false, 'very polar is outside the white');
  assert.equal(isInside(BOILED_EGG.bbb, 40, 10), false, 'very lipophilic is outside the yolk');
});

/* ---------------------------------------------------------- alert catalogues */

test('PAINS and Brenk catalogues compile', async () => {
  const rd = await setupRDKit();
  const status = alertCatalogStatus(rd);
  const total = Object.fromEntries(status.map((s) => [s.family, s]));
  assert.equal(total['PAINS A'].total + total['PAINS B'].total + total['PAINS C'].total, 480);
  assert.equal(total['Brenk'].total, 105);
  for (const s of status) {
    assert.equal(s.compiled, s.total, `${s.family}: RDKit rejected ${s.skipped.join(', ')}`);
  }
});

test('a 5-benzylidene rhodanine trips the PAINS filter', async () => {
  const rd = await setupRDKit();
  const p = profileMolecule(rd, SMILES.benzylideneRhodanine, 'benzylidene rhodanine');
  assert.ok(p.medChemAlerts.painsCount > 0, 'expected at least one PAINS hit');
  assert.ok(
    p.medChemAlerts.pains.some((h) => h.name.startsWith('ene_rhod')),
    `expected an ene_rhod hit, got ${p.medChemAlerts.pains.map((h) => h.name).join(', ')}`,
  );
  const hit = p.medChemAlerts.pains[0];
  assert.ok(hit.atomIndices.length > 0 && hit.atomIndices[0].length > 0, 'hits carry atom indices');
  assert.ok(
    hit.atomIndices.every((m) => m.every((i) => i >= 0 && i < p.physicochemical.heavyAtoms)),
    'atom indices are in range',
  );
  assert.ok(p.flags.some((f) => f.text.startsWith('PAINS:')));
  // Aspirin is clean.
  assert.equal(profileMolecule(rd, SMILES.aspirin).medChemAlerts.painsCount, 0);
});

/* -------------------------------------------------------------- toxicity */

test('Kazius aromatic-nitro toxicophore and the hERG heuristic', async () => {
  const rd = await setupRDKit();
  const nitro = profileMolecule(rd, SMILES.nitrobenzene, 'nitrobenzene');
  const names = nitro.toxicityAlerts.ames.map((a) => a.name);
  assert.ok(names.includes('aromatic_nitro'), `got ${names.join(', ')}`);
  const alert = nitro.toxicityAlerts.ames.find((a) => a.name === 'aromatic_nitro')!;
  assert.ok(alert.atomIndices[0].length >= 3, 'the nitro group is matched by atom index');
  assert.match(alert.reference, /Kazius/);
  assert.ok(nitro.toxicityAlerts.disclaimer.length > 0);
  assert.ok(nitro.flags.some((f) => f.text.includes('Ames toxicophore')));

  // Aniline is an aromatic amine (Kazius) and a bioactivation alert.
  const aniline = profileMolecule(rd, 'Nc1ccccc1');
  assert.ok(aniline.toxicityAlerts.ames.some((a) => a.name === 'aromatic_amine'));
  assert.ok(aniline.toxicityAlerts.reactive.some((a) => a.name === 'aniline'));

  // Paracetamol carries the para-aminophenol quinone-imine alert.
  const paracetamol = profileMolecule(rd, SMILES.paracetamol);
  assert.ok(paracetamol.toxicityAlerts.reactive.some((a) => a.name === 'para_aminophenol'));

  // Verapamil: tertiary amine plus high lipophilicity -> high hERG flag.
  const verapamil = profileMolecule(rd, SMILES.verapamil, 'verapamil');
  assert.equal(verapamil.toxicityAlerts.herg.basicCentre, true);
  assert.equal(verapamil.toxicityAlerts.herg.risk, 'High');
  // Aspirin has neither a basic centre nor high logP.
  const aspirin = profileMolecule(rd, SMILES.aspirin);
  assert.equal(aspirin.toxicityAlerts.herg.basicCentre, false);
  assert.equal(aspirin.toxicityAlerts.herg.risk, 'Low');
  assert.equal(aspirin.toxicityAlerts.ames.length, 0);
});

/* ----------------------------------------------------------------- radar */

test('bioavailability radar has the six SwissADME axes', async () => {
  const rd = await setupRDKit();
  const p = profileMolecule(rd, SMILES.aspirin);
  assert.deepEqual(
    p.radar.map((a) => a.key),
    ['LIPO', 'SIZE', 'POLAR', 'INSOLU', 'INSATU', 'FLEX'],
  );
  assert.equal(RADAR_AXES.length, 6);
  for (const axis of p.radar) {
    assert.ok(axis.position >= 0 && axis.position <= 1, `${axis.key} position in 0..1`);
    assert.ok(axis.optimalPosition[0] <= axis.optimalPosition[1]);
  }
  const lipo = p.radar.find((a) => a.key === 'LIPO')!;
  assert.equal(lipo.inRange, true, 'aspirin WLOGP 1.31 is inside -0.7..5');
  // MW 180 sits inside the 150-500 SIZE window, but with one sp3 carbon out of
  // nine aspirin is far below the 0.25 saturation floor.
  assert.equal(p.radar.find((a) => a.key === 'SIZE')!.inRange, true);
  assert.equal(p.radar.find((a) => a.key === 'INSATU')!.inRange, false);
});

/* ------------------------------------------------------------ batch & CSV */

const BATCH_SMILES: string[] = [
  SMILES.aspirin,
  SMILES.caffeine,
  SMILES.ibuprofen,
  SMILES.paracetamol,
  SMILES.nicotine,
  SMILES.atorvastatin,
  SMILES.verapamil,
  SMILES.benzylideneRhodanine,
  SMILES.nitrobenzene,
  SMILES.sucrose,
  'OC(=O)c1ccccc1O',
  'CCN(CC)CCNC(=O)c1ccc(N)cc1',
  'CN1C2CCC1CC(C2)OC(=O)C(CO)c1ccccc1',
  'CC(N)Cc1ccccc1',
  'CN(C)CCCN1c2ccccc2Sc2ccccc21',
  'Clc1ccccc1',
  'c1ccc2ccccc2c1',
  'c1ccc2cc3ccccc3cc2c1',
  'O=C(O)CCc1ccccc1',
  'CCO',
  'CC(C)(C)NCC(O)c1ccc(O)c(CO)c1',
  'COc1ccc2cc(ccc2c1)C(C)C(=O)O',
  'CN(C)CCCN1c2ccccc2CCc2ccccc21',
  'OC(Cn1cncn1)(c1ccc(F)cc1)c1ccc(F)cc1',
  'CC(C)NCC(O)COc1cccc2ccccc12',
  'Cc1ccccc1',
  'CC(=O)Nc1ccccc1',
  'NS(=O)(=O)c1cc2c(cc1Cl)NCNS2(=O)=O',
  'CCOC(=O)c1ccccc1N',
  'NS(=O)(=O)c1ccc(N)cc1',
  'Nc1ccccc1',
  'c1ccsc1',
  'c1ccoc1',
  'C1CCCCC1',
  'CC(C)(C)c1ccc(O)cc1',
  'OCC(O)CO',
  'NCCc1ccc(O)c(O)c1',
  'CN1C(=O)CN=C(c2ccccc2)c2cc(Cl)ccc21',
  'OC(=O)c1ccccc1',
  'CCCCOC(=O)c1ccc(N)cc1',
];

test('batch profiling of 200 molecules stays under the interactive budget', async () => {
  const rd = await setupRDKit();
  const items = Array.from({ length: 200 }, (_, i) => ({
    smiles: BATCH_SMILES[i % BATCH_SMILES.length],
    name: `mol-${i}`,
  }));
  // Warm the SMARTS caches first: the measurement is of profiling, not of
  // compiling ~750 query molecules once per page load.
  profileMolecule(rd, SMILES.aspirin);
  const started = Date.now();
  const results = profileMany(rd, items);
  const elapsed = Date.now() - started;

  assert.equal(results.length, 200);
  const failures = results.filter((r) => 'error' in r);
  assert.deepEqual(failures, [], `all batch SMILES should parse`);
  assert.ok(elapsed < 5000, `200 molecules took ${elapsed} ms, expected under 5000 ms`);
});

test('CSV export is flat and rectangular', async () => {
  const rd = await setupRDKit();
  const profiles = [SMILES.aspirin, SMILES.caffeine, SMILES.benzylideneRhodanine].map((s, i) =>
    profileMolecule(rd, s, `mol ${i}, with a comma`),
  );
  const csv = profilesToCSV(profiles);
  const lines = csv.split('\n');
  assert.equal(lines.length, 4);
  const header = lines[0].split(',');
  assert.ok(header.includes('qed'));
  assert.ok(header.includes('bbb_permeant'));
  assert.ok(header.includes('pains_alerts'));
  // Quoted fields keep the row width right.
  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quoted) {
        if (c !== '"') cur += c;
        else if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === ',') {
        cells.push(cur);
        cur = '';
      } else cur += c;
    }
    cells.push(cur);
    return cells;
  };
  for (const line of lines.slice(1)) {
    assert.equal(parseRow(line).length, header.length, `row width: ${line.slice(0, 60)}`);
  }
  assert.equal(parseRow(lines[1])[0], 'mol 0, with a comma');
  assert.ok(lines[1].startsWith('"mol 0, with a comma"'), 'commas in names are quoted');
  assert.equal(profilesToCSV([]), lines[0]);
});

/* ---------------------------------------------------------------- errors */

test('invalid SMILES raise a clear error', async () => {
  const rd = await setupRDKit();
  assert.throws(() => profileMolecule(rd, 'not-a-molecule'), /Could not parse SMILES/);
  assert.throws(() => profileMolecule(rd, 'c1ccccc'), /Could not parse SMILES/);
  assert.throws(() => profileMolecule(rd, '   '), /Enter a SMILES string/);

  const mixed = profileMany(rd, [
    { smiles: SMILES.aspirin, name: 'ok' },
    { smiles: 'C1CC', name: 'broken' },
  ]);
  assert.ok(!('error' in mixed[0]));
  const bad = mixed[1] as { error: string; smiles: string; name?: string };
  assert.match(bad.error, /Could not parse SMILES/);
  assert.equal(bad.name, 'broken');
  assert.equal(bad.smiles, 'C1CC');
});

test('profiles are JSON-serialisable round trip', async () => {
  const rd = await setupRDKit();
  const p = profileMolecule(rd, SMILES.atorvastatin, 'atorvastatin');
  const back = JSON.parse(JSON.stringify(p)) as AdmetProfile;
  assert.deepEqual(back, p);
  assert.ok(back.flags.length > 0);
  assert.ok(back.flags.every((f) => ['info', 'warn', 'alert'].includes(f.severity)));
});
