'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileUp, FlaskConical, XCircle } from 'lucide-react';
import { BoiledEggChart, RadarChart } from './Charts';
import MoleculeDepiction from '@/components/viewer/MoleculeDepiction';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, SectionLabel, Segmented, Spinner, Stat, Textarea, cn } from '@/components/ui/primitives';
import { profileMany, profilesToCSV } from '@/lib/admet';
import type { AdmetProfile, ProfileError, RuleResult } from '@/lib/admet/types';
import { getRDKit } from '@/lib/chem/rdkit';

const EXAMPLE = `CC(=O)Oc1ccccc1C(=O)O aspirin
Cn1cnc2c1c(=O)n(C)c(=O)n2C caffeine
CC(C)Cc1ccc(cc1)C(C)C(=O)O ibuprofen
Cc1ccc(NC(=O)c2ccc(CN3CCN(C)CC3)cc2)cc1Nc1nccc(-c2cccnc2)n1 imatinib
CC(C)c1c(C(=O)Nc2ccccc2)c(-c2ccccc2)c(-c2ccc(F)cc2)n1CC[C@@H](O)C[C@@H](O)CC(=O)O atorvastatin`;

type Row = AdmetProfile | ProfileError;
const isError = (r: Row): r is ProfileError => 'error' in r;

function parseInput(text: string): { smiles: string; name?: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [smiles, ...rest] = l.split(/[\s,\t]+/);
      return { smiles, name: rest.join(' ') || undefined };
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

function RuleCard({ rule }: { rule: RuleResult }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-fg">{rule.name}</p>
        {rule.pass ? (
          <Badge tone="success">
            <CheckCircle2 className="h-3 w-3" /> Pass
          </Badge>
        ) : (
          <Badge tone="danger">
            <XCircle className="h-3 w-3" /> {rule.violations} violation{rule.violations === 1 ? '' : 's'}
          </Badge>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        {rule.criteria.map((c) => (
          <li key={c.label} className="flex items-center justify-between text-[12px]">
            <span className={c.pass ? 'text-muted' : 'text-danger'}>{c.label}</span>
            <span className="tabular text-subtle">
              {Number.isInteger(c.value) ? c.value : c.value.toFixed(2)} <span className="opacity-70">({c.range})</span>
            </span>
          </li>
        ))}
      </ul>
      {rule.note && <p className="mt-2 text-[11px] leading-snug text-subtle">{rule.note}</p>}
      <p className="mt-1.5 text-[10.5px] text-subtle/80">{rule.reference}</p>
    </div>
  );
}

function Row2({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-[13px] last:border-0" title={hint}>
      <span className="text-muted">{k}</span>
      <span className="tabular text-right font-medium text-fg">{v}</span>
    </div>
  );
}

function Report({ p, all, index }: { p: AdmetProfile; all: AdmetProfile[]; index: number }) {
  const ph = p.physicochemical;
  const sol = p.solubility;
  const pk = p.pharmacokinetics;
  const dl = p.drugLikeness;
  const alerts = [...p.medChemAlerts.pains, ...p.medChemAlerts.brenk];
  const tox = [...p.toxicityAlerts.ames, ...p.toxicityAlerts.reactive];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-44 w-full shrink-0 overflow-hidden rounded-xl border border-line bg-surface sm:w-60">
          <MoleculeDepiction smiles={p.identity.canonicalSmiles} width={480} height={352} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-fg">{p.identity.name}</h2>
          <p className="mt-1 break-all font-mono text-[12px] text-subtle">{p.identity.canonicalSmiles}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge>{p.identity.formula}</Badge>
            <Badge>{ph.mw.toFixed(2)} g/mol</Badge>
            {p.identity.inchiKey && <Badge className="font-mono">{p.identity.inchiKey}</Badge>}
          </div>
          {p.flags.length > 0 && (
            <ul className="mt-3 space-y-1">
              {p.flags.map((f, i) => (
                <li key={i} className={cn('flex items-start gap-1.5 text-[13px]', f.severity === 'alert' ? 'text-danger' : f.severity === 'warn' ? 'text-warning' : 'text-muted')}>
                  {f.severity === 'info' ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  {f.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="QED" value={p.qed.score.toFixed(2)} hint="Drug-likeness, 0–1" tone={p.qed.score >= 0.67 ? 'success' : p.qed.score < 0.35 ? 'danger' : undefined} />
        <Stat label="log S (ESOL)" value={sol.logS.toFixed(2)} hint={sol.class} />
        <Stat label="GI absorption" value={pk.gastrointestinalAbsorption} tone={pk.gastrointestinalAbsorption === 'High' ? 'success' : 'warning'} />
        <Stat label="BBB permeant" value={pk.bbbPermeant ? 'Yes' : 'No'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Bioavailability radar" description="Inside the shaded band on all six axes = drug-like" />
          <div className="p-3">
            <RadarChart axes={p.radar} />
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {p.radar.map((a) => (
                <li key={a.key} className="flex items-center justify-between text-[12px]" title={`${a.property}, optimal ${a.optimal[0]} to ${a.optimal[1]} ${a.unit}`}>
                  <span className={a.inRange ? 'text-muted' : 'text-danger'}>{a.label}</span>
                  <span className="tabular text-subtle">
                    {a.value.toFixed(a.key === 'INSATU' || a.key === 'INSOLU' ? 2 : 1)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="BOILED-Egg" description="Passive absorption (white) and brain penetration (yolk)" />
          <div className="p-3">
            <BoiledEggChart profiles={all} highlight={index} />
            <p className="mt-1 text-[11px] leading-snug text-subtle">{pk.reference}. Uses WLOGP and TPSA including S and P.</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Physicochemical" />
          <div className="px-4 py-2">
            <Row2 k="Molecular weight" v={`${ph.mw.toFixed(2)} g/mol`} />
            <Row2 k="Heavy atoms" v={ph.heavyAtoms} />
            <Row2 k="Aromatic heavy atoms" v={ph.aromaticHeavyAtoms} />
            <Row2 k="Fraction Csp3" v={ph.fractionCsp3.toFixed(2)} />
            <Row2 k="Rotatable bonds" v={ph.rotatableBonds} />
            <Row2 k="H-bond acceptors" v={ph.hbaLipinski} hint="N + O count (Lipinski)" />
            <Row2 k="H-bond donors" v={ph.hbdLipinski} hint="NH + OH count (Lipinski)" />
            <Row2 k="Molar refractivity" v={ph.molarRefractivity.toFixed(2)} />
            <Row2 k="TPSA" v={`${ph.tpsa.toFixed(2)} Å²`} />
            <Row2 k="Stereocentres" v={`${ph.stereocentres}${ph.unspecifiedStereocentres ? ` (${ph.unspecifiedStereocentres} unspecified)` : ''}`} />
            <Row2 k="Rings (aromatic)" v={`${ph.rings} (${ph.aromaticRings})`} />
            <Row2 k="Formal charge" v={ph.formalCharge > 0 ? `+${ph.formalCharge}` : ph.formalCharge} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Lipophilicity & solubility" />
          <div className="px-4 py-2">
            <Row2 k="WLOGP" v={p.lipophilicity.wlogp.toFixed(2)} hint={p.lipophilicity.reference} />
            <Row2 k="log S (ESOL)" v={sol.logS.toFixed(2)} />
            <Row2 k="Solubility" v={`${sol.mgPerMl < 0.001 ? sol.mgPerMl.toExponential(2) : sol.mgPerMl.toPrecision(3)} mg/mL`} />
            <Row2 k="Solubility (mol/L)" v={sol.molPerL.toExponential(2)} />
            <Row2 k="Class" v={sol.class} />
            <Row2 k="Abbott bioavailability" v={dl.bioavailability.score.toFixed(2)} hint={dl.bioavailability.basis} />
          </div>
          <p className="border-t border-line px-4 py-2 text-[11px] leading-snug text-subtle">
            {sol.reference}. {p.lipophilicity.method}.
          </p>
        </Card>
        <Card>
          <CardHeader title="QED components" description={`Weighted QED ${p.qed.score.toFixed(3)}`} />
          <div className="space-y-2 px-4 py-3">
            {(Object.keys(p.qed.properties) as (keyof typeof p.qed.properties)[]).map((k) => (
              <div key={k}>
                <div className="flex justify-between text-[12px]">
                  <span className="text-muted">{k}</span>
                  <span className="tabular text-subtle">
                    {Number(p.qed.properties[k]).toFixed(k === 'MW' || k === 'PSA' || k === 'ALOGP' ? 1 : 0)}
                  </span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(p.qed.desirability[k] * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <SectionLabel className="mb-2">Drug-likeness filters</SectionLabel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...dl.rules, dl.leadLikeness].map((r) => (
            <RuleCard key={r.name} rule={r} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Medicinal chemistry alerts" description={`${p.medChemAlerts.painsCount} PAINS · ${p.medChemAlerts.brenkCount} Brenk`} />
          <div className="p-3">
            {alerts.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[13px] text-success">
                <CheckCircle2 className="h-4 w-4" /> No PAINS or Brenk structural alerts.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {alerts.map((a) => (
                  <li key={`${a.family}${a.name}`} className="flex items-center justify-between gap-2 rounded-md bg-warning-soft px-2.5 py-1.5 text-[12.5px]">
                    <span className="font-medium text-warning">{a.name}</span>
                    <Badge tone="warning">{a.family}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Toxicity structural alerts" description="Substructure flags, not predictions" />
          <div className="space-y-2 p-3">
            {tox.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[13px] text-success">
                <CheckCircle2 className="h-4 w-4" /> No mutagenicity or reactivity alerts.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {tox.map((a) => (
                  <li key={a.name} className="rounded-md bg-danger-soft px-2.5 py-1.5" title={a.reference}>
                    <p className="text-[12.5px] font-medium text-danger">{a.name}</p>
                    <p className="text-[11.5px] leading-snug text-muted">{a.description}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between rounded-md border border-line px-2.5 py-1.5 text-[12.5px]" title={p.toxicityAlerts.herg.reference}>
              <span className="text-muted">hERG liability heuristic</span>
              <Badge tone={p.toxicityAlerts.herg.risk === 'High' ? 'danger' : p.toxicityAlerts.herg.risk === 'Moderate' ? 'warning' : 'success'}>{p.toxicityAlerts.herg.risk}</Badge>
            </div>
            <p className="text-[11px] leading-snug text-subtle">{p.toxicityAlerts.herg.rationale}</p>
            <p className="text-[11px] leading-snug text-subtle">{p.toxicityAlerts.disclaimer}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AdmetWorkbench() {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getRDKit().then(() => setReady(true)).catch(() => setError('The cheminformatics engine failed to load.'));
    // Share a molecule through the URL, e.g. /admet?smiles=CCO
    const q = new URLSearchParams(window.location.search).get('smiles');
    if (q) setText(q);
  }, []);

  const run = useCallback(async (input: string) => {
    const items = parseInput(input);
    if (!items.length) return setError('Enter at least one SMILES string.');
    if (items.length > 2000) return setError('Please keep batches to 2,000 molecules or fewer.');
    setBusy(true);
    setError(null);
    try {
      const rd = await getRDKit();
      // Yield so the spinner paints before the synchronous batch starts.
      await new Promise((r) => setTimeout(r, 20));
      const out = profileMany(rd, items) as Row[];
      setRows(out);
      setSelected(Math.max(0, out.findIndex((r) => !isError(r))));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Profiling failed');
    } finally {
      setBusy(false);
    }
  }, []);

  const profiles = useMemo(() => rows.filter((r): r is AdmetProfile => !isError(r)), [rows]);
  const errors = rows.filter(isError);
  const current = rows[selected] && !isError(rows[selected]) ? (rows[selected] as AdmetProfile) : null;
  const currentIndex = current ? profiles.indexOf(current) : 0;

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-fg">ADMET &amp; drug-likeness</h1>
        <p className="mt-1 max-w-3xl text-[14px] text-muted">
          Profile one molecule or a whole library: physicochemical properties, lipophilicity, solubility, gastrointestinal
          absorption and BBB permeation, Lipinski/Ghose/Veber/Egan/Muegge filters, QED, PAINS and Brenk alerts, and
          toxicity structural alerts. Every method is published and cited; nothing is uploaded.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Card className="p-4">
            <SectionLabel className="mb-2">Molecules · one SMILES per line, optional name after it</SectionLabel>
            <Textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'CC(=O)Oc1ccccc1C(=O)O aspirin'}
              spellCheck={false}
              aria-label="SMILES input"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => run(text)} loading={busy} disabled={!ready || !text.trim()} icon={<FlaskConical className="h-4 w-4" />}>
                Profile
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setText(EXAMPLE);
                  run(EXAMPLE);
                }}
                disabled={!ready}
              >
                Try examples
              </Button>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium text-fg shadow-sm hover:bg-surface-2">
                <FileUp className="h-4 w-4" />
                File
                <input
                  type="file"
                  accept=".smi,.smiles,.txt,.csv"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const t = await f.text();
                    setText(t);
                    run(t);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {!ready && !error && (
              <p className="mt-2 flex items-center gap-2 text-[12px] text-subtle">
                <Spinner /> Loading the chemistry engine…
              </p>
            )}
          </Card>
          {error && <Callout tone="danger">{error}</Callout>}
          {errors.length > 0 && (
            <Callout tone="warning" title={`${errors.length} structure${errors.length === 1 ? '' : 's'} could not be parsed`}>
              <ul className="mt-1 list-inside list-disc break-all text-[12px]">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={i}>
                    {e.name ?? e.smiles}: {e.error}
                  </li>
                ))}
              </ul>
            </Callout>
          )}

          {profiles.length > 0 && (
            <Card>
              <CardHeader
                title={`Results (${profiles.length})`}
                actions={
                  <Button size="xs" variant="ghost" icon={<Download className="h-3.5 w-3.5" />} onClick={() => download('dockgoat-admet.csv', profilesToCSV(profiles), 'text/csv')}>
                    CSV
                  </Button>
                }
              />
              <div className="scroll-thin max-h-[480px] overflow-y-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 bg-surface-2 text-[10.5px] uppercase tracking-wide text-subtle">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Molecule</th>
                      <th className="px-2 py-1.5 text-right font-medium">MW</th>
                      <th className="px-2 py-1.5 text-right font-medium">QED</th>
                      <th className="px-2 py-1.5 text-center font-medium">Ro5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) =>
                      isError(r) ? null : (
                        <tr key={i} onClick={() => setSelected(i)} className={cn('cursor-pointer border-b border-line last:border-0', i === selected ? 'bg-accent-soft' : 'hover:bg-surface-2')}>
                          <td className="max-w-[140px] truncate px-3 py-1.5 font-medium text-fg" title={r.identity.name}>
                            {r.identity.name}
                          </td>
                          <td className="tabular px-2 py-1.5 text-right text-subtle">{r.physicochemical.mw.toFixed(0)}</td>
                          <td className="tabular px-2 py-1.5 text-right text-subtle">{r.qed.score.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-center">
                            {r.drugLikeness.rules[0]?.pass ? <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-success" /> : <XCircle className="mx-auto h-3.5 w-3.5 text-danger" />}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div className="min-w-0">
          {current ? (
            <Report p={current} all={profiles} index={currentIndex} />
          ) : (
            <Card>
              <EmptyState icon={<FlaskConical className="h-5 w-5" />} title="Paste a structure to begin">
                Enter SMILES on the left — a single molecule or a library — and press Profile. Try the examples to see a
                drug-like compound next to one that breaks the rule of five.
              </EmptyState>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
