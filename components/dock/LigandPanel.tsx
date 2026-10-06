'use client';

import { useEffect, useRef, useState } from 'react';
import { FileUp, FlaskConical, Pill, Search, Shapes } from 'lucide-react';
import { Badge, Button, Callout, Input, Segmented, SectionLabel, Spinner } from '@/components/ui/primitives';
import MoleculeDepiction from '@/components/viewer/MoleculeDepiction';
import type { LoadedLigand, LoadedTarget } from '@/lib/workbench/inputs';
import type { HetGroup } from '@/lib/chem/pdb';
import { autocomplete } from '@/lib/services/pubchem';

export type LigandMode = 'smiles' | 'name' | 'file' | 'bound';

const EXAMPLES: { name: string; smiles: string }[] = [
  { name: 'Imatinib', smiles: 'Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1' },
  { name: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  { name: 'Caffeine', smiles: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C' },
  { name: 'Benzamidine', smiles: 'NC(=N)c1ccccc1' },
];

export default function LigandPanel({
  ligand,
  loading,
  error,
  target,
  torsions,
  onLoad,
}: {
  ligand: LoadedLigand | null;
  loading: boolean;
  error: string | null;
  target: LoadedTarget | null;
  torsions: number | null;
  onLoad: (
    mode: LigandMode,
    value: string,
    extra?: { file?: { name: string; text: string }; group?: HetGroup },
  ) => void;
}) {
  const [mode, setMode] = useState<LigandMode>('smiles');
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // PubChem name suggestions, debounced.
  useEffect(() => {
    if (mode !== 'name' || value.trim().length < 2) return;
    let alive = true;
    const t = setTimeout(() => {
      autocomplete(value, 6)
        .then((s) => alive && setSuggestions(s))
        .catch(() => undefined);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [mode, value]);

  const visibleSuggestions = mode === 'name' && value.trim().length >= 2 ? suggestions : [];

  const submit = (v = value) => {
    if (mode === 'file') fileRef.current?.click();
    else if (v.trim()) onLoad(mode, v.trim());
  };

  const boundLigands = target?.hetero.filter((h) => !h.isMetal && h.atomCount >= 6) ?? [];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Pill className="h-4 w-4 text-accent" />
        <SectionLabel>Step 2 · Ligand</SectionLabel>
      </div>

      <Segmented
        fullWidth
        size="sm"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setValue('');
        }}
        options={[
          { value: 'smiles', label: 'SMILES', icon: <Shapes className="h-3.5 w-3.5" /> },
          { value: 'name', label: 'Name', icon: <Search className="h-3.5 w-3.5" /> },
          { value: 'file', label: 'File', icon: <FileUp className="h-3.5 w-3.5" /> },
          { value: 'bound', label: 'Bound', icon: <FlaskConical className="h-3.5 w-3.5" />, disabled: !boundLigands.length },
        ]}
      />

      {mode === 'file' && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".sdf,.mol,.sd,.mol2,.smi,.smiles,.txt"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              onLoad('file', f.name, { file: { name: f.name, text: await f.text() } });
              e.target.value = '';
            }}
          />
          <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()} icon={<FileUp className="h-4 w-4" />}>
            Choose an SDF, MOL2 or SMILES file
          </Button>
          <p className="text-xs text-subtle">
            SDF and MOL2 carry bond orders. A 3D conformer is generated when the file has none.
          </p>
        </>
      )}

      {mode === 'bound' && (
        <div className="space-y-1.5">
          {boundLigands.map((h) => (
            <button
              key={h.key}
              type="button"
              onClick={() => onLoad('bound', h.key, { group: h })}
              className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-accent-line"
            >
              <span>
                <span className="text-[13px] font-medium text-fg">{h.resName}</span>
                <span className="ml-2 text-[11px] text-subtle">
                  chain {h.chain} · {h.atomCount} atoms
                </span>
              </span>
              <Badge tone="accent">Use</Badge>
            </button>
          ))}
          <p className="text-[11px] text-subtle">
            Bond orders are fetched from RCSB so the chemistry is exact. Docking a bound ligand back into its own
            structure is the standard way to validate a setup.
          </p>
        </div>
      )}

      {(mode === 'smiles' || mode === 'name') && (
        <div className="relative">
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={mode === 'smiles' ? 'CC(=O)Oc1ccccc1C(=O)O' : 'e.g. imatinib'}
              spellCheck={false}
              className={mode === 'smiles' ? 'font-mono text-[13px]' : undefined}
              aria-label={mode === 'smiles' ? 'SMILES string' : 'Compound name'}
            />
            <Button variant="primary" onClick={() => submit()} loading={loading} disabled={!value.trim()}>
              Build
            </Button>
          </div>
          {visibleSuggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-float">
              {visibleSuggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-[13px] text-muted hover:bg-surface-2 hover:text-fg"
                    onClick={() => {
                      setValue(s);
                      setSuggestions([]);
                      submit(s);
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {mode === 'smiles' && !ligand && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e.name}
              type="button"
              onClick={() => {
                setValue(e.smiles);
                onLoad('smiles', e.smiles);
              }}
              className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent-line hover:text-fg"
            >
              {e.name}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-[13px] text-subtle">
          <Spinner /> Building a 3D conformer…
        </div>
      )}
      {error && <Callout tone="danger">{error}</Callout>}

      {ligand && (
        <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
          <div className="flex gap-3">
            <div className="h-24 w-28 shrink-0 overflow-hidden rounded-md border border-line bg-surface">
              <MoleculeDepiction smiles={ligand.smiles} width={224} height={192} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-fg" title={ligand.name}>
                {ligand.name}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] leading-snug text-subtle">{ligand.smiles}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>{ligand.molecule.atoms.filter((a) => a.el !== 'H').length} heavy atoms</Badge>
                {torsions !== null && <Badge tone={torsions > 12 ? 'warning' : 'neutral'}>{torsions} torsions</Badge>}
                <Badge tone={ligand.geometry === 'generated' ? 'neutral' : 'success'}>
                  {ligand.geometry === 'generated' ? 'Generated 3D' : ligand.geometry === 'experimental' ? 'Crystal pose' : 'From file'}
                </Badge>
              </div>
            </div>
          </div>
          {torsions !== null && torsions > 12 && (
            <Callout tone="warning">
              {torsions} rotatable bonds is a lot of flexibility. Raise exhaustiveness (24+) or the pose may be
              under-sampled.
            </Callout>
          )}
          {ligand.warnings.map((w) => (
            <Callout key={w} tone="warning">
              {w}
            </Callout>
          ))}
        </div>
      )}
    </section>
  );
}
