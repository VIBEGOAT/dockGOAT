/** Small, allocation-light 3D vector helpers. */

export type Vec3 = [number, number, number];

export const vec = (x: number, y: number, z: number): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dist2 = (a: Vec3, b: Vec3): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
};

export function normalize(a: Vec3): Vec3 {
  const n = norm(a);
  return n > 1e-12 ? [a[0] / n, a[1] / n, a[2] / n] : [0, 0, 0];
}

/** Angle ABC in degrees. */
export function angle(a: Vec3, b: Vec3, c: Vec3): number {
  const u = normalize(sub(a, b));
  const v = normalize(sub(c, b));
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) * 180) / Math.PI;
}

/** Dihedral ABCD in degrees, range (-180, 180]. */
export function dihedral(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const b0 = sub(a, b);
  const b1 = normalize(sub(c, b));
  const b2 = sub(d, c);
  const v = sub(b0, scale(b1, dot(b0, b1)));
  const w = sub(b2, scale(b1, dot(b2, b1)));
  const x = dot(v, w);
  const y = dot(cross(b1, v), w);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function centroid(points: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  if (!points.length) return c;
  for (const p of points) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  return scale(c, 1 / points.length);
}

/** Unit normal of the best-fit plane through ≥3 points (Newell's method). */
export function planeNormal(points: Vec3[]): Vec3 {
  const n: Vec3 = [0, 0, 0];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    n[0] += (p[1] - q[1]) * (p[2] + q[2]);
    n[1] += (p[2] - q[2]) * (p[0] + q[0]);
    n[2] += (p[0] - q[0]) * (p[1] + q[1]);
  }
  return normalize(n);
}

/** Axis-aligned bounding box. */
export function bounds(points: Vec3[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  return { min, max };
}

/** Rotate point p about the axis through `origin` with direction `axis` by `theta` radians. */
export function rotateAbout(p: Vec3, origin: Vec3, axis: Vec3, theta: number): Vec3 {
  const k = normalize(axis);
  const v = sub(p, origin);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return [
    origin[0] + v[0] * c + kv[0] * s + k[0] * kd,
    origin[1] + v[1] * c + kv[1] * s + k[1] * kd,
    origin[2] + v[2] * c + kv[2] * s + k[2] * kd,
  ];
}

/** Heavy-atom RMSD between two equally-ordered coordinate lists (no superposition). */
export function rmsd(a: Vec3[], b: Vec3[]): number {
  if (a.length !== b.length || !a.length) return NaN;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += dist2(a[i], b[i]);
  return Math.sqrt(s / a.length);
}

/**
 * Uniform spatial hash for neighbour queries. Bucket edge = `cell` Å.
 * Stores indices into the caller's point array.
 */
export class SpatialHash {
  private cells = new Map<string, number[]>();

  constructor(
    private points: Vec3[],
    private cell: number,
  ) {
    points.forEach((p, i) => {
      const key = this.key(p);
      const bucket = this.cells.get(key);
      if (bucket) bucket.push(i);
      else this.cells.set(key, [i]);
    });
  }

  private key(p: Vec3): string {
    return `${Math.floor(p[0] / this.cell)},${Math.floor(p[1] / this.cell)},${Math.floor(p[2] / this.cell)}`;
  }

  /** Indices of points within `radius` of `p`. */
  near(p: Vec3, radius: number): number[] {
    const out: number[] = [];
    const r2 = radius * radius;
    const span = Math.ceil(radius / this.cell);
    const cx = Math.floor(p[0] / this.cell);
    const cy = Math.floor(p[1] / this.cell);
    const cz = Math.floor(p[2] / this.cell);
    for (let i = cx - span; i <= cx + span; i++)
      for (let j = cy - span; j <= cy + span; j++)
        for (let k = cz - span; k <= cz + span; k++) {
          const bucket = this.cells.get(`${i},${j},${k}`);
          if (!bucket) continue;
          for (const idx of bucket) if (dist2(this.points[idx], p) <= r2) out.push(idx);
        }
    return out;
  }
}
