'use client';

import { useMemo } from 'react';
import { ramaOutlines, type RamaPoint } from '@/lib/bio/ramachandran';

const SIZE = 340;
const M = { l: 38, r: 10, t: 10, b: 34 };

const REGION_COLOR = { favoured: 'var(--accent)', allowed: 'var(--warning)', outlier: 'var(--danger)' } as const;

export default function Ramachandran({
  points,
  highlight,
  onPick,
}: {
  points: RamaPoint[];
  highlight?: string | null;
  onPick?: (p: RamaPoint) => void;
}) {
  const sx = (phi: number) => M.l + ((phi + 180) / 360) * (SIZE - M.l - M.r);
  const sy = (psi: number) => M.t + ((180 - psi) / 360) * (SIZE - M.t - M.b);

  // Background regions come from the general-case table; glycine and proline
  // have different shapes, so those residues are drawn as differently shaped markers.
  const outlines = useMemo(() => ramaOutlines('general'), []);
  const path = (polys: [number, number][][]) =>
    polys.map((poly) => `M${poly.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('L')}Z`).join('');

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[420px]" role="img" aria-label="Ramachandran plot">
      <rect x={M.l} y={M.t} width={SIZE - M.l - M.r} height={SIZE - M.t - M.b} fill="var(--surface)" stroke="var(--border-strong)" />
      <path d={path(outlines.allowed)} fill="var(--warning)" fillOpacity="0.14" fillRule="evenodd" />
      <path d={path(outlines.favoured)} fill="var(--accent)" fillOpacity="0.2" fillRule="evenodd" />
      {[-180, -90, 0, 90, 180].map((v) => (
        <g key={v}>
          <line x1={sx(v)} x2={sx(v)} y1={M.t} y2={SIZE - M.b} stroke="var(--border)" strokeDasharray={v === 0 ? '0' : '2 3'} />
          <line x1={M.l} x2={SIZE - M.r} y1={sy(v)} y2={sy(v)} stroke="var(--border)" strokeDasharray={v === 0 ? '0' : '2 3'} />
          <text x={sx(v)} y={SIZE - M.b + 13} textAnchor="middle" fontSize="9.5" fill="var(--fg-subtle)">{v}</text>
          <text x={M.l - 5} y={sy(v)} textAnchor="end" dominantBaseline="middle" fontSize="9.5" fill="var(--fg-subtle)">{v}</text>
        </g>
      ))}
      {points.map((p) => {
        const x = sx(p.phi);
        const y = sy(p.psi);
        const color = REGION_COLOR[p.region];
        const active = highlight === p.key;
        const r = active ? 5 : p.region === 'outlier' ? 3.6 : 2.4;
        const common = { fill: color, fillOpacity: p.region === 'favoured' ? 0.65 : 0.9, stroke: active ? 'var(--fg)' : 'none', strokeWidth: 1.5, onClick: () => onPick?.(p), style: { cursor: onPick ? 'pointer' : 'default' } };
        return p.kind === 'glycine' ? (
          <rect key={p.key} x={x - r} y={y - r} width={r * 2} height={r * 2} {...common}><title>{`${p.resName}${p.resSeq} ${p.chain}  φ ${p.phi.toFixed(0)}° ψ ${p.psi.toFixed(0)}°`}</title></rect>
        ) : p.kind === 'proline' ? (
          <polygon key={p.key} points={`${x},${y - r * 1.2} ${x + r * 1.1},${y + r * 0.9} ${x - r * 1.1},${y + r * 0.9}`} {...common}><title>{`${p.resName}${p.resSeq} ${p.chain}  φ ${p.phi.toFixed(0)}° ψ ${p.psi.toFixed(0)}°`}</title></polygon>
        ) : (
          <circle key={p.key} cx={x} cy={y} r={r} {...common}><title>{`${p.resName}${p.resSeq} ${p.chain}  φ ${p.phi.toFixed(0)}° ψ ${p.psi.toFixed(0)}°`}</title></circle>
        );
      })}
      <text x={(M.l + SIZE - M.r) / 2} y={SIZE - 4} textAnchor="middle" fontSize="11" fill="var(--fg-muted)">φ (°)</text>
      <text transform={`translate(10 ${(M.t + SIZE - M.b) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="var(--fg-muted)">ψ (°)</text>
    </svg>
  );
}
