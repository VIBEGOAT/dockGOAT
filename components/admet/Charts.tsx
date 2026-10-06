'use client';

import type { AdmetProfile, Ellipse, RadarAxisValue } from '@/lib/admet/types';
import { BOILED_EGG } from '@/lib/admet/boiled-egg';

/* ─── Bioavailability radar ───────────────────────────────────────────────── */

export function RadarChart({ axes, size = 260 }: { axes: RadarAxisValue[]; size?: number }) {
  const c = size / 2;
  const r = size / 2 - 38;
  const n = axes.length;
  // Axis 0 points straight up, then clockwise.
  const pt = (i: number, f: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r * f, c + Math.sin(a) * r * f];
  };
  const poly = (fs: number[]) => fs.map((f, i) => pt(i, f).join(',')).join(' ');
  const lo = axes.map((a) => a.optimalPosition[0]);
  const hi = axes.map((a) => a.optimalPosition[1]);
  const allIn = axes.every((a) => a.inRange);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]" role="img" aria-label="Bioavailability radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={poly(axes.map(() => f))} fill="none" stroke="var(--border)" strokeWidth="1" />
      ))}
      {axes.map((_, i) => (
        <line key={i} x1={c} y1={c} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="var(--border)" strokeWidth="1" />
      ))}
      {/* Optimal window: the area between the inner and outer limits. */}
      <path
        d={`M${poly(hi)} Z M${poly(lo)} Z`}
        fill="var(--success)"
        fillOpacity="0.14"
        stroke="var(--success)"
        strokeOpacity="0.5"
        strokeWidth="1"
        fillRule="evenodd"
      />
      <polygon
        points={poly(axes.map((a) => a.position))}
        fill="var(--accent)"
        fillOpacity="0.22"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {axes.map((a, i) => {
        const [x, y] = pt(i, a.position);
        return <circle key={a.key} cx={x} cy={y} r="3.5" fill={a.inRange ? 'var(--accent)' : 'var(--danger)'} stroke="var(--surface)" strokeWidth="1.5" />;
      })}
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.2);
        return (
          <text key={a.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fontWeight="600" fill={a.inRange ? 'var(--fg-muted)' : 'var(--danger)'}>
            {a.key}
          </text>
        );
      })}
      <title>{allIn ? 'All six properties are inside the optimal range' : 'Some properties are outside the optimal range'}</title>
    </svg>
  );
}

/* ─── BOILED-Egg ──────────────────────────────────────────────────────────── */

const X_RANGE: [number, number] = [-10, 180];
const Y_RANGE: [number, number] = [-3, 8];

function EllipsePath({ e, sx, sy, fill, stroke }: { e: Ellipse; sx: (v: number) => number; sy: (v: number) => number; fill: string; stroke: string }) {
  // Sample the rotated ellipse so axis scaling cannot distort it.
  const pts: string[] = [];
  const cos = Math.cos(e.rotation);
  const sin = Math.sin(e.rotation);
  for (let k = 0; k <= 96; k++) {
    const t = (k / 96) * 2 * Math.PI;
    const ex = e.rx * Math.cos(t);
    const ey = e.ry * Math.sin(t);
    pts.push(`${sx(e.cx + ex * cos - ey * sin)},${sy(e.cy + ex * sin + ey * cos)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth="1.5" />;
}

export function BoiledEggChart({ profiles, highlight = 0 }: { profiles: AdmetProfile[]; highlight?: number }) {
  const W = 420;
  const H = 300;
  const m = { l: 44, r: 14, t: 12, b: 38 };
  const sx = (v: number) => m.l + ((v - X_RANGE[0]) / (X_RANGE[1] - X_RANGE[0])) * (W - m.l - m.r);
  const sy = (v: number) => H - m.b - ((v - Y_RANGE[0]) / (Y_RANGE[1] - Y_RANGE[0])) * (H - m.t - m.b);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="BOILED-Egg plot of WLOGP against TPSA">
      {[0, 40, 80, 120, 160].map((v) => (
        <g key={`x${v}`}>
          <line x1={sx(v)} x2={sx(v)} y1={m.t} y2={H - m.b} stroke="var(--border)" />
          <text x={sx(v)} y={H - m.b + 14} textAnchor="middle" fontSize="10" fill="var(--fg-subtle)">
            {v}
          </text>
        </g>
      ))}
      {[-2, 0, 2, 4, 6].map((v) => (
        <g key={`y${v}`}>
          <line x1={m.l} x2={W - m.r} y1={sy(v)} y2={sy(v)} stroke="var(--border)" />
          <text x={m.l - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--fg-subtle)">
            {v}
          </text>
        </g>
      ))}
      <EllipsePath e={BOILED_EGG.hia} sx={sx} sy={sy} fill="var(--surface-3)" stroke="var(--border-strong)" />
      <EllipsePath e={BOILED_EGG.bbb} sx={sx} sy={sy} fill="#f5b942" stroke="#d99a1f" />
      {profiles.map((p, i) => {
        const { tpsa, wlogp } = p.pharmacokinetics.point;
        const active = i === highlight;
        return (
          <circle
            key={i}
            cx={sx(Math.min(X_RANGE[1], Math.max(X_RANGE[0], tpsa)))}
            cy={sy(Math.min(Y_RANGE[1], Math.max(Y_RANGE[0], wlogp)))}
            r={active ? 6 : 4}
            fill="var(--accent)"
            fillOpacity={active ? 1 : 0.55}
            stroke="var(--surface)"
            strokeWidth="1.5"
          >
            <title>{`${p.identity.name}: TPSA ${tpsa.toFixed(1)}, WLOGP ${wlogp.toFixed(2)}`}</title>
          </circle>
        );
      })}
      <text x={(m.l + W - m.r) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--fg-muted)">
        TPSA (Å²)
      </text>
      <text transform={`translate(11 ${(m.t + H - m.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="var(--fg-muted)">
        WLOGP
      </text>
    </svg>
  );
}
