/**
 * Bioavailability radar.
 *
 * The six axes and their optimal windows are SwissADME's (Daina, Michielin &
 * Zoete, Sci. Rep. 2017, 7, 42717): a molecule whose hexagon stays inside the
 * pink area is "drug-like" on all six counts. SwissADME uses XLOGP3 for LIPO;
 * we use WLOGP. The `display` ranges are our plotting choice, not part of the
 * published method - only `optimal` is.
 */
import { round } from './descriptors';
import type { RadarAxisDef, RadarAxisValue } from './types';

export const RADAR_REFERENCE = 'Daina, Michielin & Zoete, Sci. Rep. 2017, 7, 42717';

export const RADAR_AXES: readonly RadarAxisDef[] = [
  {
    key: 'LIPO',
    label: 'Lipophilicity',
    property: 'WLOGP',
    unit: '',
    optimal: [-0.7, 5],
    display: [-3, 7],
  },
  {
    key: 'SIZE',
    label: 'Size',
    property: 'Molecular weight',
    unit: 'g/mol',
    optimal: [150, 500],
    display: [0, 600],
  },
  {
    key: 'POLAR',
    label: 'Polarity',
    property: 'TPSA',
    unit: 'A^2',
    optimal: [20, 130],
    display: [0, 180],
  },
  {
    key: 'INSOLU',
    label: 'Insolubility',
    property: 'ESOL log S',
    unit: 'log mol/L',
    optimal: [-6, 0],
    display: [0, -10],
  },
  {
    key: 'INSATU',
    label: 'Insaturation',
    property: 'Fraction Csp3',
    unit: '',
    optimal: [0.25, 1],
    display: [0, 1],
  },
  {
    key: 'FLEX',
    label: 'Flexibility',
    property: 'Rotatable bonds',
    unit: '',
    optimal: [0, 9],
    display: [0, 15],
  },
];

function place(axis: RadarAxisDef, value: number): number {
  const [from, to] = axis.display;
  const t = (value - from) / (to - from);
  return Math.min(1, Math.max(0, t));
}

export interface RadarInput {
  wlogp: number;
  mw: number;
  tpsa: number;
  logS: number;
  fractionCsp3: number;
  rotatableBonds: number;
}

export function bioavailabilityRadar(input: RadarInput): RadarAxisValue[] {
  const values: Record<RadarAxisDef['key'], number> = {
    LIPO: input.wlogp,
    SIZE: input.mw,
    POLAR: input.tpsa,
    INSOLU: input.logS,
    INSATU: input.fractionCsp3,
    FLEX: input.rotatableBonds,
  };
  return RADAR_AXES.map((axis) => {
    const value = values[axis.key];
    const [lo, hi] = axis.optimal;
    const band: [number, number] = [place(axis, lo), place(axis, hi)];
    return {
      ...axis,
      value: round(value, 2),
      inRange: value >= lo && value <= hi,
      position: round(place(axis, value), 4),
      optimalPosition: [round(Math.min(...band), 4), round(Math.max(...band), 4)],
    };
  });
}
