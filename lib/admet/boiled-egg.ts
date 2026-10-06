/**
 * The BOILED-Egg: Brain Or IntestinaL EstimateD permeation.
 *
 * Daina, A.; Zoete, V. "A BOILED-Egg To Predict Gastrointestinal Absorption
 * and Brain Penetration of Small Molecules." ChemMedChem 2016, 11, 1117-1121.
 *
 * Two ellipses in the (TPSA, WLOGP) plane: the white predicts high passive
 * gastrointestinal absorption (HIA), the yolk predicts passive blood-brain
 * barrier permeation. TPSA must be the Ertl value *including* sulfur and
 * phosphorus, which is the variant SwissADME reports.
 *
 * Provenance of the geometry: the paper gives the ellipses graphically, with
 * the boundary coordinates in its supporting information. The parameters below
 * were recovered by an exact least-squares conic fit (maximum residual 0.0,
 * i.e. the points lie on a true ellipse) to that published boundary as
 * tabulated in pyBOILEDegg (B. F. Milne, doi:10.5281/zenodo.4725382); only the
 * fitted geometry is reproduced here, no code. The fit agrees to within ~0.1 %
 * with the ellipse parameters that circulate in community re-implementations
 * (centre 71.051/2.292, axes 142.081 x 8.740, -1.03 deg for the white;
 * 38.117/3.177, 82.061 x 5.557, -0.17 deg for the yolk).
 */
import type { Ellipse } from './types';

export const BOILED_EGG_REFERENCE = 'Daina & Zoete, ChemMedChem 2016, 11, 1117-1121';

/** True when (tpsa, wlogp) lies inside the ellipse (boundary counts as inside). */
export function isInside(e: Ellipse, tpsa: number, wlogp: number): boolean {
  const dx = tpsa - e.cx;
  const dy = wlogp - e.cy;
  const cos = Math.cos(-e.rotation);
  const sin = Math.sin(-e.rotation);
  const u = dx * cos - dy * sin;
  const v = dx * sin + dy * cos;
  return (u / e.rx) ** 2 + (v / e.ry) ** 2 <= 1;
}

/**
 * Egg geometry for plotting and classification. x = TPSA (A^2), y = WLOGP.
 * `rotation` is in radians (both ellipses are tilted barely below horizontal).
 */
export const BOILED_EGG: {
  hia: Ellipse;
  bbb: Ellipse;
  isInside: (e: Ellipse, tpsa: number, wlogp: number) => boolean;
  reference: string;
} = {
  /** White: high passive gastrointestinal absorption. */
  hia: { cx: 71.027362, cy: 2.294541, rx: 71.017809, ry: 4.355863, rotation: -0.018241 },
  /** Yolk: likely passive BBB permeation. */
  bbb: { cx: 38.068649, cy: 3.184948, rx: 41.031823, ry: 2.777643, rotation: -0.002767 },
  isInside,
  reference: BOILED_EGG_REFERENCE,
};

export interface EggResult {
  gastrointestinalAbsorption: 'High' | 'Low';
  bbbPermeant: boolean;
}

export function classifyEgg(tpsa: number, wlogp: number): EggResult {
  return {
    gastrointestinalAbsorption: isInside(BOILED_EGG.hia, tpsa, wlogp) ? 'High' : 'Low',
    bbbPermeant: isInside(BOILED_EGG.bbb, tpsa, wlogp),
  };
}
