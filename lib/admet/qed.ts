/**
 * QED - quantitative estimate of drug-likeness (Bickerton et al., Nat. Chem.
 * 2012, 4, 90-98).
 *
 * This is a faithful port of RDKit's `rdkit/Chem/QED.py` (BSD-3-Clause,
 * Copyright (c) 2009-2017 Novartis Institutes for BioMedical Research Inc.):
 * same eight properties, same desirability parameters, same acceptor SMARTS,
 * same 116 structural alerts and the same "delete aliphatic ring atoms, then
 * count SSSR rings" definition of the aromatic-ring term. Values therefore
 * agree with `rdkit.Chem.QED.qed` rather than with the original publication,
 * which used Pipeline Pilot descriptors.
 */
import type { RDKit, RDMol } from '../chem/rdkit';
import {
  QED_ACCEPTOR_SMARTS,
  QED_ADS_PARAMETERS,
  QED_ALERT_SMARTS,
  QED_ALIPHATIC_RING_SMARTS,
  QED_PROPERTY_NAMES,
  QED_WEIGHT_MAX,
  QED_WEIGHT_MEAN,
  QED_WEIGHT_NONE,
  type AdsParameter,
  type QedPropertyName,
} from './data/qed-data';
import { sssrCountWithout, tpsa, type MolGraph, type RdkitDescriptors } from './descriptors';
import { countMatches, hasMatch, matchAtoms, queryMol } from './smarts';
import type { Qed, QedProperties } from './types';

export const QED_REFERENCE =
  'Bickerton et al., Nat. Chem. 2012, 4, 90-98 (implementation: RDKit QED.py)';

/** Asymmetric double sigmoidal desirability function. */
export function ads(x: number, p: AdsParameter): number {
  const exp1 = 1 + Math.exp((-1 * (x - p.C + p.D / 2)) / p.E);
  const exp2 = 1 + Math.exp((-1 * (x - p.C - p.D / 2)) / p.F);
  return (p.A + (p.B / exp1) * (1 - 1 / exp2)) / p.DMAX;
}

/** The eight QED properties, computed exactly as QED.py computes them. */
export function qedProperties(
  rd: RDKit,
  mol: RDMol,
  graph: MolGraph,
  desc: RdkitDescriptors,
): QedProperties {
  let hba = 0;
  for (const smarts of QED_ACCEPTOR_SMARTS) {
    const q = queryMol(rd, smarts);
    if (q) hba += countMatches(mol, q);
  }

  let alerts = 0;
  for (const smarts of QED_ALERT_SMARTS) {
    const q = queryMol(rd, smarts);
    if (q && hasMatch(mol, q)) alerts++;
  }

  // AROM: QED deletes every aliphatic ring atom that touches a non-aromatic
  // atom, then counts the rings that survive.
  const ringQuery = queryMol(rd, QED_ALIPHATIC_RING_SMARTS);
  const removed = new Set<number>();
  if (ringQuery) for (const m of matchAtoms(mol, ringQuery)) for (const i of m) removed.add(i);

  return {
    MW: desc.amw,
    ALOGP: desc.CrippenClogP,
    HBA: hba,
    HBD: desc.NumHBD,
    // QED reproduces RDKit's QED.py, which reads Descriptors.TPSA — so this one
    // stays on RDKit's aromaticity model even though we report the Ertl value.
    PSA: tpsa(graph, false, 'rdkit'),
    ROTB: desc.NumRotatableBonds,
    AROM: sssrCountWithout(graph, removed),
    ALERTS: alerts,
  };
}

function weightedQed(props: QedProperties, weights: readonly number[]): number {
  let t = 0;
  let wSum = 0;
  QED_PROPERTY_NAMES.forEach((name, i) => {
    const d = ads(props[name], QED_ADS_PARAMETERS[name]);
    t += weights[i] * Math.log(d);
    wSum += weights[i];
  });
  return Math.exp(t / wSum);
}

/** Per-property desirability, handy for a breakdown chart. */
export function qedDesirability(props: QedProperties): QedProperties {
  const out = {} as QedProperties;
  for (const name of QED_PROPERTY_NAMES) out[name] = ads(props[name], QED_ADS_PARAMETERS[name as QedPropertyName]);
  return out;
}

export function computeQed(
  rd: RDKit,
  mol: RDMol,
  graph: MolGraph,
  desc: RdkitDescriptors,
): Qed {
  const properties = qedProperties(rd, mol, graph, desc);
  return {
    score: weightedQed(properties, QED_WEIGHT_MEAN),
    unweighted: weightedQed(properties, QED_WEIGHT_NONE),
    maxWeighted: weightedQed(properties, QED_WEIGHT_MAX),
    properties,
    desirability: qedDesirability(properties),
    reference: QED_REFERENCE,
  };
}
