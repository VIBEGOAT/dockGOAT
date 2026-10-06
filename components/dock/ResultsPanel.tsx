'use client';

import { useState } from 'react';
import { Download, Link2, ScrollText, Sigma, Trophy } from 'lucide-react';
import { Badge, Button, Callout, EmptyState, SectionLabel, Segmented, Stat, cn } from '@/components/ui/primitives';
import type { InteractionReport, InteractionType } from '@/lib/docking/interactions';
import { formatMolar, kdFromDeltaG, ligandEfficiency, type VinaResult } from '@/lib/docking/vina';

const TYPE_LABEL: Record<InteractionType, string> = {
  'hbond': 'Hydrogen bond',
  'hydrophobic': 'Hydrophobic',
  'pi-stacking': 'π-stacking',
  'pi-cation': 'π–cation',
  'salt-bridge': 'Salt bridge',
  'halogen': 'Halogen bond',
  'metal': 'Metal coordination',
};

export const INTERACTION_COLOR: Record<InteractionType, string> = {
  'hbond': '#2563eb',
  'hydrophobic': '#a3a3a3',
  'pi-stacking': '#16a34a',
  'pi-cation': '#9333ea',
  'salt-bridge': '#ea580c',
  'halogen': '#0891b2',
  'metal': '#b45309',
};

export default function ResultsPanel({
  result,
  heavyAtoms,
  selected,
  onSelect,
  interactions,
  redockRmsd,
  onDownload,
}: {
  result: VinaResult | null;
  heavyAtoms: number;
  selected: number;
  onSelect: (i: number) => void;
  interactions: InteractionReport | null;
  redockRmsd: number | null;
  onDownload: (what: 'pdbqt' | 'sdf' | 'csv' | 'log') => void;
}) {
  const [tab, setTab] = useState<'poses' | 'interactions' | 'log'>('poses');

  if (!result) {
    return (
      <EmptyState icon={<Trophy className="h-5 w-5" />} title="No results yet">
        Load a target and a ligand, place the search box, then run docking. Results appear here with pose rankings and
        the interactions each pose makes.
      </EmptyState>
    );
  }

  const best = result.poses[0];
  const pose = result.poses[selected] ?? best;

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 gap-2 border-b border-line p-3 sm:grid-cols-4">
        <Stat label="Best affinity" value={best.affinity.toFixed(2)} unit="kcal/mol" tone={best.affinity < -9 ? 'success' : undefined} />
        <Stat label="Est. Kd" value={formatMolar(kdFromDeltaG(best.affinity))} hint="from ΔG = RT ln Kd" />
        <Stat label="Ligand efficiency" value={ligandEfficiency(best.affinity, heavyAtoms).toFixed(3)} unit="kcal/mol/HA" />
        <Stat
          label={redockRmsd !== null ? 'Redock RMSD' : 'Runtime'}
          value={redockRmsd !== null ? redockRmsd.toFixed(2) : result.seconds.toFixed(0)}
          unit={redockRmsd !== null ? 'Å' : 's'}
          tone={redockRmsd !== null ? (redockRmsd < 2 ? 'success' : 'warning') : undefined}
          hint={redockRmsd !== null ? (redockRmsd < 2 ? 'Reproduces the crystal pose' : 'Above the 2 Å success criterion') : undefined}
        />
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'poses', label: `Poses (${result.poses.length})` },
            { value: 'interactions', label: interactions ? `Interactions (${interactions.interactions.length})` : 'Interactions' },
            { value: 'log', label: 'Log', icon: <ScrollText className="h-3.5 w-3.5" /> },
          ]}
        />
        <div className="flex gap-1">
          <Button size="xs" variant="ghost" onClick={() => onDownload('sdf')} icon={<Download className="h-3.5 w-3.5" />} title="Download poses as SDF">
            SDF
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onDownload('csv')} title="Download the score table">
            CSV
          </Button>
        </div>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {tab === 'poses' && (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wide text-subtle">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mode</th>
                <th className="px-3 py-2 text-right font-medium">Affinity</th>
                <th className="px-3 py-2 text-right font-medium">Est. Kd</th>
                <th className="px-3 py-2 text-right font-medium" title="RMSD from the best mode, lower bound">
                  RMSD l.b.
                </th>
                <th className="px-3 py-2 text-right font-medium" title="RMSD from the best mode, upper bound">
                  RMSD u.b.
                </th>
              </tr>
            </thead>
            <tbody>
              {result.poses.map((p, i) => (
                <tr
                  key={p.mode}
                  onClick={() => onSelect(i)}
                  className={cn(
                    'cursor-pointer border-b border-line transition-colors last:border-0',
                    i === selected ? 'bg-accent-soft' : 'hover:bg-surface-2',
                  )}
                >
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', i === selected ? 'bg-accent' : 'bg-line-strong')} />
                      {p.mode}
                      {i === 0 && <Badge tone="success">best</Badge>}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2 text-right font-medium text-fg">{p.affinity.toFixed(2)}</td>
                  <td className="tabular px-3 py-2 text-right text-subtle">{formatMolar(kdFromDeltaG(p.affinity))}</td>
                  <td className="tabular px-3 py-2 text-right text-subtle">{p.rmsdLB.toFixed(2)}</td>
                  <td className="tabular px-3 py-2 text-right text-subtle">{p.rmsdUB.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'interactions' && (
          <div className="p-3">
            {!interactions ? (
              <p className="text-[13px] text-subtle">Select a pose to analyse its contacts.</p>
            ) : interactions.interactions.length === 0 ? (
              <Callout tone="warning">
                No specific interactions were detected for mode {pose.mode}. The ligand may be sitting in a shallow or
                solvent-exposed part of the box.
              </Callout>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(interactions.counts) as [InteractionType, number][])
                    .filter(([, n]) => n > 0)
                    .map(([t, n]) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ background: INTERACTION_COLOR[t] }} />
                        {TYPE_LABEL[t]} · {n}
                      </span>
                    ))}
                </div>
                <ul className="space-y-1.5">
                  {interactions.interactions.map((it, i) => (
                    <li key={i} className="flex items-start gap-2.5 rounded-md border border-line bg-surface px-2.5 py-2">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: INTERACTION_COLOR[it.type] }} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-medium text-fg">
                            {it.resName}
                            {it.resSeq}
                            <span className="ml-1 text-[11px] font-normal text-subtle">chain {it.chain}</span>
                          </span>
                          <span className="tabular shrink-0 text-[11px] text-subtle">
                            {it.distance.toFixed(2)} Å{it.angle !== undefined && ` · ${it.angle.toFixed(0)}°`}
                          </span>
                        </span>
                        <span className="block text-[12px] leading-snug text-muted">{it.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'log' && (
          <div className="p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-subtle">
              <Badge>seed {result.seed}</Badge>
              <Badge>exhaustiveness {result.config.exhaustiveness}</Badge>
              <Badge>{result.config.scoring ?? 'vina'}</Badge>
              <Badge>{result.threads} threads</Badge>
              <Badge>{result.seconds.toFixed(1)} s</Badge>
              <Button size="xs" variant="ghost" onClick={() => onDownload('log')} icon={<Download className="h-3 w-3" />}>
                Save
              </Button>
            </div>
            <pre className="scroll-thin max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-muted">
              {result.log.trim()}
            </pre>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-subtle">
        <span className="inline-flex items-center gap-1.5">
          <Sigma className="h-3.5 w-3.5" />
          Mode {pose.mode} of {result.poses.length}
        </span>
        <button
          type="button"
          onClick={() => onDownload('pdbqt')}
          className="inline-flex items-center gap-1 font-medium text-muted transition-colors hover:text-fg"
        >
          <Link2 className="h-3.5 w-3.5" />
          Download raw PDBQT
        </button>
      </div>
    </div>
  );
}
