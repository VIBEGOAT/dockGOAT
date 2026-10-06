import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/layout/SiteFooter';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'How dockGOAT works: docking workflow, methods, validation results, limitations and how to cite the underlying software.',
};

const TOC = [
  ['quickstart', 'Quick start'],
  ['workflow', 'The docking workflow'],
  ['methods', 'Methods'],
  ['validation', 'Validation'],
  ['limitations', 'Limitations'],
  ['privacy', 'Privacy & browser support'],
  ['citations', 'How to cite'],
] as const;

const VALIDATION: [string, string, string][] = [
  ['Redocking imatinib into Abl kinase (PDB 1IEP)', '0.36 Å heavy-atom RMSD, −13.3 kcal/mol', 'Success criterion is < 2 Å'],
  ['Binding-site detection (1HSG, 3PTB, 1STP, 1IEP)', 'Ligand inside a top-3 pocket in 4 of 4', 'Each in under 300 ms'],
  ['Interactions: trypsin–benzamidine, streptavidin–biotin, HIV protease–indinavir', 'Asp189 contact, ≥ 4 of 8 known biotin hydrogen bonds, catalytic Asp contacts', 'Against well-documented complexes'],
  ['TPSA vs PubChem (caffeine, theophylline, uracil, coumarin, 2-pyridone)', 'All five within 0.06 Å²', 'Ertl aromaticity convention'],
  ['QED vs RDKit (aspirin, caffeine, ibuprofen)', 'Within ±0.01', 'Reimplements RDKit QED.py'],
  ['ProtParam vs ExPASy (8 proteins, 19 fragments)', 'MW, pI, formula, ε, instability, GRAVY all match', 'Biopython doctests also pass'],
  ['Ramachandran (ubiquitin 1UBQ, crambin 1CRN)', '100% and 98% favoured, 0 outliers', 'MolProbity Top8000 regions'],
  ['3D conformer generation (21-molecule panel)', 'Bond lengths ≤ 0.08 Å off, all stereocentres and E/Z preserved', 'Includes cholesterol (8 stereocentres)'],
];

const CITES = [
  ['AutoDock Vina', 'Trott O, Olson AJ. AutoDock Vina: improving the speed and accuracy of docking with a new scoring function, efficient optimization, and multithreading. J Comput Chem 2010;31:455–461.'],
  ['AutoDock Vina 1.2', 'Eberhardt J, Santos-Martins D, Tillack AF, Forli S. AutoDock Vina 1.2.0: new docking methods, expanded force field, and Python bindings. J Chem Inf Model 2021;61:3891–3898.'],
  ['Webina', 'Kochnev Y, Hellemann E, Cassidy KC, Durrant JD. Webina: an open-source library and a web app that runs AutoDock Vina entirely in the web browser. Bioinformatics 2020;36:4513–4515.'],
  ['Vinardo', 'Quiroga R, Villarreal MA. Vinardo: a scoring function based on AutoDock Vina improves scoring, docking, and virtual screening. PLoS ONE 2016;11:e0155183.'],
  ['RDKit', 'RDKit: open-source cheminformatics. https://www.rdkit.org'],
  ['3Dmol.js', 'Rego N, Koes D. 3Dmol.js: molecular visualization with WebGL. Bioinformatics 2015;31:1322–1324.'],
  ['BOILED-Egg', 'Daina A, Zoete V. A BOILED-Egg to predict gastrointestinal absorption and brain penetration of small molecules. ChemMedChem 2016;11:1117–1121.'],
  ['SwissADME radar and rules', 'Daina A, Michielin O, Zoete V. SwissADME: a free web tool to evaluate pharmacokinetics, drug-likeness and medicinal chemistry friendliness of small molecules. Sci Rep 2017;7:42717.'],
  ['QED', 'Bickerton GR, Paolini GV, Besnard J, Muresan S, Hopkins AL. Quantifying the chemical beauty of drugs. Nat Chem 2012;4:90–98.'],
  ['ESOL', 'Delaney JS. ESOL: estimating aqueous solubility directly from molecular structure. J Chem Inf Comput Sci 2004;44:1000–1005.'],
  ['Rule of five', 'Lipinski CA, Lombardo F, Dominy BW, Feeney PJ. Experimental and computational approaches to estimate solubility and permeability in drug discovery and development settings. Adv Drug Deliv Rev 2001;46:3–26.'],
  ['PAINS', 'Baell JB, Holloway GA. New substructure filters for removal of pan assay interference compounds (PAINS) from screening libraries. J Med Chem 2010;53:2719–2740.'],
  ['PLIP thresholds', 'Salentin S, Schreiber S, Haupt VJ, Adasme MF, Schroeder M. PLIP: fully automated protein–ligand interaction profiler. Nucleic Acids Res 2015;43:W443–W447.'],
  ['ProtParam', 'Gasteiger E, et al. Protein identification and analysis tools on the ExPASy server. In: The Proteomics Protocols Handbook. Humana Press; 2005:571–607.'],
  ['Ramachandran regions', 'Williams CJ, et al. MolProbity: more and better reference data for improved all-atom structure validation. Protein Sci 2018;27:293–315.'],
  ['AlphaFold DB', 'Varadi M, et al. AlphaFold Protein Structure Database in 2024. Nucleic Acids Res 2024;52:D368–D375.'],
];

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 border-b border-line pb-2 text-xl font-semibold tracking-tight text-fg">
      {children}
    </h2>
  );
}
const P = ({ children }: { children: React.ReactNode }) => <p className="text-[14.5px] leading-relaxed text-muted">{children}</p>;
const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-fg">{children}</code>;

export default function DocsPage() {
  return (
    <>
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-20 space-y-1 text-[13px]">
            <li className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">On this page</li>
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-fg">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 space-y-12">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-fg">Documentation</h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">
              What dockGOAT does, how each calculation works, how it was checked, and where its limits are.
            </p>
          </header>

          <section className="space-y-4">
            <H2 id="quickstart">Quick start</H2>
            <ol className="list-decimal space-y-2 pl-5 text-[14.5px] leading-relaxed text-muted marker:text-subtle">
              <li>Open the <Link href="/dock" className="text-accent underline">Docking Studio</Link> and enter a PDB ID such as <Code>1IEP</Code>.</li>
              <li>Choose <b>Bound</b> in the ligand panel and pick the co-crystallised ligand. The search box centres on it automatically.</li>
              <li>Press <b>Run docking</b>. This redocks the ligand into its own structure, which is the standard way to validate a setup.</li>
              <li>The result shows the redock RMSD, every binding mode with affinity, and the interactions each pose makes. Download poses as SDF.</li>
            </ol>
            <P>
              To dock something new, type a SMILES string or a compound name instead. Use <b>Detect pockets</b> when you do not know where the binding site is.
            </P>
          </section>

          <section className="space-y-4">
            <H2 id="workflow">The docking workflow</H2>
            <P>Everything below happens in your browser, in this order.</P>
            <div className="space-y-3">
              {[
                ['Receptor preparation', 'Waters and unselected hetero groups are removed, the chosen chains are kept, selenomethionine is converted to methionine, and polar hydrogens are rebuilt from residue templates so Vina can identify hydrogen-bond donors. Atoms receive AutoDock 4 types (C, A, N, NA, OA, SA, HD, metals). Vina scores heavy atoms only and ignores partial charges, so non-polar hydrogens are not added.'],
                ['Ligand preparation', 'A 3D conformer is generated (or the supplied coordinates are kept), Gasteiger charges are assigned, non-polar hydrogens are merged into their carbons, and rotatable bonds are found. Amide C–N bonds stay rigid. A torsion tree is rooted at the most central rigid fragment and written as PDBQT.'],
                ['Search box', 'Vina only searches inside a rectangular box. It can be centred on a bound ligand, on a detected pocket, or typed by hand. Boxes are limited to 8–40 Å per side.'],
                ['Docking', 'AutoDock Vina 1.2.3, compiled to multithreaded WebAssembly, runs Monte Carlo sampling with BFGS local optimisation. Exhaustiveness sets the number of independent runs; the random seed is recorded so a run can be reproduced.'],
                ['Analysis', 'Each pose is converted back to a molecule and its protein–ligand interactions are profiled with PLIP-style geometric criteria. When the ligand came from the structure itself, a symmetry-corrected RMSD to the crystal pose is reported.'],
              ].map(([t, b], i) => (
                <div key={t} className="flex gap-3 rounded-lg border border-line bg-surface p-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{i + 1}</span>
                  <div>
                    <p className="text-[14px] font-semibold text-fg">{t}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{b}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <H2 id="methods">Methods</H2>
            <h3 className="text-base font-semibold text-fg">Scoring and interpretation</h3>
            <P>
              Vina reports a predicted binding free energy ΔG in kcal/mol. dockGOAT converts it to an estimated dissociation constant with <Code>Kd = exp(ΔG / RT)</Code> at 298.15 K, and to ligand efficiency, <Code>−ΔG / heavy atoms</Code>. Treat these as ranking aids: Vina&apos;s average error against experiment is roughly 2 kcal/mol, which is a factor of about 30 in Kd.
            </P>
            <h3 className="text-base font-semibold text-fg">Binding-site detection</h3>
            <P>
              Pockets are found on a 1 Å grid with a LIGSITE-style protein–solvent–protein scan along seven directions (the three axes and four cube diagonals). Points enclosed in at least five directions are clustered, scored by size and buriedness, and returned with a suggested search box.
            </P>
            <h3 className="text-base font-semibold text-fg">Interaction profiling</h3>
            <P>
              Hydrogen bonds, hydrophobic contacts, π-stacking, π–cation interactions, salt bridges, halogen bonds and metal coordination are detected with the distance and angle thresholds of PLIP. Water-mediated bridges are not modelled.
            </P>
            <h3 className="text-base font-semibold text-fg">ADMET and drug-likeness</h3>
            <P>
              All values come from published methods computed with RDKit: Wildman–Crippen logP (WLOGP), ESOL solubility, the BOILED-Egg absorption and brain-penetration model, the Lipinski, Ghose, Veber, Egan and Muegge filters, Abbott bioavailability, lead-likeness, QED, PAINS and Brenk alerts, and Kazius mutagenicity toxicophores. Topological polar surface area follows Ertl&apos;s original aromaticity convention, which is what PubChem and SwissADME report. We deliberately do <b>not</b> offer machine-learning predictions of CYP inhibition, P-gp substrate status or LD50; those need trained models whose accuracy we could not stand behind.
            </P>
            <P>
              Where SwissADME uses a different logP (MLOGP or XLOGP3), we use WLOGP and say so next to the result.
            </P>
          </section>

          <section className="space-y-4">
            <H2 id="validation">Validation</H2>
            <P>The scientific components are covered by an automated test suite that runs against real structures and published reference values. These are the main checks.</P>
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-2 text-[11px] uppercase tracking-wide text-subtle">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Check</th>
                    <th className="px-4 py-2 text-left font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {VALIDATION.map(([a, b, c]) => (
                    <tr key={a} className="border-t border-line align-top">
                      <td className="px-4 py-2.5 text-fg">{a}<span className="block text-[12px] text-subtle">{c}</span></td>
                      <td className="px-4 py-2.5 text-muted">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4">
            <H2 id="limitations">Limitations</H2>
            <ul className="list-disc space-y-2 pl-5 text-[14.5px] leading-relaxed text-muted marker:text-subtle">
              <li><b>Rigid receptor.</b> Side chains and backbone do not move. Induced fit and cryptic pockets are missed.</li>
              <li><b>Scores are estimates.</b> They rank compounds usefully but are not substitutes for measured affinities. Always inspect poses.</li>
              <li><b>Waters are removed</b> and not modelled, so water-mediated contacts are absent.</li>
              <li><b>Unsupported chemistry.</b> Covalent ligands, boron-containing and organometallic compounds, and most unusual elements are not handled. Metal ions in the receptor are limited to Zn, Fe, Mg, Ca and Mn.</li>
              <li><b>Charge states.</b> Ligands are docked as drawn; there is no automatic pH-dependent protonation. Histidines default to the ε tautomer.</li>
              <li><b>Speed.</b> A single docking run typically takes from under a minute to a few minutes, depending on ligand flexibility, box size, exhaustiveness and your CPU. Browser screening is limited to 200 compounds a run.</li>
              <li><b>Predicted structures</b> from AlphaFold carry no ligand and uncertain side chains; check the pLDDT colouring.</li>
              <li><b>Not for clinical use.</b> dockGOAT is a research and teaching tool.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <H2 id="privacy">Privacy &amp; browser support</H2>
            <P>
              Docking, preparation, ADMET and analysis all run on your device. Your uploaded files are read locally and never sent anywhere. The only network requests are fetches you trigger yourself: structures from RCSB PDB and AlphaFold DB, and compound names and identifiers from PubChem.
            </P>
            <P>
              Multithreaded WebAssembly needs a cross-origin-isolated page, which dockGOAT provides. Use a current Chrome, Edge, Firefox or Safari. Keep the tab in the foreground during long runs: browsers throttle hidden tabs, which can make a run several times slower.
            </P>
          </section>

          <section className="space-y-4">
            <H2 id="citations">How to cite</H2>
            <P>Please cite the methods you rely on. dockGOAT builds on the following work.</P>
            <ul className="space-y-3">
              {CITES.map(([k, v]) => (
                <li key={k} className="rounded-lg border border-line bg-surface px-4 py-3">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-subtle">{k}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{v}</p>
                </li>
              ))}
            </ul>
            <P>
              The WebAssembly build of AutoDock Vina is Webina (Apache-2.0); AutoDock Vina is Apache-2.0; RDKit is BSD-3-Clause; 3Dmol.js is BSD-3-Clause.
            </P>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
