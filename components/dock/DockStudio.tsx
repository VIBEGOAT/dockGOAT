'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Eye, Maximize2, RotateCcw } from 'lucide-react';
import TargetPanel, { type TargetMode, type TargetSelection } from './TargetPanel';
import LigandPanel, { type LigandMode } from './LigandPanel';
import BoxPanel from './BoxPanel';
import RunPanel, { DEFAULT_RUN, type RunSettings } from './RunPanel';
import ResultsPanel, { INTERACTION_COLOR } from './ResultsPanel';
import { Badge, Button, Callout, Segmented, Spinner, cn } from '@/components/ui/primitives';
import type { ViewerHandle, ViewerLigand, ViewerLine, ReceptorStyle } from '@/components/viewer/MolViewer';
import type { Vec3 } from '@/lib/chem/geometry';
import type { HetGroup } from '@/lib/chem/pdb';
import { analyzeInteractions, type InteractionReport } from '@/lib/docking/interactions';
import { detectPockets, type Pocket } from '@/lib/docking/pocket';
import { poseMolecule, redockingRmsd } from '@/lib/docking/poses';
import { prepareReceptor, type PreparedReceptor } from '@/lib/docking/receptor';
import type { PreparedLigand } from '@/lib/docking/ligand';
import { defaultThreads, runVina, vinaSupportProblem, VinaCancelled, type VinaHandle, type VinaPhase, type VinaResult } from '@/lib/docking/vina';
import { writeSDF } from '@/lib/chem/molfile';
import { getRDKit } from '@/lib/chem/rdkit';
import {
  boxAroundHetero,
  loadLigand,
  loadTarget,
  prepareLigandForDocking,
  type LoadedLigand,
  type LoadedTarget,
  type SearchBox,
} from '@/lib/workbench/inputs';

const MolViewer = dynamic(() => import('@/components/viewer/MolViewer'), { ssr: false });

const POSE_COLORS = ['#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#ef4444', '#14b8a6', '#eab308', '#6366f1'];

function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DockStudio() {
  // ── inputs ──────────────────────────────────────────────────────────────
  const [target, setTarget] = useState<LoadedTarget | null>(null);
  const [targetBusy, setTargetBusy] = useState(false);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [selection, setSelection] = useState<TargetSelection>({ chains: [], keepHetero: [] });

  const [ligand, setLigand] = useState<LoadedLigand | null>(null);
  const [ligandBusy, setLigandBusy] = useState(false);
  const [ligandError, setLigandError] = useState<string | null>(null);

  const [box, setBox] = useState<SearchBox>({ center: [0, 0, 0], size: [22, 22, 22] });
  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [activePocket, setActivePocket] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);

  // ── run ─────────────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<RunSettings>({ ...DEFAULT_RUN, cpu: 4 });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<VinaPhase>('loading');
  const [elapsed, setElapsed] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<VinaResult | null>(null);
  const [selectedPose, setSelectedPose] = useState(0);
  const [redockRmsd, setRedockRmsd] = useState<number | null>(null);
  const handleRef = useRef<VinaHandle | null>(null);

  // ── viewer ──────────────────────────────────────────────────────────────
  const [style, setStyle] = useState<ReceptorStyle>('cartoon');
  const [showAllPoses, setShowAllPoses] = useState(false);
  const [showPocketPoints, setShowPocketPoints] = useState(false);
  const viewerRef = useRef<ViewerHandle>(null);
  const [focusKey, setFocusKey] = useState('init');

  const [blocked, setBlocked] = useState<string | null>(null);
  const maxThreads = useMemo(() => defaultThreads(), []);

  useEffect(() => {
    setBlocked(vinaSupportProblem());
    setSettings((s) => ({ ...s, cpu: Math.min(s.cpu, defaultThreads()) }));
  }, []);

  // Warn before leaving mid-run.
  useEffect(() => {
    if (!running) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - started) / 1000), 200);
    return () => clearInterval(t);
  }, [running]);

  /* ─────────────────────────── loading inputs ──────────────────────────── */

  const handleLoadTarget = useCallback(async (mode: TargetMode, value: string, file?: { name: string; text: string }) => {
    setTargetBusy(true);
    setTargetError(null);
    try {
      const loaded = await loadTarget(
        mode === 'pdb' ? { kind: 'pdb', id: value } : mode === 'alphafold' ? { kind: 'alphafold', uniprot: value } : { kind: 'file', name: file!.name, text: file!.text },
      );
      setTarget(loaded);
      setPockets([]);
      setActivePocket(null);
      setResult(null);
      setRedockRmsd(null);
      const chains = loaded.chains.length ? [loaded.chains[0].id] : [];
      // Metal ions are part of many binding sites, so keep them by default.
      const metals = loaded.hetero.filter((h) => h.isMetal).map((h) => h.key);
      setSelection({ chains, keepHetero: metals });

      // Centre the box on the most interesting bound molecule, if there is one.
      const candidate = loaded.hetero
        .filter((h) => !h.isMetal && !h.isAdditive && h.atomCount >= 6 && (!chains.length || chains.includes(h.chain)))
        .sort((a, b) => b.atomCount - a.atomCount)[0];
      if (candidate) {
        setBox(boxAroundHetero(candidate));
      } else {
        const atoms = loaded.structure.atoms;
        const c: Vec3 = [0, 0, 0];
        for (const a of atoms) {
          c[0] += a.x / atoms.length;
          c[1] += a.y / atoms.length;
          c[2] += a.z / atoms.length;
        }
        setBox({ center: c, size: [24, 24, 24] });
      }
      setFocusKey(`target-${Date.now()}`);
    } catch (e) {
      setTargetError(e instanceof Error ? e.message : 'Could not load this structure');
    } finally {
      setTargetBusy(false);
    }
  }, []);

  const handleLoadLigand = useCallback(
    async (mode: LigandMode, value: string, extra?: { file?: { name: string; text: string }; group?: HetGroup }) => {
      setLigandBusy(true);
      setLigandError(null);
      try {
        const loaded = await loadLigand(
          mode === 'smiles'
            ? { kind: 'smiles', smiles: value }
            : mode === 'name'
              ? { kind: 'name', query: value }
              : mode === 'file'
                ? { kind: 'file', name: extra!.file!.name, text: extra!.file!.text }
                : { kind: 'hetero', target: target!, group: extra!.group! },
        );
        setLigand(loaded);
        setResult(null);
        setRedockRmsd(null);
        if (mode === 'bound' && extra?.group) setBox(boxAroundHetero(extra.group));
      } catch (e) {
        setLigandError(e instanceof Error ? e.message : 'Could not build this ligand');
      } finally {
        setLigandBusy(false);
      }
    },
    [target],
  );

  const handleDetect = useCallback(() => {
    if (!target) return;
    setDetecting(true);
    // Yield a frame so the spinner paints before the synchronous scan.
    setTimeout(() => {
      try {
        const found = detectPockets(target.structure, { chains: selection.chains.length ? selection.chains : undefined });
        setPockets(found);
        if (found.length) {
          setActivePocket(found[0].id);
          setBox({ center: found[0].center, size: found[0].boxSize });
          setShowPocketPoints(true);
        }
      } finally {
        setDetecting(false);
      }
    }, 30);
  }, [target, selection.chains]);

  /* ───────────────────────────── preparation ───────────────────────────── */

  const prepared = useMemo((): { receptor: PreparedReceptor; error?: undefined } | { receptor?: undefined; error: string } | null => {
    if (!target) return null;
    try {
      return {
        receptor: prepareReceptor(target.structure, {
          chains: selection.chains.length ? selection.chains : undefined,
          keepHetero: selection.keepHetero,
        }),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Receptor preparation failed' };
    }
  }, [target, selection]);

  const preparedLigand = useMemo((): { ligand: PreparedLigand; error?: undefined } | { ligand?: undefined; error: string } | null => {
    if (!ligand) return null;
    try {
      return { ligand: prepareLigandForDocking(ligand) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Ligand preparation failed' };
    }
  }, [ligand]);

  /* ──────────────────────────────── running ────────────────────────────── */

  const run = useCallback(async () => {
    if (!prepared?.receptor || !preparedLigand?.ligand) return;
    setRunError(null);
    setResult(null);
    setRedockRmsd(null);
    setProgress(0);
    setPhase('loading');
    setElapsed(0);
    setRunning(true);

    const handle = runVina(
      prepared.receptor.pdbqt,
      preparedLigand.ligand.pdbqt,
      {
        center: box.center,
        size: box.size,
        exhaustiveness: settings.exhaustiveness,
        numModes: settings.numModes,
        energyRange: settings.energyRange,
        seed: settings.seed || undefined,
        cpu: settings.cpu,
        scoring: settings.scoring,
      },
      {
        onProgress: (p, ph) => {
          setProgress(p);
          setPhase(ph);
        },
      },
    );
    handleRef.current = handle;

    try {
      const res = await handle.promise;
      setResult(res);
      setSelectedPose(0);
      setFocusKey(`result-${Date.now()}`);
    } catch (e) {
      if (!(e instanceof VinaCancelled)) setRunError(e instanceof Error ? e.message : 'Docking failed');
    } finally {
      setRunning(false);
      handleRef.current = null;
    }
  }, [prepared, preparedLigand, box, settings]);

  const cancel = useCallback(() => handleRef.current?.cancel(), []);

  /* ───────────────────────── pose molecules & analysis ─────────────────── */

  const poseMolecules = useMemo(() => {
    if (!result || !ligand || !preparedLigand?.ligand) return [];
    return result.poses.map((p) => poseMolecule(ligand.molecule, preparedLigand.ligand.atomMap, p.coords, `${ligand.name} mode ${p.mode}`));
  }, [result, ligand, preparedLigand]);

  const [interactions, setInteractions] = useState<InteractionReport | null>(null);
  useEffect(() => {
    const mol = poseMolecules[selectedPose];
    if (!mol || !prepared?.receptor) {
      setInteractions(null);
      return;
    }
    // Analyse against the prepared receptor so polar hydrogens are available.
    setInteractions(analyzeInteractions(prepared.receptor.structure, mol, { includeHetero: true }));
  }, [poseMolecules, selectedPose, prepared]);

  // Redocking validation: compare the top pose with the bound ligand it came from.
  useEffect(() => {
    let alive = true;
    const run = async () => {
      const mol = poseMolecules[0];
      if (!mol || !ligand || ligand.geometry !== 'experimental' || !target) {
        if (alive) setRedockRmsd(null);
        return;
      }
      const rd = await getRDKit();
      if (!alive) return;
      const v = redockingRmsd(rd, ligand.molecule, preparedLigand!.ligand!.atomMap, mol);
      if (alive && Number.isFinite(v)) setRedockRmsd(v);
    };
    run();
    return () => {
      alive = false;
    };
  }, [poseMolecules, ligand, target, preparedLigand]);

  /* ──────────────────────────────── viewer ─────────────────────────────── */

  const viewerLigands = useMemo((): ViewerLigand[] => {
    if (poseMolecules.length) {
      const list = showAllPoses ? poseMolecules : [poseMolecules[selectedPose]];
      return list
        .filter(Boolean)
        .map((m, i) => ({
          id: `pose-${showAllPoses ? i : selectedPose}`,
          data: writeSDF([m]),
          format: 'sdf' as const,
          color: POSE_COLORS[(showAllPoses ? i : selectedPose) % POSE_COLORS.length],
          style: 'sticks' as const,
          opacity: showAllPoses && i !== selectedPose ? 0.45 : 1,
        }));
    }
    if (ligand) return [{ id: 'input', data: writeSDF([ligand.molecule]), format: 'sdf', color: '#94a3b8', style: 'sticks', opacity: 0.9 }];
    return [];
  }, [poseMolecules, selectedPose, showAllPoses, ligand]);

  const viewerLines = useMemo((): ViewerLine[] => {
    if (!interactions) return [];
    return interactions.interactions.map((it) => ({
      from: it.ligandPoint,
      to: it.receptorPoint,
      color: INTERACTION_COLOR[it.type],
      dashed: true,
      radius: it.type === 'hydrophobic' ? 0.035 : 0.055,
    }));
  }, [interactions]);

  const viewerResidues = useMemo(() => {
    if (!interactions) return [];
    const seen = new Map<string, { chain: string; resi: number; label: string }>();
    for (const it of interactions.interactions)
      if (!seen.has(it.residue)) seen.set(it.residue, { chain: it.chain, resi: it.resSeq, label: `${it.resName}${it.resSeq}` });
    return [...seen.values()];
  }, [interactions]);

  const pocketPoints = useMemo(() => {
    if (!showPocketPoints || !pockets.length) return [];
    const p = pockets.find((x) => x.id === activePocket) ?? pockets[0];
    return [{ positions: p.points, color: '#38bdf8', radius: 0.3 }];
  }, [showPocketPoints, pockets, activePocket]);

  /* ──────────────────────────────── exports ────────────────────────────── */

  const handleDownload = useCallback(
    (what: 'pdbqt' | 'sdf' | 'csv' | 'log') => {
      if (!result) return;
      const stem = `${(ligand?.name ?? 'ligand').replace(/[^\w.-]+/g, '_')}_${target?.source.kind === 'pdb' ? target.source.id.toUpperCase() : 'target'}`;
      if (what === 'pdbqt') return download(`${stem}_poses.pdbqt`, result.outputPdbqt, 'chemical/x-pdbqt');
      if (what === 'log') return download(`${stem}_vina.log`, result.log);
      if (what === 'sdf') {
        const mols = poseMolecules.map((m, i) => ({
          ...m,
          props: {
            ...m.props,
            Mode: String(result.poses[i].mode),
            'Vina affinity (kcal/mol)': result.poses[i].affinity.toFixed(3),
            'RMSD lb': result.poses[i].rmsdLB.toFixed(3),
            'RMSD ub': result.poses[i].rmsdUB.toFixed(3),
            Seed: String(result.seed),
            Exhaustiveness: String(result.config.exhaustiveness),
            'Scoring function': result.config.scoring ?? 'vina',
          },
        }));
        return download(`${stem}_poses.sdf`, writeSDF(mols), 'chemical/x-mdl-sdfile');
      }
      const rows = [
        ['mode', 'affinity_kcal_per_mol', 'rmsd_lb', 'rmsd_ub'],
        ...result.poses.map((p) => [p.mode, p.affinity.toFixed(3), p.rmsdLB.toFixed(3), p.rmsdUB.toFixed(3)]),
      ];
      download(`${stem}_scores.csv`, rows.map((r) => r.join(',')).join('\n'), 'text/csv');
    },
    [result, poseMolecules, ligand, target],
  );

  const snapshot = useCallback(() => {
    const uri = viewerRef.current?.snapshot();
    if (!uri) return;
    const a = document.createElement('a');
    a.href = uri;
    a.download = 'dockgoat-view.png';
    a.click();
  }, []);

  const prepError = prepared?.error ?? preparedLigand?.error ?? null;
  const canRun = !!prepared?.receptor && !!preparedLigand?.ligand && !blocked && !running;

  return (
    <main className="mx-auto max-w-[1700px] px-3 py-4 sm:px-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg">Docking Studio</h1>
          <p className="text-[13px] text-subtle">
            AutoDock Vina 1.2.3 compiled to WebAssembly — every step runs on this machine.
          </p>
        </div>
        {prepared?.receptor && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{prepared.receptor.stats.residues} residues</Badge>
            <Badge>{prepared.receptor.stats.heavyAtoms.toLocaleString()} heavy atoms</Badge>
            <Badge>{prepared.receptor.stats.polarHydrogens} polar H</Badge>
            {prepared.receptor.stats.removedWaters > 0 && <Badge>{prepared.receptor.stats.removedWaters} waters removed</Badge>}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_380px]">
        {/* ── inputs column ──────────────────────────────────────────── */}
        <div className="scroll-thin space-y-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">
          <TargetPanel
            target={target}
            loading={targetBusy}
            error={targetError}
            selection={selection}
            onLoad={handleLoadTarget}
            onSelectionChange={setSelection}
          />
          <LigandPanel
            ligand={ligand}
            loading={ligandBusy}
            error={ligandError}
            target={target}
            torsions={preparedLigand?.ligand?.torsions.length ?? null}
            onLoad={handleLoadLigand}
          />
          <BoxPanel
            box={box}
            onChange={setBox}
            hetero={target?.hetero ?? []}
            pockets={pockets}
            detecting={detecting}
            onDetect={handleDetect}
            activePocket={activePocket}
            onUseHetero={(h) => {
              setBox(boxAroundHetero(h));
              setActivePocket(null);
              setFocusKey(`box-${Date.now()}`);
            }}
            onUsePocket={(p) => {
              setActivePocket(p.id);
              setBox({ center: p.center, size: p.boxSize });
              setShowPocketPoints(true);
              setFocusKey(`box-${Date.now()}`);
            }}
            torsions={preparedLigand?.ligand?.torsions.length ?? 0}
            disabled={!target}
          />
          <RunPanel
            settings={settings}
            onChange={setSettings}
            onRun={run}
            onCancel={cancel}
            running={running}
            progress={progress}
            phase={phase}
            blocked={blocked ?? (canRun || running ? null : !target ? 'Load a target structure first.' : !ligand ? 'Add a ligand to dock.' : prepError)}
            maxThreads={maxThreads}
            elapsed={elapsed}
          />
          {prepError && <Callout tone="danger" title="Preparation problem">{prepError}</Callout>}
          {runError && <Callout tone="danger" title="Docking failed">{runError}</Callout>}
          {prepared?.receptor?.stats.warnings.length ? (
            <Callout tone="warning" title="Receptor notes">
              <ul className="list-inside list-disc">
                {prepared.receptor.stats.warnings.slice(0, 4).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Callout>
          ) : null}
        </div>

        {/* ── viewer ─────────────────────────────────────────────────── */}
        <div className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-line bg-surface lg:h-[calc(100vh-7rem)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <Segmented
              size="sm"
              value={style}
              onChange={setStyle}
              options={[
                { value: 'cartoon', label: 'Cartoon' },
                { value: 'cartoon-sticks', label: 'Cartoon + sticks' },
                { value: 'surface', label: 'Surface' },
                { value: 'sticks', label: 'Sticks' },
              ]}
            />
            <div className="flex items-center gap-1">
              {result && result.poses.length > 1 && (
                <Button size="xs" variant={showAllPoses ? 'primary' : 'ghost'} onClick={() => setShowAllPoses((v) => !v)} icon={<Eye className="h-3.5 w-3.5" />}>
                  All poses
                </Button>
              )}
              {pockets.length > 0 && (
                <Button size="xs" variant={showPocketPoints ? 'primary' : 'ghost'} onClick={() => setShowPocketPoints((v) => !v)}>
                  Pocket
                </Button>
              )}
              <Button size="xs" variant="ghost" onClick={() => setFocusKey(`refit-${Date.now()}`)} icon={<Maximize2 className="h-3.5 w-3.5" />} title="Fit the view" />
              <Button size="xs" variant="ghost" onClick={snapshot} icon={<Camera className="h-3.5 w-3.5" />} title="Save a PNG" />
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            <MolViewer
              ref={viewerRef}
              receptor={target ? { data: target.text, format: target.format } : null}
              receptorStyle={style}
              colorScheme={target?.isPredicted ? 'bfactor' : 'spectrum'}
              showHetero
              ligands={viewerLigands}
              box={target ? box : null}
              points={pocketPoints}
              lines={viewerLines}
              residues={viewerResidues}
              focusKey={focusKey}
              focus={result ? 'ligands' : 'all'}
              placeholder={
                <div className="max-w-xs text-[13px] text-subtle">
                  <p className="font-medium text-muted">Nothing loaded yet</p>
                  <p className="mt-1">Load a target from the PDB — try 1IEP — and the structure appears here.</p>
                </div>
              }
            />
            {running && (
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md border border-line bg-surface/90 px-2.5 py-1.5 text-[11px] font-medium text-muted backdrop-blur">
                <Spinner className="h-3 w-3" />
                Docking · {Math.round(progress * 100)}%
              </div>
            )}
            {target?.isPredicted && (
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-line bg-surface/90 px-2.5 py-1.5 text-[11px] text-subtle backdrop-blur">
                Coloured by pLDDT · blue = confident, red = uncertain
              </div>
            )}
          </div>
        </div>

        {/* ── results ────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-xl border border-line bg-surface xl:h-[calc(100vh-7rem)]">
          <ResultsPanel
            result={result}
            heavyAtoms={ligand?.molecule.atoms.filter((a) => a.el !== 'H').length ?? 0}
            selected={selectedPose}
            onSelect={setSelectedPose}
            interactions={interactions}
            redockRmsd={redockRmsd}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </main>
  );
}
