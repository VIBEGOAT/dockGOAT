'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Dna, Download, FileCog, Pill } from 'lucide-react';
import MoleculeDepiction from '@/components/viewer/MoleculeDepiction';
import { Badge, Button, Callout, Card, CardHeader, Field, NumberInput, Segmented, Stat, Textarea } from '@/components/ui/primitives';
import { protParam } from '@/lib/bio/protparam';
import { cleanSequence, parseFasta } from '@/lib/bio/sequence';
import { writeSDF, writeMolfile } from '@/lib/chem/molfile';
import { molecularFormula } from '@/lib/chem/molecule';
import { parsePDB } from '@/lib/chem/pdb';
import { getRDKit, parseSmiles } from '@/lib/chem/rdkit';
import { prepareReceptor } from '@/lib/docking/receptor';
import { prepareLigandForDocking, loadLigand } from '@/lib/workbench/inputs';

type Tool = 'molecule' | 'energy' | 'protein' | 'pdbqt';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── Molecule identifiers & 3D export ───────────────────────────────────── */

function MoleculeTool() {
  const [smiles, setSmiles] = useState('CC(=O)Oc1ccccc1C(=O)O');
  const [info, setInfo] = useState<{ canonical: string; inchi: string; inchiKey: string; formula: string; sdf: string; mol2d: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const rd = await getRDKit();
      const p = parseSmiles(rd, smiles);
      const lig = await loadLigand({ kind: 'smiles', smiles, name: 'molecule' });
      setInfo({
        canonical: p.canonical,
        inchi: p.inchi,
        inchiKey: p.inchikey,
        formula: molecularFormula(lig.molecule),
        sdf: writeSDF([lig.molecule]),
        mol2d: writeMolfile(p.withH.mol),
      });
    } catch (e) {
      setInfo(null);
      setError(e instanceof Error ? e.message : 'Could not parse this structure');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <Field label="SMILES" htmlFor="tool-smiles">
          <Textarea id="tool-smiles" rows={3} value={smiles} onChange={(e) => setSmiles(e.target.value)} spellCheck={false} />
        </Field>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={run} loading={busy} disabled={!smiles.trim()}>Analyse</Button>
        </div>
        {error && <Callout tone="danger" className="mt-3">{error}</Callout>}
        <p className="mt-3 text-[12px] text-subtle">Gives canonical SMILES, InChI and InChIKey, formula, a 2D drawing and a generated 3D conformer you can download.</p>
      </Card>
      <Card>
        <CardHeader title="Result" />
        {info ? (
          <div className="space-y-3 p-4">
            <div className="h-44 overflow-hidden rounded-lg border border-line"><MoleculeDepiction smiles={info.canonical} width={560} height={300} /></div>
            {([['Canonical SMILES', info.canonical], ['InChIKey', info.inchiKey], ['InChI', info.inchi], ['Formula', info.formula]] as const).map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">{k}</p>
                <p className="break-all font-mono text-[12px] text-fg">{v}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => download('molecule_3d.sdf', info.sdf)}>3D SDF</Button>
              <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => download('molecule_2d.mol', info.mol2d)}>2D MOL</Button>
            </div>
          </div>
        ) : <p className="p-6 text-center text-[13px] text-subtle">Enter a SMILES string and press Analyse.</p>}
      </Card>
    </div>
  );
}

/* ── Binding-energy converter ───────────────────────────────────────────── */

const R_KCAL = 0.0019872036;

function fmtMolar(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '—';
  const u: [number, string][] = [[1, 'M'], [1e-3, 'mM'], [1e-6, 'µM'], [1e-9, 'nM'], [1e-12, 'pM']];
  for (const [f, s] of u) if (m >= f) return `${(m / f).toPrecision(3)} ${s}`;
  return `${(m / 1e-12).toPrecision(3)} pM`;
}

function EnergyTool() {
  const [from, setFrom] = useState<'dg' | 'kd'>('dg');
  const [dg, setDg] = useState(-9.5);
  const [kdNm, setKdNm] = useState(100);
  const [temp, setTemp] = useState(25);
  const [heavy, setHeavy] = useState(30);
  const [logp, setLogp] = useState(3);

  const RT = R_KCAL * (temp + 273.15);
  const dgv = from === 'dg' ? dg : RT * Math.log(kdNm * 1e-9);
  const kd = Math.exp(dgv / RT);
  const pKd = -Math.log10(kd);
  const le = heavy > 0 ? -dgv / heavy : NaN;
  const lle = pKd - logp;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-4">
        <Segmented size="sm" value={from} onChange={setFrom} options={[{ value: 'dg', label: 'From ΔG' }, { value: 'kd', label: 'From Kd' }]} />
        {from === 'dg' ? (
          <Field label="Binding free energy ΔG (kcal/mol)"><NumberInput value={dg} onChange={setDg} step={0.1} unit="kcal" /></Field>
        ) : (
          <Field label="Dissociation constant Kd (nM)"><NumberInput value={kdNm} onChange={(v) => v > 0 && setKdNm(v)} step={10} unit="nM" /></Field>
        )}
        <Field label="Temperature (°C)"><NumberInput value={temp} onChange={setTemp} step={1} unit="°C" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heavy atoms"><NumberInput value={heavy} onChange={(v) => setHeavy(Math.round(v))} /></Field>
          <Field label="cLogP"><NumberInput value={logp} onChange={setLogp} step={0.1} /></Field>
        </div>
        <p className="text-[12px] text-subtle">Uses ΔG = RT ln Kd. A tenfold change in Kd is worth RT ln 10 ≈ {(RT * Math.LN10).toFixed(2)} kcal/mol at this temperature.</p>
      </Card>
      <div className="grid grid-cols-2 gap-3 self-start">
        <Stat label="ΔG" value={dgv.toFixed(2)} unit="kcal/mol" />
        <Stat label="Kd" value={fmtMolar(kd)} />
        <Stat label="pKd" value={pKd.toFixed(2)} />
        <Stat label="ΔG" value={(dgv * 4.184).toFixed(1)} unit="kJ/mol" />
        <Stat label="Ligand efficiency" value={Number.isFinite(le) ? le.toFixed(3) : '—'} unit="kcal/mol/HA" tone={le >= 0.3 ? 'success' : le < 0.2 ? 'warning' : undefined} hint="≥ 0.3 is attractive" />
        <Stat label="LLE" value={lle.toFixed(2)} hint="pKd − cLogP; ≥ 5 is good" tone={lle >= 5 ? 'success' : undefined} />
      </div>
    </div>
  );
}

/* ── Protein sequence analysis ──────────────────────────────────────────── */

const UBQ = '>ubiquitin\nMQIFVKTLTGKTITLEVEPSDTIENVKAKIQDKEGIPPDQQRLIFAGKQLEDGRTLSDYNIQKESTLHLVLRLRGG';

function ProteinTool() {
  const [text, setText] = useState(UBQ);
  const records = useMemo(() => {
    const fasta = parseFasta(text);
    return fasta.length ? fasta : text.trim() ? [{ id: 'sequence', description: '', sequence: cleanSequence(text) }] : [];
  }, [text]);
  const [which, setWhich] = useState(0);
  const rec = records[Math.min(which, records.length - 1)];
  const p = useMemo(() => (rec?.sequence ? protParam(rec.sequence) : null), [rec]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Card className="p-4">
        <Field label="Protein sequence (FASTA or plain letters)">
          <Textarea rows={9} value={text} onChange={(e) => { setText(e.target.value); setWhich(0); }} spellCheck={false} />
        </Field>
        {records.length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {records.map((r, i) => <button key={i} type="button" onClick={() => setWhich(i)} className={`rounded-md border px-2 py-1 text-[11px] font-medium ${i === which ? 'border-accent-line bg-accent-soft text-accent' : 'border-line bg-surface text-subtle'}`}>{r.id}</button>)}
          </div>
        )}
      </Card>
      {p ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Length" value={p.length} unit="aa" />
            <Stat label="Mol. weight" value={p.molecularWeight.toFixed(1)} unit="Da" />
            <Stat label="Theoretical pI" value={p.pI.toFixed(2)} />
            <Stat label="Instability" value={p.instabilityIndex.toFixed(1)} tone={p.stable ? 'success' : 'warning'} hint={p.stable ? 'Stable (< 40)' : 'Unstable (≥ 40)'} />
            <Stat label="Aliphatic index" value={p.aliphaticIndex.toFixed(1)} />
            <Stat label="GRAVY" value={p.gravy.toFixed(3)} />
            <Stat label="Charge, pH 7.4" value={p.chargeAtPH74.toFixed(1)} />
            <Stat label="ε₂₈₀ (cystines)" value={p.extinction.cystines.toLocaleString()} />
            <Stat label="Abs 0.1%" value={p.extinction.abs01Cystines.toFixed(3)} />
          </div>
          <Card className="p-3 text-[12.5px]">
            <p><span className="text-subtle">Formula </span><span className="font-mono">{p.formula}</span> <span className="text-subtle">({p.totalAtoms.toLocaleString()} atoms)</span></p>
            {p.halfLife && <p className="mt-1 text-muted">Half-life (N-end rule): <b>{p.halfLife.mammalian}</b> mammalian · {p.halfLife.yeast} yeast · {p.halfLife.ecoli} <i>E. coli</i></p>}
            {p.warnings.map((w) => <p key={w} className="mt-1 text-warning">{w}</p>)}
          </Card>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[12px]">
              <thead className="bg-surface-2 text-[10.5px] uppercase text-subtle"><tr><th className="px-2 py-1 text-left">Residue</th><th className="px-2 py-1 text-right">Count</th><th className="px-2 py-1 text-right">%</th></tr></thead>
              <tbody className="grid max-h-48 grid-cols-2 overflow-y-auto">
                {p.composition.filter((c) => c.count > 0).map((c) => (
                  <tr key={c.letter} className="flex justify-between border-b border-line px-2 py-0.5"><td className="text-muted">{c.letter} {c.name}</td><td className="tabular text-subtle">{c.count} · {c.percent.toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-subtle">Method: ExPASy ProtParam (Gasteiger et al., 2005); instability index from Guruprasad et al. (1990).</p>
        </div>
      ) : <Card className="p-6 text-center text-[13px] text-subtle">Paste a sequence to analyse.</Card>}
    </div>
  );
}

/* ── PDBQT preparation ──────────────────────────────────────────────────── */

function PdbqtTool() {
  const [mode, setMode] = useState<'ligand' | 'receptor'>('ligand');
  const [smiles, setSmiles] = useState('Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1');
  const [out, setOut] = useState<{ name: string; text: string; notes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const makeLigand = async () => {
    setBusy(true); setError(null);
    try {
      const lig = await loadLigand({ kind: 'smiles', smiles, name: 'ligand' });
      const prep = prepareLigandForDocking(lig);
      setOut({ name: 'ligand.pdbqt', text: prep.pdbqt, notes: [`${prep.heavyAtoms} heavy atoms`, `${prep.torsions.length} rotatable bonds`, ...prep.warnings, ...lig.warnings] });
    } catch (e) { setOut(null); setError(e instanceof Error ? e.message : 'Preparation failed'); } finally { setBusy(false); }
  };

  const makeReceptor = async (file: File) => {
    setBusy(true); setError(null);
    try {
      const s = parsePDB(await file.text(), file.name);
      if (!s.atoms.length) throw new Error('No atoms found in this file.');
      const r = prepareReceptor(s);
      setOut({ name: file.name.replace(/\.[^.]+$/, '') + '_receptor.pdbqt', text: r.pdbqt, notes: [`${r.stats.residues} residues`, `${r.stats.polarHydrogens} polar hydrogens added`, `${r.stats.removedWaters} waters removed`, ...r.stats.warnings] });
    } catch (e) { setOut(null); setError(e instanceof Error ? e.message : 'Preparation failed'); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-3 p-4">
        <Segmented size="sm" value={mode} onChange={(m) => { setMode(m); setOut(null); setError(null); }} options={[{ value: 'ligand', label: 'Ligand from SMILES' }, { value: 'receptor', label: 'Receptor from PDB file' }]} />
        {mode === 'ligand' ? (
          <>
            <Field label="SMILES"><Textarea rows={3} value={smiles} onChange={(e) => setSmiles(e.target.value)} spellCheck={false} /></Field>
            <Button variant="primary" onClick={makeLigand} loading={busy} disabled={!smiles.trim()}>Generate PDBQT</Button>
          </>
        ) : (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-line-strong p-8 text-center text-[13px] text-muted hover:bg-surface-2">
            <FileCog className="h-6 w-6 text-subtle" />
            Choose a .pdb file
            <input type="file" accept=".pdb,.ent" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) makeReceptor(f); e.target.value = ''; }} />
          </label>
        )}
        {error && <Callout tone="danger">{error}</Callout>}
        <p className="text-[12px] text-subtle">Produces files ready for the AutoDock Vina command line or any other Vina front end: Gasteiger charges, AutoDock atom types, polar hydrogens and a torsion tree (ligands).</p>
      </Card>
      <Card>
        <CardHeader title={out?.name ?? 'Output'} actions={out && <Button size="xs" variant="secondary" icon={<Download className="h-3.5 w-3.5" />} onClick={() => download(out.name, out.text)}>Download</Button>} />
        {out ? (
          <div className="p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">{out.notes.map((n) => <Badge key={n}>{n}</Badge>)}</div>
            <pre className="scroll-thin max-h-80 overflow-auto rounded-md border border-line bg-surface-2 p-2 font-mono text-[11px] leading-snug text-muted">{out.text.split('\n').slice(0, 60).join('\n')}{out.text.split('\n').length > 60 ? '\n…' : ''}</pre>
          </div>
        ) : <p className="p-6 text-center text-[13px] text-subtle">Nothing generated yet.</p>}
      </Card>
    </div>
  );
}

const TOOLS: { id: Tool; label: string; icon: React.ReactNode; blurb: string }[] = [
  { id: 'molecule', label: 'Molecule identifiers', icon: <Pill className="h-4 w-4" />, blurb: 'SMILES → canonical form, InChI, formula, drawing and 3D SDF' },
  { id: 'energy', label: 'Binding energy', icon: <ArrowLeftRight className="h-4 w-4" />, blurb: 'ΔG ↔ Kd ↔ pKd, ligand efficiency and LLE' },
  { id: 'protein', label: 'Protein sequence', icon: <Dna className="h-4 w-4" />, blurb: 'ProtParam: MW, pI, instability, extinction, half-life' },
  { id: 'pdbqt', label: 'PDBQT preparation', icon: <FileCog className="h-4 w-4" />, blurb: 'Vina-ready ligand and receptor files' },
];

export default function ToolsWorkbench() {
  const [tool, setTool] = useState<Tool>('molecule');
  return (
    <main className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Toolkit</h1>
      <p className="mt-1 max-w-2xl text-[14px] text-muted">Small, focused utilities for everyday drug-discovery bookkeeping. All of them run locally.</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTool(t.id)} className={`rounded-xl border p-3.5 text-left transition-colors ${tool === t.id ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'}`}>
            <span className={`flex items-center gap-2 text-[13.5px] font-semibold ${tool === t.id ? 'text-accent' : 'text-fg'}`}>{t.icon}{t.label}</span>
            <span className="mt-1 block text-[12px] leading-snug text-subtle">{t.blurb}</span>
          </button>
        ))}
      </div>
      <div className="mt-5">
        {tool === 'molecule' && <MoleculeTool />}
        {tool === 'energy' && <EnergyTool />}
        {tool === 'protein' && <ProteinTool />}
        {tool === 'pdbqt' && <PdbqtTool />}
      </div>
    </main>
  );
}
