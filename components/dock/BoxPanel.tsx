'use client';

import { Box, Crosshair, Wand2 } from 'lucide-react';
import { Badge, Button, Callout, NumberInput, SectionLabel, Spinner, cn } from '@/components/ui/primitives';
import type { Vec3 } from '@/lib/chem/geometry';
import type { HetGroup } from '@/lib/chem/pdb';
import type { Pocket } from '@/lib/docking/pocket';
import { BOX_LIMITS, boxVolume, boxWarning, clampEdge, type SearchBox } from '@/lib/workbench/inputs';

export default function BoxPanel({
  box,
  onChange,
  hetero,
  pockets,
  detecting,
  onDetect,
  activePocket,
  onUseHetero,
  onUsePocket,
  torsions,
  disabled,
}: {
  box: SearchBox;
  onChange: (b: SearchBox) => void;
  hetero: HetGroup[];
  pockets: Pocket[];
  detecting: boolean;
  onDetect: () => void;
  activePocket: number | null;
  onUseHetero: (h: HetGroup) => void;
  onUsePocket: (p: Pocket) => void;
  torsions: number;
  disabled?: boolean;
}) {
  const setCenter = (i: number, v: number) => {
    const center = [...box.center] as Vec3;
    center[i] = v;
    onChange({ ...box, center });
  };
  const setSize = (i: number, v: number) => {
    const size = [...box.size] as Vec3;
    size[i] = clampEdge(v);
    onChange({ ...box, size });
  };
  const setAll = (v: number) => onChange({ ...box, size: [clampEdge(v), clampEdge(v), clampEdge(v)] });

  const warning = boxWarning(box, torsions);
  const volume = boxVolume(box);

  return (
    <section className={cn('space-y-3', disabled && 'pointer-events-none opacity-50')}>
      <div className="flex items-center gap-2">
        <Box className="h-4 w-4 text-accent" />
        <SectionLabel>Step 3 · Search space</SectionLabel>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {hetero.slice(0, 4).map((h) => (
          <button
            key={h.key}
            type="button"
            onClick={() => onUseHetero(h)}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent-line hover:text-fg"
            title={`Centre the box on ${h.resName} ${h.chain}${h.resSeq}`}
          >
            <Crosshair className="h-3 w-3" />
            {h.resName} site
          </button>
        ))}
        <Button size="xs" variant="secondary" onClick={onDetect} loading={detecting} icon={<Wand2 className="h-3.5 w-3.5" />}>
          Detect pockets
        </Button>
      </div>

      {detecting && (
        <div className="flex items-center gap-2 text-[13px] text-subtle">
          <Spinner /> Scanning the surface for buried cavities…
        </div>
      )}

      {pockets.length > 0 && (
        <div className="space-y-1">
          <SectionLabel>Detected pockets</SectionLabel>
          <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto pr-1">
            {pockets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onUsePocket(p)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md border px-2.5 py-1.5 text-left transition-colors',
                  activePocket === p.id ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:border-accent-line',
                )}
              >
                <span className="text-[12px] font-medium text-fg">Pocket {p.rank}</span>
                <span className="flex items-center gap-1.5 text-[11px] text-subtle">
                  <span className="tabular">{Math.round(p.volume)} Å³</span>
                  <Badge tone={p.buriedness > 0.72 ? 'success' : 'neutral'}>{Math.round(p.buriedness * 100)}% buried</Badge>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-subtle">Centre (Å)</p>
          <div className="grid grid-cols-3 gap-2">
            {(['X', 'Y', 'Z'] as const).map((axis, i) => (
              <NumberInput key={axis} label={axis} value={box.center[i]} onChange={(v) => setCenter(i, v)} step={0.5} />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-medium text-subtle">Size (Å)</p>
            <div className="flex gap-1">
              {[20, 24, 30].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAll(s)}
                  className="rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-medium text-subtle hover:text-fg"
                >
                  {s}³
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['X', 'Y', 'Z'] as const).map((axis, i) => (
              <NumberInput
                key={axis}
                label={axis}
                value={box.size[i]}
                onChange={(v) => setSize(i, v)}
                step={1}
                min={BOX_LIMITS.min}
                max={BOX_LIMITS.max}
              />
            ))}
          </div>
        </div>
        <p className="tabular text-[11px] text-subtle">Volume {Math.round(volume).toLocaleString()} Å³</p>
      </div>

      {warning && <Callout tone="warning">{warning}</Callout>}
    </section>
  );
}
