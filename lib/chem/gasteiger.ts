/**
 * Gasteiger–Marsili PEOE partial charges (Tetrahedron 1980, 36, 3219).
 * Parameters (a, b, c) per element/hybridisation follow RDKit's
 * GasteigerParams table. Vina's scoring ignores charges, but AutoDock 4 and
 * downstream tools expect them in the PDBQT charge column.
 */
import { adjacency, type Molecule } from './molecule';

type Hyb = 'sp' | 'sp2' | 'sp3';

const PARAMS: Record<string, Partial<Record<Hyb, [number, number, number]>>> = {
  H: { sp3: [7.17, 6.24, -0.56] },
  C: { sp3: [7.98, 9.18, 1.88], sp2: [8.79, 9.32, 1.51], sp: [10.39, 9.45, 0.73] },
  N: { sp3: [11.54, 10.82, 1.36], sp2: [12.87, 11.15, 0.85], sp: [15.68, 11.7, -0.27] },
  O: { sp3: [14.18, 12.92, 1.39], sp2: [17.07, 13.79, 0.47] },
  F: { sp3: [14.66, 13.85, 2.31] },
  Cl: { sp3: [11.0, 9.69, 1.35] },
  Br: { sp3: [10.08, 8.47, 1.16] },
  I: { sp3: [9.9, 7.96, 0.96] },
  S: { sp3: [10.14, 9.13, 1.38], sp2: [10.88, 9.485, 1.325] },
  P: { sp3: [8.9, 8.24, 0.96] },
  B: { sp3: [5.98, 6.82, 1.605], sp2: [6.42, 6.24, -0.56] },
  Si: { sp3: [7.3, 6.567, 0.657] },
};

/** Electronegativity of hydrogen's cation, a special case in the PEOE scheme. */
const H_PLUS = 20.02;

/** Approximate hybridisation from the bond graph (conjugated N/O count as sp2). */
export function hybridisation(m: Molecule, adj = adjacency(m)): Hyb[] {
  const base: Hyb[] = m.atoms.map((a, i) => {
    let doubles = 0;
    let triples = 0;
    for (const [, bi] of adj[i]) {
      const b = m.bonds[bi];
      if (b.order === 3) triples++;
      else if (b.order === 2) doubles++;
    }
    if (triples || doubles >= 2) return 'sp';
    if (doubles || a.aromatic) return 'sp2';
    return 'sp3';
  });
  // Lone-pair atoms next to a π system (amide N, aniline N, ester/phenol O) are conjugated.
  return base.map((h, i) => {
    const el = m.atoms[i].el;
    if (h !== 'sp3' || (el !== 'N' && el !== 'O' && el !== 'S')) return h;
    if (el === 'N' && adj[i].length > 3) return h;
    return adj[i].some(([j]) => base[j] !== 'sp3' && m.atoms[j].el !== 'H') ? 'sp2' : h;
  });
}

export function gasteigerCharges(m: Molecule, iterations = 6): number[] {
  const adj = adjacency(m);
  const hyb = hybridisation(m, adj);
  const params = m.atoms.map((a, i) => {
    const table = PARAMS[a.el];
    if (!table) return null;
    return table[hyb[i]] ?? table.sp3 ?? table.sp2 ?? null;
  });
  const q = m.atoms.map((a) => a.charge);
  const chiPlus = params.map((p, i) => (m.atoms[i].el === 'H' ? H_PLUS : p ? p[0] + p[1] + p[2] : 0));

  let damp = 1;
  for (let it = 0; it < iterations; it++) {
    damp *= 0.5;
    const chi = params.map((p, i) => (p ? p[0] + p[1] * q[i] + p[2] * q[i] * q[i] : 0));
    const dq = new Array<number>(q.length).fill(0);
    for (const b of m.bonds) {
      const i = b.a;
      const j = b.b;
      if (!params[i] || !params[j]) continue;
      // Charge flows from the less to the more electronegative atom, scaled by the donor's cation χ.
      if (chi[j] > chi[i]) {
        const t = ((chi[j] - chi[i]) / chiPlus[i]) * damp;
        dq[i] += t;
        dq[j] -= t;
      } else {
        const t = ((chi[i] - chi[j]) / chiPlus[j]) * damp;
        dq[j] += t;
        dq[i] -= t;
      }
    }
    for (let k = 0; k < q.length; k++) q[k] += dq[k];
  }
  return q.map((v) => (Number.isFinite(v) ? v : 0));
}
