'use client';

import { Cpu, Play, Settings2, Square } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Callout, NumberInput, ProgressBar, SectionLabel, Segmented, cn } from '@/components/ui/primitives';
import type { ScoringFunction, VinaPhase } from '@/lib/docking/vina';

export interface RunSettings {
  exhaustiveness: number;
  numModes: number;
  energyRange: number;
  seed: number | null;
  cpu: number;
  scoring: ScoringFunction;
}

export const DEFAULT_RUN: RunSettings = {
  exhaustiveness: 8,
  numModes: 9,
  energyRange: 3,
  seed: null,
  cpu: 4,
  scoring: 'vina',
};

const PHASE_TEXT: Record<VinaPhase, string> = {
  loading: 'Loading the docking engine',
  setup: 'Reading input structures',
  grid: 'Computing grid maps',
  search: 'Searching conformational space',
  refine: 'Refining and ranking poses',
  done: 'Finished',
};

export default function RunPanel({
  settings,
  onChange,
  onRun,
  onCancel,
  running,
  progress,
  phase,
  blocked,
  maxThreads,
  elapsed,
}: {
  settings: RunSettings;
  onChange: (s: RunSettings) => void;
  onRun: () => void;
  onCancel: () => void;
  running: boolean;
  progress: number;
  phase: VinaPhase;
  blocked: string | null;
  maxThreads: number;
  elapsed: number;
}) {
  const [advanced, setAdvanced] = useState(false);
  const set = <K extends keyof RunSettings>(k: K, v: RunSettings[K]) => onChange({ ...settings, [k]: v });

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-accent" />
        <SectionLabel>Step 4 · Run</SectionLabel>
      </div>

      <div className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="exh" className="text-[11px] font-medium text-subtle">
              Exhaustiveness
            </label>
            <span className="tabular text-[11px] font-medium text-fg">{settings.exhaustiveness}</span>
          </div>
          <input
            id="exh"
            type="range"
            min={1}
            max={64}
            step={1}
            value={settings.exhaustiveness}
            onChange={(e) => set('exhaustiveness', Number(e.target.value))}
            className="w-full"
            disabled={running}
          />
          <p className="mt-1 text-[11px] leading-snug text-subtle">
            More independent searches: better sampling, proportionally longer runtime. 8 is Vina&apos;s default; 16–32
            suits flexible ligands.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex items-center gap-1.5 text-[11px] font-medium text-subtle transition-colors hover:text-fg"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {advanced ? 'Hide' : 'Show'} advanced settings
        </button>

        {advanced && (
          <div className="space-y-2.5 border-t border-line pt-2.5">
            <div>
              <p className="mb-1.5 text-[11px] font-medium text-subtle">Scoring function</p>
              <Segmented
                fullWidth
                size="sm"
                value={settings.scoring}
                onChange={(v) => set('scoring', v)}
                options={[
                  { value: 'vina', label: 'Vina' },
                  { value: 'vinardo', label: 'Vinardo' },
                ]}
              />
              <p className="mt-1 text-[11px] text-subtle">
                Vinardo is a re-parameterised scoring function that can rank poses better on some targets.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-[11px] font-medium text-subtle">Binding modes</p>
                <NumberInput value={settings.numModes} onChange={(v) => set('numModes', Math.round(v))} min={1} max={20} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-subtle">Energy range</p>
                <NumberInput value={settings.energyRange} onChange={(v) => set('energyRange', v)} step={0.5} min={1} max={10} unit="kcal" />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-subtle">Threads</p>
                <NumberInput value={settings.cpu} onChange={(v) => set('cpu', Math.round(v))} min={1} max={maxThreads} />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-subtle">Seed</p>
                <NumberInput
                  value={settings.seed ?? 0}
                  onChange={(v) => set('seed', Math.round(v))}
                  step={1}
                />
              </div>
            </div>
            <p className="text-[11px] text-subtle">
              A fixed seed makes a run reproducible. Leave it at 0 to draw a fresh one each time; the value used is
              always recorded with the results.
            </p>
          </div>
        )}
      </div>

      {blocked ? (
        <Callout tone="danger" title="Docking is unavailable">
          {blocked}
        </Callout>
      ) : running ? (
        <div className="space-y-2">
          <ProgressBar value={progress} indeterminate={phase === 'loading'} />
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted">{PHASE_TEXT[phase]}…</span>
            <span className="tabular text-subtle">
              {Math.round(progress * 100)}% · {elapsed.toFixed(0)}s
            </span>
          </div>
          <Button variant="secondary" className="w-full" onClick={onCancel} icon={<Square className="h-4 w-4" />}>
            Stop
          </Button>
        </div>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={onRun} icon={<Play className="h-4 w-4" />}>
          Run docking
        </Button>
      )}

      {!running && !blocked && (
        <p className="text-center text-[11px] text-subtle">
          Runs on {settings.cpu} of your {maxThreads} available threads · typically 20 s – 3 min
        </p>
      )}
    </section>
  );
}
