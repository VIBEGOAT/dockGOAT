'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Download, FlaskConical, Layers3 } from 'lucide-react';
import TargetPanel, { type TargetMode, type TargetSelection } from '@/components/dock/TargetPanel';
import BoxPanel from '@/components/dock/BoxPanel';
import RunPanel, { DEFAULT_RUN, type RunSettings } from '@/components/dock/RunPanel';
import MoleculeDepiction from '@/components/viewer/MoleculeDepiction';
import { Badge, Button, Callout, Card, CardHeader, Checkbox, EmptyState, SectionLabel, Segmented, Textarea, cn } from '@/components/ui/primitives';
import { profileMolecule } from '@/lib/admet';
import type { Vec3 } from '@/lib/chem/geometry';
import { writeSDF } from '@/lib/chem/molfile';
import { getRDKit } from '@/lib/chem/rdkit';
import type { HetGroup } from '@/lib/chem/pdb';
import { detectPockets, type Pocket } from '@/lib/docking/pocket';
import { poseMolecule } from '@/lib/docking/poses';
import { prepareReceptor } from '@/lib/docking/receptor';
import { defaultThreads, ligandEfficiency, runVina, vinaSupportProblem, VinaCancelled, type VinaHandle, type VinaPhase } from '@/lib/docking/vina';
import {
  boxAroundHetero,
  loadLigand,
  loadTarget,
  prepareLigandForDocking,
  type LoadedTarget,
  type SearchBox,
} from '@/lib/workbench/inputs';

const MolViewer = dynamic(() => import('@/components/viewer/MolViewer'), { ssr: false });

type Status = 'queued' | 'filtered' | 'running' | 'done' | 'failed' | 'cancelled';

interface Hit {
  id: number;
  name: string;
  smiles: string;
  status: Status;
  note?: string;
  affinity?: number;
  le?: number;
  qed?: number;
  heavyAtoms?: number;
  sdf?: string;
  seconds?: number;
}

const EXAMPLE = `Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1 imatinib
COCCOc1cc2ncnc(Nc3cccc(C#C)c3)c2cc1OCCOC erlotinib
Cn1cnc2c1c(=O)n(C)c(=O)n2C caffeine
CC(=O)Oc1ccccc1C(=O)O aspirin
CC(C)Cc1ccc(cc1)C(C)C(=O)O ibuprofen`;

function parseLibrary(text: string) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l, i) => {
      const [smiles, ...rest] = l.split(/[\s,\t]+/);
      return { id: i, smiles, name: rest.join(' ') || `Compound ${i + 1}` };
    });
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ScreenWorkbench() {
  const [target, setTarget] = useState<LoadedTarget | null>(null);
  const [targetBusy, setTargetBusy] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [selection, setSelection] = useState<TargetSelection>({ chains: [], keepHetero: [] });
  const [box, setBox] = useState<SearchBox>({ center: [0, 0, 0], size: [22, 22, 22] });
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [activePocket, setActivePocket] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);

  const [library, setLibrary] = useState('');
  const [prefilter, setPrefilter] = useState(true);
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_RUN, exhaustiveness: 8, cpu: Math.min(4, defaultThreads()) });

  const [hits, setHits] = useState<Hit[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<VinaPhase>('loading');
  const [current, setCurrent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sort, setSort] = useState<'affinity' | 'le' | 'order'>('affinity');

  const cancelled = useRef(false);
  const handle = useRef<VinaHandle | null>(null);
  const blocked = typeof window === 'undefined' ? null : vinaSupportProblem();

  const loadT = useCallback(async (mode: TargetMode, value: string, file?: { name: string; text: string }) => {
    setTargetBusy(true);
    setTargetError(null);
    try {
      const t = await loadTarget(mode === 'pdb' ? { kind: 'pdb', id: value } : mode === 'alphafold' ? { kind: 'alphafold', uniprot: value } : { kind: 'file', name: file!.name, text: file!.text });
      setTarget(t);
      setPockets([]);
      setHits([]);
      const chains = t.chains.length ? [t.chains[0].id] : [];
      setSelection({ chains, keepHetero: t.hetero.filter((h) => h.isMetal).map((h) => h.key) });
      const lig = t.hetero.filter((h) => !h.isMetal && !h.isAdditive && h.atomCount >= 6 && (!chains.length || chains.includes(h.chain))).sort((a, b) => b.atomCount - a.atomCount)[0];
      if (lig) setBox(boxAroundHetero(lig));
    } catch (e) {
      setTargetError(e instanceof Error ? e.message : 'Could not load this structure');
    } finally {
      setTargetBusy(false);
    }
  }, []);

  const detect = useCallback(() => {
    if (!target) return;
    setDetecting(true);
    setTimeout(() => {
      try {
        const found = detectPockets(target.structure, { chains: selection.chains.length ? selection.chains : undefined });
        setPockets(found);
        if (found.length) {
          setActivePocket(found[0].id);
          setBox({ center: found[0].center, size: found[0].boxSize });
        }
      } finally {
        setDetecting(false);
      }
    }, 30);
  }, [target, selection.chains]);

  const items = useMemo(() => parseLibrary(library), [library]);

  const patch = (id: number, p: Partial<Hit>) => setHits((h) => h.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const run = useCallback(async () => {
    if (!target) return;
    setError(null);
    let receptor;
    try {
      receptor = prepareReceptor(target.structure, { chains: selection.chains.length ? selection.chains : undefined, keepHetero: selection.keepHetero });
    } catch (e) {
      return setError(e instanceof Error ? e.message : 'Receptor preparation failed');
    }

    const list = parseLibrary(library);
    if (!list.length) return setError('Add at least one compound.');
    if (list.length > 200) return setError('Browser screening is limited to 200 compounds per run.');

    cancelled.current = false;
    setRunning(true);
    setSelected(null);
    setHits(list.map((l) => ({ id: l.id, name: l.name, smiles: l.smiles, status: 'queued' as Status })));
    const rd = await getRDKit();

    let finished = 0;
    for (const item of list) {
      if (cancelled.current) {
        patch(item.id, { status: 'cancelled' });
        continue;
      }
      setCurrent(item.name);
      setProgress(finished / list.length);
      try {
        let qed: number | undefined;
        try {
          const prof = profileMolecule(rd, item.smiles, item.name);
          qed = prof.qed.score;
          const ro5 = prof.drugLikeness.rules.find((r) => r.name.startsWith('Lipinski'));
          if (prefilter && ro5 && !ro5.pass) {
            patch(item.id, { status: 'filtered', note: `Fails Lipinski (${ro5.violations} violations)`, qed });
            finished++;
            continue;
          }
        } catch (e) {
          patch(item.id, { status: 'failed', note: e instanceof Error ? e.message : 'Invalid SMILES' });
          finished++;
          continue;
        }

        patch(item.id, { status: 'running', qed });
        const lig = await loadLigand({ kind: 'smiles', smiles: item.smiles, name: item.name });
        const prep = prepareLigandForDocking(lig);
        const heavy = lig.molecule.atoms.filter((a) => a.el !== 'H').length;

        const h = runVina(receptor.pdbqt, prep.pdbqt, { center: box.center, size: box.size, exhaustiveness: settings.exhaustiveness, numModes: 3, energyRange: settings.energyRange, seed: settings.seed || undefined, cpu: settings.cpu, scoring: settings.scoring }, {
          onProgress: (p, ph) => {
            setPhase(ph);
            setProgress((finished + p) / list.length);
          },
        });
        handle.current = h;
        const res = await h.promise;
        const best = res.poses[0];
        const pose = poseMolecule(lig.molecule, prep.atomMap, best.coords, item.name);
        pose.props = { 'Vina affinity (kcal/mol)': best.affinity.toFixed(3), SMILES: lig.smiles };
        patch(item.id, {
          status: 'done',
          affinity: best.affinity,
          le: ligandEfficiency(best.affinity, heavy),
          heavyAtoms: heavy,
          sdf: writeSDF([pose]),
          seconds: res.seconds,
          smiles: lig.smiles,
        });
      } catch (e) {
        if (e instanceof VinaCancelled) patch(item.id, { status: 'cancelled' });
        else patch(item.id, { status: 'failed', note: e instanceof Error ? e.message : 'Docking failed' });
      }
      finished++;
    }
    handle.current = null;
    setProgress(1);
    setRunning(false);
    setCurrent('');
  }, [target, selection, library, prefilter, box, settings]);

  const cancel = useCallback(() => {
    cancelled.current = true;
    handle.current?.cancel();
  }, []);

  const ranked = useMemo(() => {
    const done = hits.filter((h) => h.status === 'done');
    const rest = hits.filter((h) => h.status !== 'done');
    done.sort((a, b) => (sort === 'le' ? (b.le ?? 0) - (a.le ?? 0) : sort === 'order' ? a.id - b.id : (a.affinity ?? 0) - (b.affinity ?? 0)));
    return [...done, ...rest];
  }, [hits, sort]);

  const completed = hits.filter((h) => h.status === 'done').length;
  const sel = hits.find((h) => h.id === selected);

  const exportCsv = () => {
    const rows = [['rank', 'name', 'smiles', 'affinity_kcal_per_mol', 'ligand_efficiency', 'qed', 'status', 'note'], ...ranked.map((h, i) => [i + 1, `"${h.name.replace(/"/g, '""')}"`, h.smiles, h.affinity?.toFixed(3) ?? '', h.le?.toFixed(3) ?? '', h.qed?.toFixed(3) ?? '', h.status, `"${h.note ?? ''}"`])];
    download('dockgoat-screen.csv', rows.map((r) => r.join(',')).join('\n'), 'text/csv');
  };
  const exportSdf = () => download('dockgoat-screen-poses.sdf', hits.filter((h) => h.sdf).map((h) => h.sdf).join(''), 'chemical/x-mdl-sdfile');

  return (
    <main className="mx-auto max-w-[1700px] px-3 py-4 sm:px-4">
      <div className="mb-3">
        <h1 className="text-lg font-semibold tracking-tight text-fg">Virtual screening</h1>
        <p className="text-[13px] text-subtle">Dock a compound library against one target, optionally filtering by drug-likeness first. Compounds run one after another on this device.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="scroll-thin space-y-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <TargetPanel target={target} loading={targetBusy} error={targetError} selection={selection} onLoad={loadT} onSelectionChange={setSelection} />
          <BoxPanel
            box={box}
            onChange={setBox}
            hetero={target?.hetero ?? []}
            pockets={pockets}
            detecting={detecting}
            onDetect={detect}
            activePocket={activePocket}
            onUseHetero={(h: HetGroup) => {
              setBox(boxAroundHetero(h));
              setActivePocket(null);
            }}
            onUsePocket={(p) => {
              setActivePocket(p.id);
              setBox({ center: p.center as Vec3, size: p.boxSize });
            }}
            torsions={6}
            disabled={!target}
          />

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-accent" />
              <SectionLabel>Library</SectionLabel>
            </div>
            <Textarea rows={7} value={library} onChange={(e) => setLibrary(e.target.value)} placeholder="SMILES [name], one per line" spellCheck={false} aria-label="Compound library" disabled={running} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-subtle">{items.length} compound{items.length === 1 ? '' : 's'}</span>
              <div className="flex gap-1.5">
                <Button size="xs" variant="secondary" onClick={() => setLibrary(EXAMPLE)} disabled={running}>
                  Example set
                </Button>
                <label className="inline-flex h-7 cursor-pointer items-center rounded-md border border-line bg-surface px-2 text-xs font-medium text-fg shadow-sm hover:bg-surface-2">
                  Load file
                  <input type="file" accept=".smi,.smiles,.txt,.csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLibrary(await f.text()); e.target.value = ''; }} />
                </label>
              </div>
            </div>
            <Checkbox checked={prefilter} onChange={setPrefilter} label="Skip compounds that fail Lipinski's rule of five" description="Saves time by not docking molecules unlikely to be orally bioavailable." disabled={running} />
          </section>

          <RunPanel settings={settings} onChange={setSettings} onRun={run} onCancel={cancel} running={running} progress={progress} phase={phase} blocked={blocked ?? (!target ? 'Load a target structure first.' : !items.length ? 'Add compounds to screen.' : null)} maxThreads={defaultThreads()} elapsed={0} />
          {running && current && <p className="text-center text-[12px] text-muted">Docking <span className="font-medium text-fg">{current}</span> · {completed} of {items.length} done</p>}
          {error && <Callout tone="danger">{error}</Callout>}
        </div>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <Card className="flex min-h-[420px] flex-col overflow-hidden xl:h-[calc(100vh-7rem)]">
            <CardHeader
              title={hits.length ? `Ranking · ${completed}/${hits.length} docked` : 'Ranking'}
              actions={
                hits.length > 0 && (
                  <>
                    <Segmented size="sm" value={sort} onChange={setSort} options={[{ value: 'affinity', label: 'Affinity' }, { value: 'le', label: 'LE' }, { value: 'order', label: 'Input' }]} />
                    <Button size="xs" variant="ghost" onClick={exportCsv} icon={<Download className="h-3.5 w-3.5" />}>CSV</Button>
                    <Button size="xs" variant="ghost" onClick={exportSdf} disabled={!completed}>SDF</Button>
                  </>
                )
              }
            />
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
              {hits.length === 0 ? (
                <EmptyState icon={<FlaskConical className="h-5 w-5" />} title="No screen run yet">Load a target, paste a library and run. Results rank by predicted affinity, with ligand efficiency to correct for size.</EmptyState>
              ) : (
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wide text-subtle">
                    <tr><th className="px-3 py-2 text-left font-medium">#</th><th className="px-2 py-2 text-left font-medium">Compound</th><th className="px-2 py-2 text-right font-medium">kcal/mol</th><th className="px-2 py-2 text-right font-medium">LE</th><th className="px-3 py-2 text-right font-medium">QED</th></tr>
                  </thead>
                  <tbody>
                    {ranked.map((h, i) => (
                      <tr key={h.id} onClick={() => h.status === 'done' && setSelected(h.id)} className={cn('border-b border-line last:border-0', h.status === 'done' && 'cursor-pointer', selected === h.id ? 'bg-accent-soft' : h.status === 'done' ? 'hover:bg-surface-2' : '')}>
                        <td className="tabular px-3 py-2 text-subtle">{h.status === 'done' ? i + 1 : '–'}</td>
                        <td className="max-w-[170px] px-2 py-2">
                          <p className="truncate font-medium text-fg" title={h.name}>{h.name}</p>
                          {h.status !== 'done' && (
                            <Badge tone={h.status === 'failed' ? 'danger' : h.status === 'filtered' ? 'warning' : h.status === 'running' ? 'accent' : 'neutral'}>
                              {h.status === 'running' ? 'docking…' : h.status}
                            </Badge>
                          )}
                          {h.note && <p className="mt-0.5 truncate text-[11px] text-subtle" title={h.note}>{h.note}</p>}
                        </td>
                        <td className="tabular px-2 py-2 text-right font-medium text-fg">{h.affinity?.toFixed(2) ?? ''}</td>
                        <td className="tabular px-2 py-2 text-right text-subtle">{h.le?.toFixed(2) ?? ''}</td>
                        <td className="tabular px-3 py-2 text-right text-subtle">{h.qed?.toFixed(2) ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          <Card className="flex min-h-[420px] flex-col overflow-hidden xl:h-[calc(100vh-7rem)]">
            <CardHeader title={sel ? sel.name : 'Best pose'} description={sel ? `${sel.affinity?.toFixed(2)} kcal/mol · ligand efficiency ${sel.le?.toFixed(2)}` : 'Select a docked compound'} />
            {sel && (
              <div className="h-28 border-b border-line">
                <MoleculeDepiction smiles={sel.smiles} width={400} height={200} />
              </div>
            )}
            <div className="min-h-0 flex-1">
              <MolViewer
                receptor={target ? { data: target.text, format: target.format } : null}
                receptorStyle="cartoon"
                colorScheme="neutral"
                showHetero={false}
                ligands={sel?.sdf ? [{ id: `s${sel.id}`, data: sel.sdf, format: 'sdf', color: '#22c55e', style: 'sticks' }] : []}
                box={target ? box : null}
                focusKey={sel ? `s${sel.id}` : target ? 'target' : undefined}
                focus={sel ? 'ligands' : 'all'}
                placeholder={<p className="text-[13px] text-subtle">The docked pose appears here.</p>}
              />
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
