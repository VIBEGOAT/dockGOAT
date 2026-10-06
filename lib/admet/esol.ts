/**
 * ESOL - Estimated SOLubility.
 *
 * Delaney, J. S. "ESOL: Estimating Aqueous Solubility Directly from Molecular
 * Structure." J. Chem. Inf. Comput. Sci. 2004, 44, 1000-1005.
 *
 *   log S = 0.16 - 0.63 clogP - 0.0062 MW + 0.066 RB - 0.74 AP
 *
 * where AP is the aromatic proportion (aromatic heavy atoms / heavy atoms).
 * Delaney regressed against ClogP; like RDKit-based reimplementations (and
 * SwissADME's "ESOL" line) we substitute the Wildman-Crippen WLOGP, which is
 * what we have client-side.
 */
import { round } from './descriptors';
import type { Solubility, SolubilityClass } from './types';

export const ESOL_REFERENCE = 'Delaney, J. Chem. Inf. Comput. Sci. 2004, 44, 1000-1005';

/** SwissADME's solubility bands, from insoluble to highly soluble. */
export function solubilityClass(logS: number): SolubilityClass {
  if (logS < -10) return 'Insoluble';
  if (logS < -6) return 'Poorly soluble';
  if (logS < -4) return 'Moderately soluble';
  if (logS < -2) return 'Soluble';
  if (logS < 0) return 'Very soluble';
  return 'Highly soluble';
}

export function esol(params: {
  wlogp: number;
  mw: number;
  rotatableBonds: number;
  aromaticHeavyAtoms: number;
  heavyAtoms: number;
}): Solubility {
  const ap = params.heavyAtoms > 0 ? params.aromaticHeavyAtoms / params.heavyAtoms : 0;
  const logS =
    0.16 - 0.63 * params.wlogp - 0.0062 * params.mw + 0.066 * params.rotatableBonds - 0.74 * ap;
  const molPerL = 10 ** logS;
  return {
    logS: round(logS, 2),
    molPerL: Number(molPerL.toPrecision(3)),
    mgPerMl: Number((molPerL * params.mw).toPrecision(3)),
    class: solubilityClass(logS),
    method: 'ESOL (Delaney 2004), WLOGP substituted for ClogP',
    reference: ESOL_REFERENCE,
    terms: {
      clogp: round(params.wlogp, 2),
      mw: round(params.mw, 2),
      rotatableBonds: params.rotatableBonds,
      aromaticProportion: round(ap, 3),
    },
  };
}
