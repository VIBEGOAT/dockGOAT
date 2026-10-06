'use client';

import { useRef, useState } from 'react';
import { Database, FileUp, Sparkles, Target as TargetIcon } from 'lucide-react';
import { Badge, Button, Callout, Checkbox, Input, Segmented, SectionLabel, Spinner, cn } from '@/components/ui/primitives';
import type { LoadedTarget } from '@/lib/workbench/inputs';
import { entryUrl } from '@/lib/services/rcsb';

export type TargetMode = 'pdb' | 'alphafold' | 'file';

export interface TargetSelection {
  chains: string[];
  keepHetero: string[];
}

const EXAMPLES = [
  { id: '1IEP', label: 'Abl kinase + imatinib' },
  { id: '3PTB', label: 'Trypsin + benzamidine' },
  { id: '1HSG', label: 'HIV-1 protease + indinavir' },
  { id: '6LU7', label: 'SARS-CoV-2 main protease' },
];

export default function TargetPanel({
  target,
  loading,
  error,
  selection,
  onLoad,
  onSelectionChange,
}: {
  target: LoadedTarget | null;
  loading: boolean;
  error: string | null;
  selection: TargetSelection;
  onLoad: (mode: TargetMode, value: string, file?: { name: string; text: string }) => void;
  onSelectionChange: (s: TargetSelection) => void;
}) {
  const [mode, setMode] = useState<TargetMode>('pdb');
  const [value, setValue] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (mode === 'file') fileRef.current?.click();
    else if (value.trim()) onLoad(mode, value.trim());
  };

  const toggleChain = (id: string) => {
    const next = selection.chains.includes(id) ? selection.chains.filter((c) => c !== id) : [...selection.chains, id];
    if (next.length) onSelectionChange({ ...selection, chains: next });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <TargetIcon className="h-4 w-4 text-accent" />
        <SectionLabel>Step 1 · Target</SectionLabel>
      </div>

      <Segmented
        fullWidth
        size="sm"
        value={mode}
        onChange={(m) => setMode(m)}
        options={[
          { value: 'pdb', label: 'PDB', icon: <Database className="h-3.5 w-3.5" /> },
          { value: 'alphafold', label: 'AlphaFold', icon: <Sparkles className="h-3.5 w-3.5" /> },
          { value: 'file', label: 'File', icon: <FileUp className="h-3.5 w-3.5" /> },
        ]}
      />

      {mode === 'file' ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".pdb,.ent,.cif,.mmcif,.pdbqt"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              onLoad('file', f.name, { name: f.name, text: await f.text() });
              e.target.value = '';
            }}
          />
          <Button variant="secondary" className="w-full" onClick={submit} icon={<FileUp className="h-4 w-4" />}>
            Choose a PDB or mmCIF file
          </Button>
          <p className="text-xs text-subtle">Your file is read in the browser and never uploaded.</p>
        </>
      ) : (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={mode === 'pdb' ? 'PDB ID, e.g. 1IEP' : 'UniProt accession, e.g. P00533'}
            spellCheck={false}
            aria-label={mode === 'pdb' ? 'PDB ID' : 'UniProt accession'}
          />
          <Button variant="primary" onClick={submit} loading={loading} disabled={!value.trim()}>
            Load
          </Button>
        </div>
      )}

      {mode === 'pdb' && !target && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setValue(e.id);
                onLoad('pdb', e.id);
              }}
              className="rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] font-medium text-muted transition-colors hover:border-accent-line hover:text-fg"
              title={e.label}
            >
              {e.id}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-[13px] text-subtle">
          <Spinner /> Downloading structure…
        </div>
      )}
      {error && <Callout tone="danger">{error}</Callout>}

      {target && (
        <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-3">
          <div>
            <p className="text-[13px] font-medium leading-snug text-fg">{target.label}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {target.source.kind === 'pdb' && (
                <a href={entryUrl(target.source.id)} target="_blank" rel="noopener noreferrer">
                  <Badge tone="accent">{target.source.id.toUpperCase()}</Badge>
                </a>
              )}
              {target.info?.method && <Badge>{target.info.method.replace(' DIFFRACTION', '')}</Badge>}
              {target.info?.resolution && <Badge>{target.info.resolution.toFixed(2)} Å</Badge>}
              {target.isPredicted && <Badge tone="warning">Predicted model</Badge>}
              <Badge>{target.structure.atoms.length.toLocaleString()} atoms</Badge>
            </div>
          </div>

          {target.isPredicted && (
            <Callout tone="warning">
              Predicted structures have no bound ligand and side-chain positions are uncertain, especially in
              low-confidence regions. Check the pLDDT colouring before trusting a pocket.
            </Callout>
          )}

          {target.chains.length > 1 && (
            <div>
              <SectionLabel className="mb-1.5">Chains to dock against</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {target.chains.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleChain(c.id)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
                      selection.chains.includes(c.id)
                        ? 'border-accent-line bg-accent-soft text-accent'
                        : 'border-line bg-surface text-subtle hover:text-fg',
                    )}
                  >
                    {c.id} · {c.residues}
                  </button>
                ))}
              </div>
            </div>
          )}

          {target.hetero.length > 0 && (
            <div>
              <SectionLabel className="mb-1.5">Bound molecules</SectionLabel>
              <div className="space-y-1.5">
                {target.hetero.slice(0, 8).map((h) => (
                  <Checkbox
                    key={h.key}
                    checked={selection.keepHetero.includes(h.key)}
                    onChange={(v) =>
                      onSelectionChange({
                        ...selection,
                        keepHetero: v
                          ? [...selection.keepHetero, h.key]
                          : selection.keepHetero.filter((k) => k !== h.key),
                      })
                    }
                    label={
                      <span className="text-[13px]">
                        {h.resName}{' '}
                        <span className="text-subtle">
                          {h.chain}
                          {h.resSeq} · {h.atomCount} atoms
                        </span>
                      </span>
                    }
                    description={h.isMetal ? 'Metal ion — usually kept' : h.isAdditive ? 'Likely a crystallisation additive' : undefined}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-subtle">
                Unticked molecules are removed from the receptor. Waters are always removed.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
