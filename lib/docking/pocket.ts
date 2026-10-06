/**
 * Binding-site (cavity) detection with a LIGSITE-style grid scan
 * (Hendlich, Rippmann & Barnickel, J Mol Graph Model 1997; the 7-direction
 * protein–solvent–protein scan of LIGSITEcs, Huang & Schroeder, BMC Struct
 * Biol 2006).
 *
 * The protein is mapped onto a cubic grid; points within an atom's van der
 * Waals radius plus a probe radius are "protein", the rest "solvent". Every
 * solvent point is then scored by how many of the 7 scan directions (x, y, z
 * and the 4 cube diagonals) see protein on both sides of it (a PSP event).
 * Deeply enclosed solvent points (high PSP count) are clustered into pockets.
 *
 * Everything runs on flat typed arrays so a 5 000-atom protein takes tens of
 * milliseconds on the browser main thread.
 */
import { element } from '../chem/elements';
import type { Vec3 } from '../chem/geometry';
import { AMINO_ACIDS, WATER_NAMES, residueKey, type StructAtom, type Structure } from '../chem/pdb';

export interface Pocket {
  /** 1-based identifier, equal to the rank at detection time (stable for UI keys). */
  id: number;
  /** 1 = best. */
  rank: number;
  /** Centroid of the pocket grid points. */
  center: Vec3;
  /** Suggested Vina box: pocket extent + padding, each edge clamped to [minBox, maxBox]. */
  boxSize: Vec3;
  /** Å^3 (points × spacing^3). */
  volume: number;
  /** Mean PSP count / 7 (0–1). */
  buriedness: number;
  score: number;
  /** residueKey()s of residues with an atom within `residueCutoff` of a pocket point (file order). */
  residues: string[];
  /** Evenly subsampled pocket points (≤ maxDisplayPoints) for display. */
  points: Vec3[];
}

export interface PocketOptions {
  /** Grid spacing in Å (default 1.0). */
  spacing?: number;
  /** Probe radius added to each atom's vdW radius when marking protein points (default 1.2 Å). */
  probe?: number;
  /** Minimum PSP events (of 7) for a solvent point to count as buried (default 5). */
  minPSP?: number;
  /**
   * Longest solvent gap (Å) that still counts as enclosed along a scan line
   * (default 16 Å). Unlimited scans make whole inter-domain clefts light up.
   */
  maxGap?: number;
  /** Clusters smaller than this (Å^3) are dropped (default 30). */
  minVolume?: number;
  /** Maximum number of pockets returned (default 10). */
  maxPockets?: number;
  /** Treat non-water hetero groups (cofactors, ligands, ions) as part of the protein (default false). */
  includeHetero?: boolean;
  /** Only use atoms from these chains. */
  chains?: string[];
  /** Residue-lining cutoff in Å (default 4). */
  residueCutoff?: number;
  /** Padding added to the pocket extent for the suggested box (default 8 Å). */
  boxPadding?: number;
  minBox?: number;
  maxBox?: number;
  maxDisplayPoints?: number;
}

/** Scan directions: the 3 axes and the 4 body diagonals of the cube. */
const DIRS: [number, number, number][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [-1, 1, 1],
];

function isPocketAtom(a: StructAtom, includeHetero: boolean, chains: Set<string> | null): boolean {
  if (a.el === 'H' || WATER_NAMES.has(a.resName)) return false;
  if (chains && !chains.has(a.chain)) return false;
  // Modified amino acids (MSE…) are HETATM but part of the polymer.
  if (a.hetero && !includeHetero && !AMINO_ACIDS.has(a.resName)) return false;
  return Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.z);
}

/** Detect and rank candidate binding pockets. Returns [] for an empty structure. */
export function detectPockets(s: Structure, opts: PocketOptions = {}): Pocket[] {
  const h = opts.spacing ?? 1.0;
  const probe = opts.probe ?? 1.2;
  const minPSP = opts.minPSP ?? 5;
  const maxGap = opts.maxGap ?? 16;
  const minPoints = Math.max(1, Math.ceil((opts.minVolume ?? 30) / (h * h * h)));
  const maxPockets = opts.maxPockets ?? 10;
  const resCut = opts.residueCutoff ?? 4;
  const pad = opts.boxPadding ?? 8;
  const minBox = opts.minBox ?? 14;
  const maxBox = opts.maxBox ?? 30;
  const maxShow = opts.maxDisplayPoints ?? 300;
  const chainSet = opts.chains?.length ? new Set(opts.chains) : null;

  // ---- protein atoms as flat arrays -------------------------------------
  const atomIdx: number[] = [];
  s.atoms.forEach((a, i) => {
    if (isPocketAtom(a, !!opts.includeHetero, chainSet)) atomIdx.push(i);
  });
  const nAtoms = atomIdx.length;
  if (!nAtoms) return [];
  const ax = new Float64Array(nAtoms);
  const ay = new Float64Array(nAtoms);
  const az = new Float64Array(nAtoms);
  const ar = new Float64Array(nAtoms);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  let maxR = 0;
  for (let n = 0; n < nAtoms; n++) {
    const a = s.atoms[atomIdx[n]];
    ax[n] = a.x;
    ay[n] = a.y;
    az[n] = a.z;
    ar[n] = element(a.el).vdw + probe;
    if (ar[n] > maxR) maxR = ar[n];
    if (a.x < minX) minX = a.x;
    if (a.y < minY) minY = a.y;
    if (a.z < minZ) minZ = a.z;
    if (a.x > maxX) maxX = a.x;
    if (a.y > maxY) maxY = a.y;
    if (a.z > maxZ) maxZ = a.z;
  }

  // ---- grid ---------------------------------------------------------------
  // The margin exceeds the largest marking radius, so the outer faces are pure
  // solvent: no PSP event can ever touch a boundary point.
  const margin = maxR + 2 * h;
  const ox = minX - margin;
  const oy = minY - margin;
  const oz = minZ - margin;
  const nx = Math.ceil((maxX - minX + 2 * margin) / h) + 1;
  const ny = Math.ceil((maxY - minY + 2 * margin) / h) + 1;
  const nz = Math.ceil((maxZ - minZ + 2 * margin) / h) + 1;
  const nxy = nx * ny;
  const total = nxy * nz;

  // 1 = protein. Marked by visiting the cube around each atom.
  const occ = new Uint8Array(total);
  for (let n = 0; n < nAtoms; n++) {
    const r = ar[n];
    const r2 = r * r;
    const x = ax[n], y = ay[n], z = az[n];
    const i0 = Math.max(0, Math.ceil((x - r - ox) / h));
    const i1 = Math.min(nx - 1, Math.floor((x + r - ox) / h));
    const j0 = Math.max(0, Math.ceil((y - r - oy) / h));
    const j1 = Math.min(ny - 1, Math.floor((y + r - oy) / h));
    const k0 = Math.max(0, Math.ceil((z - r - oz) / h));
    const k1 = Math.min(nz - 1, Math.floor((z + r - oz) / h));
    for (let k = k0; k <= k1; k++) {
      const dz = oz + k * h - z;
      const dz2 = dz * dz;
      if (dz2 > r2) continue;
      for (let j = j0; j <= j1; j++) {
        const dy = oy + j * h - y;
        const dyz2 = dy * dy + dz2;
        if (dyz2 > r2) continue;
        const row = k * nxy + j * nx;
        for (let i = i0; i <= i1; i++) {
          const dx = ox + i * h - x;
          if (dx * dx + dyz2 <= r2) occ[row + i] = 1;
        }
      }
    }
  }

  // ---- PSP scan -------------------------------------------------------------
  // Walk every grid line in each direction; the solvent run between two
  // protein points (if not longer than maxGap) gets +1 buriedness.
  const psp = new Uint8Array(total);
  const buf = new Int32Array(Math.max(nx, ny, nz) + 1);
  for (const [dx, dy, dz] of DIRS) {
    const stepLen = h * Math.sqrt(dx * dx + dy * dy + dz * dz);
    const gapPts = Math.max(1, Math.floor(maxGap / stepLen));
    const delta = dx + dy * nx + dz * nxy;
    for (let k = 0; k < nz; k++) {
      const pk = k - dz;
      const kOut = pk < 0 || pk >= nz;
      for (let j = 0; j < ny; j++) {
        const pj = j - dy;
        const jOut = pj < 0 || pj >= ny;
        for (let i = 0; i < nx; i++) {
          const pi = i - dx;
          // Only start at points whose predecessor along the direction is off-grid.
          if (!(kOut || jOut || pi < 0 || pi >= nx)) continue;
          let ci = i, cj = j, ck = k;
          let idx = ck * nxy + cj * nx + ci;
          let seenProtein = false;
          let len = 0;
          let overflow = false;
          while (ci >= 0 && ci < nx && cj >= 0 && cj < ny && ck >= 0 && ck < nz) {
            if (occ[idx]) {
              if (seenProtein && !overflow) for (let b = 0; b < len; b++) psp[buf[b]]++;
              seenProtein = true;
              len = 0;
              overflow = false;
            } else if (seenProtein) {
              if (len < gapPts) buf[len++] = idx;
              else overflow = true;
            }
            ci += dx;
            cj += dy;
            ck += dz;
            idx += delta;
          }
        }
      }
    }
  }

  // ---- cluster buried solvent points (26-connectivity) ----------------------
  const label = new Int32Array(total).fill(-1);
  const queue = new Int32Array(total > 0 ? total : 1);
  interface Cluster {
    start: number;
    count: number;
    pspSum: number;
    sx: number;
    sy: number;
    sz: number;
    min: Vec3;
    max: Vec3;
  }
  const clusters: Cluster[] = [];
  // `order` holds the point indices grouped by cluster (each BFS appends a run).
  const order = queue;
  let orderLen = 0;
  for (let p = 0; p < total; p++) {
    if (occ[p] || psp[p] < minPSP || label[p] !== -1) continue;
    const id = clusters.length;
    const c: Cluster = {
      start: orderLen,
      count: 0,
      pspSum: 0,
      sx: 0,
      sy: 0,
      sz: 0,
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
    label[p] = id;
    order[orderLen++] = p;
    let head = c.start;
    while (head < orderLen) {
      const q = order[head++];
      const k = (q / nxy) | 0;
      const rem = q - k * nxy;
      const j = (rem / nx) | 0;
      const i = rem - j * nx;
      const x = ox + i * h, y = oy + j * h, z = oz + k * h;
      c.count++;
      c.pspSum += psp[q];
      c.sx += x;
      c.sy += y;
      c.sz += z;
      if (x < c.min[0]) c.min[0] = x;
      if (y < c.min[1]) c.min[1] = y;
      if (z < c.min[2]) c.min[2] = z;
      if (x > c.max[0]) c.max[0] = x;
      if (y > c.max[1]) c.max[1] = y;
      if (z > c.max[2]) c.max[2] = z;
      for (let dk = -1; dk <= 1; dk++) {
        const kk = k + dk;
        if (kk < 0 || kk >= nz) continue;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = j + dj;
          if (jj < 0 || jj >= ny) continue;
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            if (ii < 0 || ii >= nx) continue;
            const nb = kk * nxy + jj * nx + ii;
            if (label[nb] !== -1 || occ[nb] || psp[nb] < minPSP) continue;
            label[nb] = id;
            order[orderLen++] = nb;
          }
        }
      }
    }
    clusters.push(c);
  }

  // ---- rank ---------------------------------------------------------------
  // Score = Σ (PSP/7)²: size matters, but deep points count more than the
  // shallow rim, which keeps broad surface grooves below real pockets.
  const scored = clusters
    .map((c, cid) => {
      let score = 0;
      for (let t = c.start; t < c.start + c.count; t++) {
        const b = psp[order[t]] / 7;
        score += b * b;
      }
      return { c, cid, score };
    })
    .filter((e) => e.c.count >= minPoints)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPockets);
  if (!scored.length) return [];

  // ---- lining residues ------------------------------------------------------
  // Relabel kept clusters by rank, then visit each atom's neighbourhood once.
  const rankOf = new Int32Array(clusters.length).fill(-1);
  scored.forEach((e, r) => (rankOf[e.cid] = r));
  const lining: Set<string>[] = scored.map(() => new Set<string>());
  const hit = new Uint8Array(scored.length);
  const rc2 = resCut * resCut;
  const span = Math.ceil(resCut / h);
  for (let n = 0; n < nAtoms; n++) {
    const x = ax[n], y = ay[n], z = az[n];
    const ci = Math.round((x - ox) / h);
    const cj = Math.round((y - oy) / h);
    const ck = Math.round((z - oz) / h);
    hit.fill(0);
    let any = false;
    for (let k = Math.max(0, ck - span); k <= Math.min(nz - 1, ck + span); k++) {
      const dz = oz + k * h - z;
      for (let j = Math.max(0, cj - span); j <= Math.min(ny - 1, cj + span); j++) {
        const dy = oy + j * h - y;
        const dyz2 = dy * dy + dz * dz;
        if (dyz2 > rc2) continue;
        const row = k * nxy + j * nx;
        for (let i = Math.max(0, ci - span); i <= Math.min(nx - 1, ci + span); i++) {
          const l = label[row + i];
          if (l < 0) continue;
          const r = rankOf[l];
          if (r < 0 || hit[r]) continue;
          const dx = ox + i * h - x;
          if (dx * dx + dyz2 <= rc2) {
            hit[r] = 1;
            any = true;
          }
        }
      }
    }
    if (!any) continue;
    const key = residueKey(s.atoms[atomIdx[n]]);
    for (let r = 0; r < scored.length; r++) if (hit[r]) lining[r].add(key);
  }

  return scored.map(({ c, score }, r) => {
    const center: Vec3 = [c.sx / c.count, c.sy / c.count, c.sz / c.count];
    const boxSize = [0, 1, 2].map((k) => {
      const edge = c.max[k] - c.min[k] + h + pad;
      return Math.round(Math.min(maxBox, Math.max(minBox, edge)) * 10) / 10;
    }) as Vec3;
    const stride = Math.max(1, Math.ceil(c.count / maxShow));
    const points: Vec3[] = [];
    for (let t = 0; t < c.count && points.length < maxShow; t += stride) {
      const q = order[c.start + t];
      const k = (q / nxy) | 0;
      const rem = q - k * nxy;
      const j = (rem / nx) | 0;
      const i = rem - j * nx;
      points.push([ox + i * h, oy + j * h, oz + k * h]);
    }
    return {
      id: r + 1,
      rank: r + 1,
      center,
      boxSize,
      volume: c.count * h * h * h,
      buriedness: c.pspSum / c.count / 7,
      score: Math.round(score * 100) / 100,
      residues: [...lining[r]],
      points,
    };
  });
}
