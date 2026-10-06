import Link from 'next/link';
import { Brand } from './Brand';
import { GITHUB_URL, NAV } from './nav';

const CREDITS = [
  { label: 'AutoDock Vina 1.2.3', href: 'https://vina.scripps.edu/' },
  { label: 'Webina (WebAssembly)', href: 'https://github.com/durrantlab/webina' },
  { label: 'RDKit', href: 'https://www.rdkit.org/' },
  { label: '3Dmol.js', href: 'https://3dmol.csb.pitt.edu/' },
  { label: 'RCSB PDB', href: 'https://www.rcsb.org/' },
  { label: 'PubChem', href: 'https://pubchem.ncbi.nlm.nih.gov/' },
  { label: 'AlphaFold DB', href: 'https://alphafold.ebi.ac.uk/' },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-3">
          <Brand />
          <p className="max-w-xs text-[13px] leading-relaxed text-subtle">
            An open-source structure-based drug discovery workbench. Every calculation runs locally in your browser —
            your structures never leave your machine.
          </p>
          <p className="text-[13px] text-subtle">
            Created by <span className="font-medium text-muted">Karan Tandon</span>.
          </p>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">Platform</p>
          <ul className="space-y-2 text-[13px]">
            {NAV.filter((n) => n.href !== '/docs').map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-muted hover:text-fg">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">Resources</p>
          <ul className="space-y-2 text-[13px]">
            <li>
              <Link href="/docs" className="text-muted hover:text-fg">
                Documentation
              </Link>
            </li>
            <li>
              <Link href="/docs#methods" className="text-muted hover:text-fg">
                Methods &amp; validation
              </Link>
            </li>
            <li>
              <Link href="/docs#citations" className="text-muted hover:text-fg">
                How to cite
              </Link>
            </li>
            <li>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-fg">
                Source code
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-subtle">Built on</p>
          <ul className="space-y-2 text-[13px]">
            {CREDITS.map((c) => (
              <li key={c.label}>
                <a href={c.href} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-fg">
                  {c.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} dockGOAT. For research and educational use; predictions are not a substitute for experiment.</p>
          <p>Computation happens on your device · No account required</p>
        </div>
      </div>
    </footer>
  );
}
