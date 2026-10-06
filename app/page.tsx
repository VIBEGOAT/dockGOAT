import Link from 'next/link';
import {
  ArrowRight,
  Boxes,
  Cpu,
  Crosshair,
  Database,
  FlaskConical,
  Layers3,
  Lock,
  Microscope,
  Network,
  Pill,
  ScanSearch,
  Sparkles,
  Wrench,
} from 'lucide-react';
import SiteFooter from '@/components/layout/SiteFooter';
import Concepts from '@/components/landing/Concepts';
import HeroViewer from '@/components/landing/HeroViewer';
import {} from '@/components/layout/nav';

const TOOLS = [
  {
    href: '/dock',
    icon: Crosshair,
    title: 'Docking Studio',
    body: 'Dock any ligand into any target with AutoDock Vina 1.2.3 or Vinardo. Automatic receptor and ligand preparation, search-box placement, pose ranking and redocking validation.',
    bullets: ['PDB, AlphaFold DB or your own files', 'SMILES, PubChem names, SDF, MOL2, PDBQT', 'Live progress, reproducible seeds'],
  },
  {
    href: '/screen',
    icon: Layers3,
    title: 'Virtual Screening',
    body: 'Run a ligand library against one target, ranked by affinity and ligand efficiency, with optional drug-likeness pre-filtering.',
    bullets: ['Paste SMILES or upload SDF/CSV', 'ADMET pre-filter before docking', 'Export ranked CSV and pose SDF'],
  },
  {
    href: '/admet',
    icon: Pill,
    title: 'ADMET Profiler',
    body: 'A SwissADME-style profile for single molecules or whole sets: physicochemistry, solubility, BOILED-Egg absorption, drug-likeness rules, QED and structural alerts.',
    bullets: ['Lipinski, Ghose, Veber, Egan, Muegge', 'PAINS, Brenk and toxicophore alerts', 'Bioavailability radar & BOILED-Egg plot'],
  },
  {
    href: '/dock',
    icon: ScanSearch,
    title: 'Binding-site detection',
    body: 'Find druggable cavities on apo structures and AlphaFold models with a LIGSITE-style buriedness search, then dock straight into the pocket you choose.',
    bullets: ['Ranked pockets with volume & buriedness', 'Lining residues for each pocket', 'One click to set the search box'],
  },
  {
    href: '/dock',
    icon: Network,
    title: 'Interaction analysis',
    body: 'Every pose is profiled for hydrogen bonds, hydrophobic contacts, π-stacking, π-cation, salt bridges, halogen bonds and metal coordination using PLIP criteria.',
    bullets: ['3D interaction overlay', 'Per-residue contact table', 'Ligand efficiency & estimated Kd'],
  },
  {
    href: '/viewer',
    icon: Microscope,
    title: 'Structure Explorer',
    body: 'Inspect any structure: cartoons, surfaces and hydrophobicity colouring, entry metadata, sequences, Ramachandran validation and ProtParam statistics.',
    bullets: ['Hover to identify residues', 'Ramachandran (MolProbity regions)', 'High-resolution image export'],
  },
];

const STEPS = [
  { n: '01', title: 'Prepare the target', body: 'Fetch a PDB entry or AlphaFold model, choose chains and cofactors. Waters are stripped, polar hydrogens rebuilt and AutoDock atom types assigned.' },
  { n: '02', title: 'Prepare ligands', body: 'Start from a name, SMILES or file. Experimental 3D conformers are pulled from PubChem when available, otherwise built in-browser, then protonated at pH 7.4.' },
  { n: '03', title: 'Define & dock', body: 'Centre the search box on a co-crystallised ligand or a detected pocket, pick the sampling effort, and run Vina on every core of your machine.' },
  { n: '04', title: 'Analyse & prioritise', body: 'Compare poses, inspect interactions, check ADMET liabilities and export publication-ready files and tables.' },
];

const CITATIONS = [
  { name: 'AutoDock Vina', ref: 'Trott & Olson, J. Comput. Chem. 2010; Eberhardt et al., J. Chem. Inf. Model. 2021' },
  { name: 'Webina', ref: 'Kochnev et al., Bioinformatics 2020' },
  { name: 'RDKit', ref: 'Open-source cheminformatics, rdkit.org' },
  { name: 'BOILED-Egg', ref: 'Daina & Zoete, ChemMedChem 2016' },
  { name: 'QED', ref: 'Bickerton et al., Nat. Chem. 2012' },
  { name: 'PLIP interaction rules', ref: 'Salentin et al., Nucleic Acids Res. 2015' },
  { name: 'LIGSITE pocket detection', ref: 'Hendlich et al., J. Mol. Graph. Model. 1997' },
  { name: '3Dmol.js', ref: 'Rego & Koes, Bioinformatics 2015' },
];

const FAQ = [
  {
    q: 'Is this real AutoDock Vina?',
    a: 'Yes. The docking engine is the AutoDock Vina 1.2.3 C++ code compiled to WebAssembly by the Webina project. It produces the same kind of output as the command-line program, including the multi-model PDBQT file, which you can download.',
  },
  {
    q: 'Are my structures uploaded anywhere?',
    a: 'No. Preparation, docking and analysis all run on your computer. The only network requests are the ones you trigger to fetch public data — PDB entries, AlphaFold models and PubChem compounds.',
  },
  {
    q: 'How long does a docking run take?',
    a: 'It depends on ligand flexibility, box size, exhaustiveness and your CPU. A drug-sized ligand at exhaustiveness 8 typically takes from 20 seconds to a few minutes on a modern laptop; the studio shows live progress and lets you cancel.',
  },
  {
    q: 'Which browsers are supported?',
    a: 'Current versions of Chrome, Edge, Firefox and Safari. Multithreaded WebAssembly requires a cross-origin isolated page, which this site provides.',
  },
  {
    q: 'How accurate are the ADMET predictions?',
    a: 'They are established, published rule-based and empirical models (Lipinski, ESOL, BOILED-Egg, QED, structural alerts). They are useful for triage and prioritisation, not as a replacement for experimental measurement. Every method is documented with its reference.',
  },
  {
    q: 'Can I use the results in a publication?',
    a: 'Yes — please cite AutoDock Vina, Webina, RDKit and the specific methods you rely on. The Docs page lists every method with its citation, and every run records the parameters and random seed needed to reproduce it.',
  },
];

export default function Home() {
  return (
    <>
      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="bg-grid mask-fade-b pointer-events-none absolute inset-0 opacity-70" />
          <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                AutoDock Vina 1.2.3 · RDKit · WebAssembly
              </div>
              <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-fg sm:text-5xl lg:text-[3.5rem]">
                Structure-based drug discovery,
                <span className="block text-accent">running in your browser.</span>
              </h1>
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
                Dock ligands with AutoDock Vina, screen libraries, profile ADMET and drug-likeness, detect binding
                pockets and analyse protein–ligand interactions — in one workbench, with every calculation performed
                locally on your machine.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/dock"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-[15px] font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
                >
                  Start docking <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/admet"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-5 text-[15px] font-medium text-fg shadow-sm transition-colors hover:bg-surface-2"
                >
                  Profile a molecule
                </Link>
              </div>
              <dl className="mt-10 grid max-w-xl grid-cols-3 gap-6 border-t border-line pt-6">
                {[
                  { k: 'Install', v: 'Nothing' },
                  { k: 'Data uploaded', v: '0 bytes' },
                  { k: 'Cost', v: 'Free, open source' },
                ].map((s) => (
                  <div key={s.k}>
                    <dt className="text-xs text-subtle">{s.k}</dt>
                    <dd className="mt-1 text-[15px] font-semibold text-fg">{s.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <HeroViewer />
          </div>
        </section>

        {/* ── Data sources strip ───────────────────────────────────────── */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-10 gap-y-4 px-4 py-6 sm:px-6">
            <p className="text-xs font-medium uppercase tracking-wider text-subtle">Connected to public data</p>
            {[
              ['RCSB Protein Data Bank', 'experimental structures'],
              ['AlphaFold DB', '214M+ predicted models'],
              ['PubChem', 'compounds & 3D conformers'],
              ['Your files', 'PDB · mmCIF · SDF · MOL2 · PDBQT'],
            ].map(([a, b]) => (
              <div key={a} className="text-[13px]">
                <span className="font-semibold text-fg">{a}</span> <span className="text-subtle">— {b}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Tools ────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" id="platform">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-accent">The platform</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Everything from target to triaged hit list</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">
              Six integrated tools share one molecular model, so a structure you load once flows from preparation to
              docking, interaction analysis and ADMET without file juggling.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.title}
                  href={t.href}
                  className="group flex flex-col rounded-xl border border-line bg-surface p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-soft"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-5 text-[17px] font-semibold text-fg">{t.title}</h3>
                  <p className="mt-2 flex-1 text-[14px] leading-relaxed text-muted">{t.body}</p>
                  <ul className="mt-5 space-y-1.5 border-t border-line pt-4">
                    {t.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-[13px] text-subtle">
                        <span className="h-1 w-1 rounded-full bg-accent" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
                    Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── Workflow ─────────────────────────────────────────────────── */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-accent">Workflow</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">A validated pipeline, without the command line</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-muted">
                The same steps a computational chemist runs with MGLTools, Meeko, Open Babel and Vina — automated,
                visual and reproducible.
              </p>
            </div>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="bg-surface p-6">
                  <span className="font-mono text-xs font-medium text-accent">{s.n}</span>
                  <h3 className="mt-3 text-[16px] font-semibold text-fg">{s.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Architecture / privacy ───────────────────────────────────── */}
        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-accent">Architecture</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Your computer is the compute cluster</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-muted">
              dockGOAT ships scientific engines as WebAssembly and runs them in your browser’s sandbox. There is no job
              queue, no server to go down and nothing proprietary to upload.
            </p>
            <div className="mt-8 space-y-5">
              {[
                { icon: Cpu, t: 'Multithreaded Vina', d: 'Vina’s Monte Carlo search runs on parallel WebAssembly threads backed by SharedArrayBuffer.' },
                { icon: Lock, t: 'Private by design', d: 'Proprietary targets and compound libraries stay on your device. Results are stored only in your browser.' },
                { icon: Database, t: 'Reproducible', d: 'Every run records the engine version, parameters, box and random seed; outputs download as standard PDBQT, SDF, PDB and CSV.' },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-fg">
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-fg">{t}</p>
                    <p className="mt-1 text-[14px] leading-relaxed text-muted">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Scientific foundations</p>
            <ul className="mt-4 divide-y divide-line">
              {CITATIONS.map((c) => (
                <li key={c.name} className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <span className="text-[14px] font-medium text-fg">{c.name}</span>
                  <span className="text-[13px] text-subtle sm:text-right">{c.ref}</span>
                </li>
              ))}
            </ul>
            <Link href="/docs#citations" className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
              Methods &amp; full references <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* ── Concepts ─────────────────────────────────────────────────── */}
        <section className="border-t border-line bg-surface/60" id="concepts">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
            <div>
              <p className="text-sm font-semibold text-accent">Learn</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">The science behind the tools</h2>
              <p className="mt-4 text-[16px] leading-relaxed text-muted">
                A concise primer on docking, scoring, ADMET and where molecular dynamics fits — written for students and
                practitioners alike.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { icon: Boxes, t: 'Scoring functions' },
                  { icon: FlaskConical, t: 'Drug-likeness' },
                  { icon: Wrench, t: 'Best practice' },
                ].map(({ icon: Icon, t }) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-xs text-muted">
                    <Icon className="h-3.5 w-3.5" /> {t}
                  </span>
                ))}
              </div>
            </div>
            <Concepts />
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6" id="faq">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-fg">Frequently asked questions</h2>
          <div className="mt-10 divide-y divide-line rounded-xl border border-line bg-surface">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-medium text-fg">
                  {f.q}
                  <span className="text-subtle transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-sm sm:px-12">
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" />
            <div className="pointer-events-none absolute -bottom-32 left-1/2 h-72 w-[700px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl" />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
                Dock your first ligand in about a minute.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
                No account, no installation and no upload. Load a target from the PDB, draw or paste a ligand, and run
                a real AutoDock Vina calculation on your own machine.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/dock"
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-6 text-[15px] font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
                >
                  Open the Docking Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-6 text-[15px] font-medium text-fg transition-colors hover:bg-surface-2"
                >
                  Read the documentation
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
