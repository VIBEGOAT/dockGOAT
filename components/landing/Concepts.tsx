'use client';

import { useState } from 'react';
import { Activity, Atom, BookOpen, ChevronDown, Clock, FlaskConical, Pill } from 'lucide-react';
import { cn } from '@/components/ui/primitives';

const ITEMS = [
  {
    id: 'docking',
    icon: Atom,
    title: 'Molecular docking',
    subtitle: 'Predicting how a small molecule binds its target',
    summary:
      'Docking searches for the position, orientation and conformation of a ligand inside a protein binding site that minimises a scoring function, giving a predicted binding mode and an estimate of affinity.',
    points: [
      'Binding is driven by shape complementarity, hydrogen bonds, hydrophobic contact and, for charged groups, electrostatics.',
      'Most protocols keep the receptor rigid and sample the ligand’s translations, rotations and rotatable bonds — fast enough to screen thousands of compounds.',
      'Docking scores rank poses and compounds well enough to enrich hit lists, but they are approximate: treat absolute affinities with caution and validate experimentally.',
    ],
  },
  {
    id: 'vina',
    icon: FlaskConical,
    title: 'The AutoDock Vina scoring function',
    subtitle: 'Empirical, knowledge-based, heavy-atom',
    summary:
      'Vina scores a pose as a weighted sum of distance-dependent terms between heavy atoms: two attractive Gaussians (steric), a repulsion term, a hydrophobic term and a directional-free hydrogen-bond term, divided by a penalty for ligand flexibility.',
    points: [
      'Search: Monte Carlo sampling with BFGS local optimisation on precomputed grid maps — not the Lamarckian genetic algorithm of AutoDock 4.',
      'Output: predicted binding free energy ΔG in kcal/mol, related to a dissociation constant by ΔG = RT ln K_d (about −1.36 kcal/mol per 10-fold change at 25 °C).',
      'Exhaustiveness controls how many independent Monte Carlo runs are performed; larger, more flexible ligands need more sampling.',
      'Vinardo is a re-parameterised variant with simplified terms that performs better on some benchmarks; both are available here.',
    ],
  },
  {
    id: 'admet',
    icon: Pill,
    title: 'ADMET & drug-likeness',
    subtitle: 'Will a potent binder become a drug?',
    summary:
      'Absorption, distribution, metabolism, excretion and toxicity decide whether a compound can reach its target safely. Early, cheap filters remove molecules that are unlikely to succeed.',
    points: [
      'Rule-based filters such as Lipinski’s Rule of Five, Veber and Egan capture the physicochemical space of orally bioavailable drugs.',
      'The BOILED-Egg model predicts passive gastrointestinal absorption and brain penetration from lipophilicity (WLOGP) and polarity (TPSA).',
      'Structural alerts (PAINS, Brenk, mutagenicity toxicophores) flag substructures associated with assay interference, reactivity or toxicity.',
    ],
  },
  {
    id: 'md',
    icon: Activity,
    title: 'Beyond docking: molecular dynamics',
    subtitle: 'Flexibility, solvation and free energies',
    summary:
      'Molecular dynamics integrates Newton’s equations of motion with a force field (AMBER, CHARMM, OPLS) to simulate how a complex moves over nanoseconds to microseconds.',
    points: [
      'MD captures induced fit, water-mediated contacts and cryptic pockets that rigid-receptor docking misses.',
      'End-point (MM-GBSA/PBSA) and alchemical (FEP) methods refine binding free-energy estimates for the most promising docked poses.',
      'A typical pipeline: virtual screening → docking → ADMET triage → MD and free-energy refinement → synthesis and assay.',
    ],
  },
  {
    id: 'history',
    icon: Clock,
    title: 'A short history',
    subtitle: 'From lock-and-key to learned structure prediction',
    summary: 'Computational docking has evolved for four decades alongside structural biology.',
    points: [
      '1982 — DOCK (Kuntz et al.) introduces shape-based rigid docking with sphere sets.',
      '1998 — AutoDock 3 popularises the Lamarckian genetic algorithm and an empirical free-energy function.',
      '2010 — AutoDock Vina (Trott & Olson) brings a new scoring function and order-of-magnitude speed-ups; Vina 1.2 (2021) adds Vinardo, macrocycles and Python bindings.',
      '2020 — Webina compiles Vina to WebAssembly, making browser-based docking practical.',
      '2021 — AlphaFold2 and AlphaFold DB provide accurate models for most known proteins, opening targets with no experimental structure.',
    ],
  },
  {
    id: 'reading',
    icon: BookOpen,
    title: 'Reading a docking result',
    subtitle: 'What to look at before trusting a pose',
    summary: 'A good pose is chemically sensible, not just low in energy.',
    points: [
      'Check that key interactions known from experiment (e.g. hinge hydrogen bonds in kinases) are reproduced.',
      'Compare top poses: if several low-energy modes are far apart (high RMSD), the binding mode is uncertain.',
      'Use ligand efficiency (−ΔG per heavy atom) to compare compounds of different size; values above ~0.3 kcal/mol/HA are attractive.',
      'Validate your setup by re-docking a co-crystallised ligand: a heavy-atom RMSD below 2 Å is the usual success criterion.',
    ],
  },
];

export default function Concepts() {
  const [open, setOpen] = useState<string | null>('docking');
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {ITEMS.map((item) => {
        const isOpen = open === item.id;
        const Icon = item.icon;
        return (
          <div key={item.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : item.id)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-fg">{item.title}</span>
                <span className="block text-[13px] text-subtle">{item.subtitle}</span>
              </span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-subtle transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="px-5 pb-5 pl-[4.5rem]">
                <p className="text-[14px] leading-relaxed text-muted">{item.summary}</p>
                <ul className="mt-3 space-y-2">
                  {item.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
