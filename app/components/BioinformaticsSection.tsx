'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Atom, Activity, Clock, BookOpen, Wrench } from 'lucide-react';

interface AccordionItem {
  id: string;
  icon: React.ElementType;
  label: string;
  title: string;
  subtitle: string;
  color: string;
  iconBg: string;
  content: {
    summary: string;
    points: string[];
  };
}

const items: AccordionItem[] = [
  {
    id: 'docking',
    icon: Atom,
    label: 'Core Method',
    title: 'Molecular Docking',
    subtitle: 'Proteinâ€“ligand binding & structure-based drug design',
    color: 'from-blue-500/10 to-blue-600/5',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    content: {
      summary:
        'Molecular docking computationally predicts the preferred orientation of a small molecule (ligand) when bound to a macromolecular target (receptor), enabling estimation of binding affinity and guiding rational drug design.',
      points: [
        'Proteinâ€“ligand interactions are governed by shape complementarity, hydrogen bonding, hydrophobic contacts, and electrostatic forces â€” all evaluated by a scoring function.',
        'AutoDock Vina uses an empirical scoring function combining a Gaussian steric term, repulsion, hydrophobic, and hydrogen-bond terms calibrated against experimentally determined affinities.',
        'Semi-flexible docking keeps the receptor rigid while sampling the ligand\'s rotatable bonds, balancing accuracy with computational speed for high-throughput virtual screening.',
        'The predicted binding free energy (Î”G, kcal/mol) correlates with Káµ¢ via Î”G = RT ln Káµ¢, giving a direct handle on potency ranking across compound libraries.',
        'Structure-based drug design (SBDD) iterates docking â†’ hit identification â†’ lead optimisation â†’ ADMET filtering to accelerate the pre-clinical pipeline.',
      ],
    },
  },
  {
    id: 'dynamics',
    icon: Activity,
    label: 'Simulation',
    title: 'Molecular Dynamics',
    subtitle: 'Atomistic simulation with force fields over time',
    color: 'from-violet-500/10 to-violet-600/5',
    iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    content: {
      summary:
        'Molecular dynamics (MD) simulates the physical motion of atoms and molecules by numerically integrating Newton\'s equations of motion, using empirical force fields to describe inter-atomic potentials.',
      points: [
        'Force fields (AMBER, CHARMM, GROMOS) parameterise bonded terms (bonds, angles, dihedrals) and non-bonded terms (van der Waals via Lennard-Jones, electrostatics via Coulomb) to describe the potential energy surface.',
        'The simulation timestep is typically 1â€“2 fs; production runs for pharmaceutically relevant proteins span hundreds of nanoseconds to microseconds on modern GPU clusters.',
        'MD captures receptor flexibility, induced-fit effects, and solvation dynamics that static docking misses â€” particularly important for cryptic allosteric sites.',
        'Enhanced-sampling methods (replica exchange, metadynamics, steered MD) overcome energy barriers to access rare conformational states on tractable timescales.',
        'Post-MD analyses include RMSD/RMSF for stability, MM-GBSA/MM-PBSA for binding free-energy refinement, and principal component analysis of collective motions.',
      ],
    },
  },
  {
    id: 'history',
    icon: Clock,
    label: 'Timeline',
    title: 'History & Evolution',
    subtitle: 'From rigid-body docking to AI-driven structure prediction',
    color: 'from-amber-500/10 to-amber-600/5',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    content: {
      summary:
        'Computational docking has evolved over five decades from simple geometric lock-and-key models to deep-learning methods that predict protein structure and binding from sequence alone.',
      points: [
        '1980s â€” DOCK (Kuntz et al., UCSF) pioneered shape-based rigid docking using sphere sets to fill receptor cavities; laid the conceptual foundation for all modern docking programs.',
        '1990s â€” AutoDock 1â€“3 introduced Lamarckian genetic algorithms and the first widely-used free-energy scoring function; flexible side-chain treatment emerged.',
        '2000s â€” AutoDock Vina (Trott & Olson, 2010) achieved order-of-magnitude speed-ups via iterated local search and gradient optimisation; Glide and GOLD brought commercial-grade accuracy.',
        '2010s â€” Fragment-based docking, covalent docking, and proteinâ€“protein interface prediction matured; GPU-accelerated MD (GROMACS, NAMD, OpenMM) democratised microsecond simulations.',
        '2020s â€” AlphaFold2 and RoseTTAFold solved the protein-folding problem, providing high-accuracy apo structures for previously undruggable targets; diffusion models (DiffDock, RFdiffusion) began generating docking poses and novel binders end-to-end.',
      ],
    },
  },
  {
    id: 'concepts',
    icon: BookOpen,
    label: 'Theory',
    title: 'Core Concepts',
    subtitle: 'Thermodynamics, conformational space & scoring',
    color: 'from-emerald-500/10 to-emerald-600/5',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    content: {
      summary:
        'Successful docking rests on a handful of physical chemistry principles that connect atomic coordinates to measurable thermodynamic quantities governing binding.',
      points: [
        'Binding free energy Î”G = Î”H âˆ’ TÎ”S: enthalpic contributions (electrostatics, H-bonds, vdW) must overcome the entropic cost of restraining ligand conformational and translational degrees of freedom.',
        'Conformational sampling searches the high-dimensional space of ligand pose (6 rigid-body DOF) and rotatable bonds (up to ~15 DOF for drug-like molecules); heuristic algorithms (GA, MC, tabu search) balance coverage with cost.',
        'Scoring functions fall into three classes: force-field-based (physics), empirical (trained on Káµ¢ data), and knowledge-based (statistical potentials from PDB contacts) â€” each with distinct accuracyâ€“speed trade-offs.',
        'The "docking problem" is distinct from the "scoring problem": a program may find the correct pose but rank it poorly, or vice versa; benchmarks like CASF-2016 measure both independently.',
        'Induced fit and conformational selection mean receptor plasticity matters: ensemble docking across multiple receptor conformations (from MD or crystallography) improves hit rates for flexible targets.',
      ],
    },
  },
  {
    id: 'tools',
    icon: Wrench,
    label: 'Tooling',
    title: 'Industry Tools',
    subtitle: 'Standard software across the computational pipeline',
    color: 'from-rose-500/10 to-rose-600/5',
    iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    content: {
      summary:
        'The computational drug-discovery pipeline relies on a well-established ecosystem of open-source and commercial tools, each addressing a distinct stage from structure preparation to result visualisation.',
      points: [
        'AutoDock Vina â€” open-source, fast empirical docking engine used in this platform; accepts PDBQT input; outputs ranked poses with estimated Î”G values.',
        'GROMACS & NAMD â€” high-performance MD engines optimised for CPU/GPU clusters; GROMACS dominates in biomolecular simulation throughput benchmarks.',
        'PyMOL & UCSF Chimera/ChimeraX â€” molecular visualisation suites for inspecting binding poses, generating publication figures, and computing surface representations.',
        'SchrÃ¶dinger Suite (Glide, Prime, FEP+) â€” industry-standard commercial platform integrating docking, protein prep, induced-fit docking, and alchemical free-energy perturbation.',
        'RDKit & Open Babel â€” open-source cheminformatics libraries for ligand preparation, format conversion (SDF â†’ PDBQT), descriptor calculation, and ADMET filtering.',
        'AlphaFold2 / ColabFold â€” deep-learning structure prediction for generating receptor models when experimental structures are unavailable.',
      ],
    },
  },
];

function AccordionCard({ item, isOpen, onToggle }: {
  item: AccordionItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;

  return (
    <motion.div
      layout
      className={`
        relative overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08]
        bg-white dark:bg-[#141414]
        shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.04)]
        dark:shadow-[0_1px_3px_rgba(0,0,0,0.3),0_4px_16px_rgba(0,0,0,0.2)]
        transition-shadow duration-300
        ${isOpen ? 'shadow-[0_2px_8px_rgba(0,0,0,0.07),0_12px_32px_rgba(0,0,0,0.07)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.5),0_12px_32px_rgba(0,0,0,0.4)]' : ''}
      `}
    >
      {/* Subtle gradient tint on open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`absolute inset-0 bg-gradient-to-br ${item.color} pointer-events-none`}
          />
        )}
      </AnimatePresence>

      {/* Header â€” always visible */}
      <button
        onClick={onToggle}
        className="relative w-full flex items-center gap-4 px-6 py-5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-2xl"
        aria-expanded={isOpen}
      >
        {/* Icon */}
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${item.iconBg} transition-transform duration-300 group-hover:scale-105`}>
          <Icon className="w-5 h-5" strokeWidth={1.8} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#6e6e73] dark:text-[#6e6e73] mb-0.5">
            {item.label}
          </p>
          <h3 className="text-base font-semibold text-[#1d1d1f] dark:text-white leading-snug">
            {item.title}
          </h3>
          <p className="text-sm text-[#6e6e73] dark:text-[#a1a1a6] mt-0.5 truncate">
            {item.subtitle}
          </p>
        </div>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.06] flex items-center justify-center"
        >
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" strokeWidth={2} />
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
              opacity: { duration: 0.3, ease: 'easeOut' },
            }}
            className="overflow-hidden"
          >
            <div className="relative px-6 pb-6">
              {/* Divider */}
              <div className="w-full h-px bg-black/[0.05] dark:bg-white/[0.07] mb-5" />

              {/* Summary paragraph */}
              <p className="text-[15px] text-[#3a3a3c] dark:text-[#d1d1d6] leading-relaxed mb-5">
                {item.content.summary}
              </p>

              {/* Bullet points */}
              <ul className="space-y-3">
                {item.content.points.map((point, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3, ease: 'easeOut' }}
                    className="flex items-start gap-3"
                  >
                    <span className={`flex-shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full ${item.iconBg}`} />
                    <span className="text-sm text-[#3a3a3c] dark:text-[#a1a1a6] leading-relaxed">
                      {point}
                    </span>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function BioinformaticsSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => setOpenId(prev => (prev === id ? null : id));

  return (
    <section
      id="concepts"
      className="relative py-28 px-4 sm:px-6 lg:px-8"
    >
      <div className="max-w-3xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 mb-6">
            <Atom className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 tracking-wide uppercase">
              Computational Biology
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#1d1d1f] dark:text-white tracking-tight leading-tight mb-4">
            Bioinformatics
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
              Concepts
            </span>
          </h2>
          <p className="text-lg text-[#6e6e73] dark:text-[#a1a1a6] max-w-xl mx-auto leading-relaxed">
            The theoretical foundations powering every simulation on this platform.
            Click any card to explore the science.
          </p>
        </motion.div>

        {/* Accordion list */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08 } },
          }}
          className="space-y-3"
        >
          {items.map((item) => (
            <motion.div
              key={item.id}
              variants={{
                hidden: { opacity: 0, y: 16 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] } },
              }}
            >
              <AccordionCard
                item={item}
                isOpen={openId === item.id}
                onToggle={() => toggle(item.id)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

