'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Maximize2, RotateCw } from 'lucide-react';
import Ramachandran from './Ramachandran';
import TargetPanel, { type TargetMode, type TargetSelection } from '@/components/dock/TargetPanel';
import { Badge, Button, Callout, Card, CardHeader, Checkbox, EmptyState, SectionLabel, Segmented, Stat, cn } from '@/components/ui/primitives';
import type { ColorScheme, ReceptorStyle, ViewerHandle } from '@/components/viewer/MolViewer';
import { protParam } from '@/lib/bio/protparam';
import { ramachandran, ramachandranSummary } from '@/lib/bio/ramachandran';
import { chainSequencesFromStructure, formatFasta } from '@/lib/bio/sequence';
import { loadTarget, type LoadedTarget } from '@/lib/workbench/inputs';

const MolViewer = dynamic(() => import('@/components/viewer/MolViewer'), { ssr: false });

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const COLOR_OPTIONS: { value: ColorScheme; label: string }[] = [
  { value: 'spectrum', label: 'Rainbow' },
  { value: 'chain', label: 'Chain' },
  { value: 'ss', label: 'Secondary structure' },
  { value: 'bfactor', label: 'B-factor / pLDDT' },
  { value: 'hydrophobicity', label: 'Hydrophobicity' },
  { value: 'neutral', label: 'Neutral' },
];

export default function ViewerWorkbench() {
  const [target, setTarget] = useState<LoadedTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<TargetSelection>({ chains: [], keepHetero: [] });

  const [style, setStyle] = useState<ReceptorStyle>('cartoon');
  const [scheme, setScheme] = useState<ColorScheme>('spectrum');
  const [hetero, setHetero] = useState(true);
  const [water, setWater] = useState(false);
  const [spin, setSpin] = useState(false);
  const [tab, setTab] = useState<'info' | 'sequence' | 'rama'>('info');
  const [chain, setChain] = useState<string>('');
  const [picked, setPicked] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState('a');
  const viewerRef = useRef<ViewerHandle>(null);

  const load = useCallback(async (mode: TargetMode, value: string, file?: { name: string; text: string }) => {
    setBusy(true);
    setError(null);
    try {
      const t = await loadTarget(mode === 'pdb' ? { kind: 'pdb', id: value } : mode === 'alphafold' ? { kind: 'alphafold', uniprot: value } : { kind: 'file', name: file!.name, text: file!.text });
      setTarget(t);
      setSelection({ chains: t.chains.map((c) => c.id), keepHetero: [] });
      setChain(t.chains[0]?.id ?? '');
      setScheme(t.isPredicted ? 'bfactor' : 'spectrum');
      setFocusKey(`t${Date.now()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this structure');
    } finally {
      setBusy(false);
    }
  }, []);

  // Allow /viewer?pdb=1IEP deep links.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('pdb');
    if (id) load('pdb', id);
  }, [load]);

  const seqs = useMemo(() => (target ? chainSequencesFromStructure(target.structure) : []), [target]);
  const activeSeq = seqs.find((s) => s.chain === chain) ?? seqs[0];
  const props = useMemo(() => (activeSeq && activeSeq.sequence.length ? protParam(activeSeq.sequence) : null), [activeSeq]);
  const rama = useMemo(() => (target ? ramachandran(target.structure) : []), [target]);
  const ramaSummary = useMemo(() => ramachandranSummary(rama), [rama]);
  const ramaChain = useMemo(() => rama.filter((p) => !chain || p.chain === chain), [rama, chain]);

  const highlightResidues = useMemo(() => {
    const p = rama.find((r) => r.key === picked);
    return p ? [{ chain: p.chain, resi: p.resSeq, label: `${p.resName}${p.resSeq}` }] : [];
  }, [picked, rama]);

  return (
    <main className="mx-auto max-w-[1700px] px-3 py-4 sm:px-4">
      <div className="mb-3">
        <h1 className="text-lg font-semibold tracking-tight text-fg">Structure viewer</h1>
        <p className="text-[13px] text-subtle">Inspect any protein structure in 3D alongside its sequence properties and backbone geometry.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_400px]">
        <div className="scroll-thin space-y-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <TargetPanel target={target} loading={busy} error={error} selection={selection} onLoad={load} onSelectionChange={setSelection} />
          {target && (
            <section className="space-y-3">
              <SectionLabel>Display</SectionLabel>
              <Segmented fullWidth size="sm" value={style} onChange={setStyle} options={[{ value: 'cartoon', label: 'Cartoon' }, { value: 'surface', label: 'Surface' }, { value: 'sticks', label: 'Sticks' }, { value: 'lines', label: 'Lines' }]} />
              <div>
                <p className="mb-1.5 text-[11px] font-medium text-subtle">Colour by</p>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTIONS.map((o) => (
                    <button key={o.value} type="button" onClick={() => setScheme(o.value)} className={cn('rounded-md border px-2 py-1 text-[11px] font-medium transition-colors', scheme === o.value ? 'border-accent-line bg-accent-soft text-accent' : 'border-line bg-surface text-subtle hover:text-fg')}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <Checkbox checked={hetero} onChange={setHetero} label="Ligands, cofactors and ions" />
              <Checkbox checked={water} onChange={setWater} label="Water molecules" />
              <Checkbox checked={spin} onChange={setSpin} label="Rotate slowly" />
            </section>
          )}
        </div>

        <div className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-line bg-surface lg:h-[calc(100vh-7rem)]">
          <div className="flex items-center justify-end gap-1 border-b border-line px-3 py-2">
            <Button size="xs" variant="ghost" onClick={() => setSpin((v) => !v)} icon={<RotateCw className="h-3.5 w-3.5" />} title="Toggle rotation" />
            <Button size="xs" variant="ghost" onClick={() => setFocusKey(`f${Date.now()}`)} icon={<Maximize2 className="h-3.5 w-3.5" />} title="Fit the view" />
            <Button size="xs" variant="ghost" icon={<Camera className="h-3.5 w-3.5" />} title="Save a PNG" onClick={() => { const u = viewerRef.current?.snapshot(); if (u) { const a = document.createElement('a'); a.href = u; a.download = 'dockgoat-structure.png'; a.click(); } }} />
          </div>
          <div className="relative min-h-0 flex-1">
            <MolViewer
              ref={viewerRef}
              receptor={target ? { data: target.text, format: target.format } : null}
              receptorStyle={style}
              colorScheme={scheme}
              showHetero={hetero}
              showWater={water}
              residues={highlightResidues}
              spin={spin}
              focusKey={focusKey}
              placeholder={<div className="max-w-xs text-[13px] text-subtle"><p className="font-medium text-muted">No structure loaded</p><p className="mt-1">Load a PDB entry, an AlphaFold model or your own file.</p></div>}
            />
          </div>
        </div>

        <Card className="flex min-h-[420px] flex-col overflow-hidden xl:h-[calc(100vh-7rem)]">
          <div className="border-b border-line px-3 py-2">
            <Segmented size="sm" value={tab} onChange={setTab} options={[{ value: 'info', label: 'Overview' }, { value: 'sequence', label: 'Sequence' }, { value: 'rama', label: 'Backbone' }]} />
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
            {!target ? (
              <EmptyState title="Nothing to analyse yet">Load a structure to see its composition, sequence properties and Ramachandran plot.</EmptyState>
            ) : tab === 'info' ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] font-medium leading-snug text-fg">{target.label}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge>{target.structure.atoms.length.toLocaleString()} atoms</Badge>
                    <Badge>{target.chains.length} chain{target.chains.length === 1 ? '' : 's'}</Badge>
                    {target.info?.method && <Badge>{target.info.method}</Badge>}
                    {target.info?.resolution && <Badge>{target.info.resolution.toFixed(2)} Å</Badge>}
                    {target.info?.releaseDate && <Badge>Released {target.info.releaseDate}</Badge>}
                  </div>
                </div>
                {target.info?.polymers.map((p, i) => (
                  <div key={i} className="rounded-lg border border-line bg-surface-2 p-2.5 text-[12.5px]">
                    <p className="font-medium text-fg">{p.description}</p>
                    <p className="text-subtle">{p.organism}{p.chains.length ? ` · chains ${p.chains.join(', ')}` : ''}</p>
                    {p.uniprot && <a className="text-accent underline" href={`https://www.uniprot.org/uniprotkb/${p.uniprot}`} target="_blank" rel="noopener noreferrer">UniProt {p.uniprot}</a>}
                  </div>
                ))}
                {target.info && target.info.ligands.length > 0 && (
                  <div>
                    <SectionLabel className="mb-1.5">Small molecules</SectionLabel>
                    <ul className="space-y-1">
                      {target.info.ligands.map((l) => (
                        <li key={l.id} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                          <span className="min-w-0 truncate text-muted" title={l.name}>{l.id} — {l.name.toLowerCase()}</span>
                          {l.weight && <span className="tabular shrink-0 text-subtle">{l.weight.toFixed(0)} Da</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {rama.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Residues" value={target.chains.reduce((n, c) => n + c.residues, 0)} />
                    <Stat label="Rama favoured" value={`${ramaSummary.favouredPct.toFixed(1)}%`} tone={ramaSummary.favouredPct >= 90 ? 'success' : 'warning'} />
                  </div>
                )}
              </div>
            ) : tab === 'sequence' ? (
              !activeSeq || !props ? (
                <EmptyState title="No protein chain">This structure has no amino-acid chain to analyse.</EmptyState>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {seqs.map((s) => (
                      <button key={s.chain} type="button" onClick={() => setChain(s.chain)} className={cn('rounded-md border px-2 py-1 text-[11px] font-medium', s.chain === activeSeq.chain ? 'border-accent-line bg-accent-soft text-accent' : 'border-line bg-surface text-subtle hover:text-fg')}>
                        Chain {s.chain} · {s.sequence.length}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Mol. weight" value={(props.molecularWeight / 1000).toFixed(2)} unit="kDa" />
                    <Stat label="Theoretical pI" value={props.pI.toFixed(2)} />
                    <Stat label="Instability" value={props.instabilityIndex.toFixed(1)} tone={props.stable ? 'success' : 'warning'} hint={props.stable ? 'Predicted stable' : 'Predicted unstable'} />
                    <Stat label="GRAVY" value={props.gravy.toFixed(3)} hint="Kyte–Doolittle" />
                    <Stat label="Charge at pH 7.4" value={props.chargeAtPH74.toFixed(1)} />
                    <Stat label="Aliphatic index" value={props.aliphaticIndex.toFixed(1)} />
                    <Stat label="ε₂₈₀" value={props.extinction.cystines.toLocaleString()} unit="M⁻¹cm⁻¹" hint="Cystines formed" />
                    <Stat label="Formula" value={<span className="text-[11px] break-all">{props.formula}</span>} />
                  </div>
                  {activeSeq.gaps > 0 && <Callout tone="warning">{activeSeq.gaps} chain break{activeSeq.gaps === 1 ? '' : 's'}: the structure has missing residues.</Callout>}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <SectionLabel>Sequence</SectionLabel>
                      <button type="button" className="text-[11px] font-medium text-accent hover:underline" onClick={() => download(`${activeSeq.id}.fasta`, formatFasta(activeSeq.id, activeSeq.sequence))}>Download FASTA</button>
                    </div>
                    <p className="break-all rounded-md border border-line bg-surface-2 p-2 font-mono text-[11.5px] leading-relaxed text-muted">{activeSeq.sequence}</p>
                  </div>
                  <p className="text-[11px] text-subtle">Computed as in ExPASy ProtParam (Gasteiger et al., 2005). Sequence is taken from resolved residues.</p>
                </div>
              )
            ) : rama.length === 0 ? (
              <EmptyState title="No backbone data">No residues with a complete backbone were found.</EmptyState>
            ) : (
              <div className="space-y-3">
                <Ramachandran points={ramaChain} highlight={picked} onPick={(p) => setPicked(p.key)} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Favoured" value={`${ramaSummary.favouredPct.toFixed(1)}%`} tone="success" />
                  <Stat label="Allowed" value={`${ramaSummary.allowedPct.toFixed(1)}%`} />
                  <Stat label="Outliers" value={ramaSummary.outlier} tone={ramaSummary.outlier ? 'danger' : undefined} />
                </div>
                {ramaSummary.outliers.length > 0 && (
                  <div>
                    <SectionLabel className="mb-1">Outliers — click to highlight</SectionLabel>
                    <div className="flex flex-wrap gap-1">
                      {ramaSummary.outliers.slice(0, 24).map((o) => (
                        <button key={o.key} type="button" onClick={() => setPicked(o.key)} className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-danger hover:bg-surface-3">{o.resName}{o.resSeq}</button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-[11px] leading-snug text-subtle">Regions follow the MolProbity Top8000 distributions, classified on a 2° grid (an approximation of MolProbity&apos;s interpolated contours). Circles are general residues, squares glycine, triangles proline.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}
