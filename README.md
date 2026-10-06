# dockGOAT

**Structure-based drug discovery in your browser.** Dock ligands with AutoDock Vina, screen compound libraries, profile ADMET and drug-likeness, find binding pockets, analyse protein–ligand interactions and inspect structures in 3D — with every calculation running on your own machine. No account, no installation, no uploads.

| Page | What it does |
| --- | --- |
| **Docking Studio** `/dock` | Load a target (PDB, AlphaFold DB or file), supply a ligand (SMILES, PubChem name, SDF/MOL2, or the structure's own bound ligand), place the search box, run Vina, inspect poses and interactions, export SDF/CSV/PDBQT. Redocking reports an RMSD to the crystal pose. |
| **Virtual screening** `/screen` | Dock a library against one target with an optional Lipinski pre-filter, ranked by affinity or ligand efficiency. |
| **ADMET** `/admet` | Physicochemical properties, ESOL solubility, BOILED-Egg absorption/BBB, Lipinski/Ghose/Veber/Egan/Muegge, QED, bioavailability radar, PAINS/Brenk and toxicity alerts. Single molecule or batch. |
| **Viewer** `/viewer` | 3D structure viewer with ProtParam sequence statistics and a Ramachandran plot. |
| **Toolkit** `/tools` | Molecule identifiers and 3D export, ΔG ↔ Kd converter, protein sequence analysis, Vina-ready PDBQT preparation. |
| **Docs** `/docs` | Methods, validation results, limitations and citations. |

## How it works

* **Docking** — [AutoDock Vina 1.2.3](https://vina.scripps.edu/) compiled to multithreaded WebAssembly by [Webina](https://github.com/durrantlab/webina) (Apache-2.0), vendored in `public/vina/`. Multithreading needs `SharedArrayBuffer`, so every route is served with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (see `next.config.ts`).
* **Cheminformatics** — [RDKit MinimalLib](https://github.com/rdkit/rdkit) (WebAssembly), copied from `node_modules` into `public/rdkit/` by `scripts/copy-vendor.mjs` before `dev` and `build`.
* **3D** — [3Dmol.js](https://3dmol.csb.pitt.edu/).
* **External data** (fetched only when you ask): RCSB PDB, AlphaFold DB, PubChem.

RDKit.js has no 3D embedding, so `lib/chem/conformer.ts` is a pure-TypeScript 3D builder (force-field minimisation with chirality and E/Z restraints). `lib/chem/hydrogens.ts` adds hydrogens to an existing 3D structure without moving its heavy atoms, which is what keeps crystal poses intact for redocking.

## Layout

```
app/                 routes (Next.js App Router)
components/          UI: dock/, screen/, admet/, viewer/, tools/, landing/, layout/, ui/
lib/chem/            molecule model, parsers, RDKit bridge, 3D builder, hydrogens
lib/docking/         receptor + ligand preparation, Vina wrapper, pockets, interactions, poses
lib/admet/           property, filter, QED, ESOL, BOILED-Egg, alert engines
lib/bio/             ProtParam, Ramachandran, sequence helpers
lib/services/        PubChem and RCSB/AlphaFold clients
lib/workbench/       turning user input into docking-ready files
public/vina/         Webina WebAssembly build (+ license)
tests/               unit and integration tests against real structures
```

## Development

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm test           # serial: some tests assert interactive-speed budgets
npm run build
```

`npm test` runs the suite with `--test-concurrency=1`. The ADMET batch and conformer-panel tests assert timing budgets and fail spuriously when run in parallel with other CPU-heavy suites.

## Validation

Checked against real structures and published values (details on the Docs page): redocking imatinib into Abl kinase (1IEP) gives 0.36 Å RMSD; pocket detection finds the ligand site in 1HSG, 3PTB, 1STP and 1IEP; TPSA matches PubChem; QED matches RDKit; ProtParam matches ExPASy; Ramachandran regions follow MolProbity.

## Limitations

Rigid receptor, no explicit waters, no covalent or organometallic ligands, no automatic protonation-state assignment, and Vina scores are estimates (typical error ~2 kcal/mol). Keep the tab in the foreground during long runs; browsers throttle hidden tabs. See `/docs#limitations`.

## Deployment

A standard Next.js app; deploys to Vercel with no environment variables. The only requirement is that the COOP/COEP headers in `next.config.ts` are served on every route. Everything else is static assets.

## Licences

dockGOAT's own code is released under the repository's licence. Bundled third-party components: AutoDock Vina and Webina (Apache-2.0, see `public/vina/LICENSE-Webina.md`), RDKit (BSD-3-Clause), 3Dmol.js (BSD-3-Clause). The dipeptide instability table in `lib/bio/protparam.ts` is from Biopython (BSD-3-Clause), and the Ramachandran region grids from the MolProbity Top8000 data (CC BY 4.0), with attribution in those files.
