'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Header from './components/Header';
import JobForm from './components/JobForm';
import JobList from './components/JobList';
import { Atom, BookOpen, GitBranch, Microscope, Cpu, TrendingUp, ChevronDown } from 'lucide-react';

export default function App() {
  const [jobListRefresh, setJobListRefresh] = useState<string>('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleJobSubmitted = (jobId: string) => {
    setJobListRefresh(jobId);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <main className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-gray-100">
      <Header />

      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="border-b border-indigo-900/30 py-16 md:py-24 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 relative overflow-hidden"
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-indigo-400/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.5, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center space-y-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="inline-block"
            >
              <div className="flex items-center gap-3 px-5 py-2 bg-indigo-500/10 backdrop-blur-sm rounded-lg border border-indigo-500/30 mb-6 shadow-lg shadow-indigo-500/10">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <Atom className="w-5 h-5 text-indigo-400" />
                </motion.div>
                <span className="text-sm font-mono text-indigo-300 tracking-wider">COMPUTATIONAL STRUCTURAL BIOLOGY</span>
              </div>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 tracking-tight leading-tight"
            >
              Molecular Docking Pipeline
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed"
            >
              High-throughput virtual screening platform for structure-based drug design utilizing AutoDock Vina's empirical scoring function and Lamarckian genetic algorithm
            </motion.p>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex items-center justify-center gap-4 text-sm text-gray-400 font-mono pt-4"
            >
              <span className="flex items-center gap-2">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 bg-emerald-500 rounded-full"
                />
                AutoDock Vina 1.2.5
              </span>
              <span>•</span>
              <span>PDBQT Format</span>
              <span>•</span>
              <span>Flexible Docking</span>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* About Section - Karan Tandon */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="py-12 border-b border-indigo-900/30 bg-slate-950/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="bg-gradient-to-br from-slate-800/80 to-indigo-950/50 rounded-xl border border-indigo-500/20 p-8 shadow-lg shadow-indigo-500/5"
          >
            <div className="flex items-start gap-4">
              <motion.div 
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/30"
              >
                <Microscope className="w-6 h-6 text-indigo-400" />
              </motion.div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-indigo-300 mb-3">Platform Architecture</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Developed by <span className="text-indigo-300 font-semibold">Karan Tandon</span>, Lead Computational Researcher specializing in structural bioinformatics, molecular docking methodologies, and high-throughput virtual screening workflows. This platform integrates established computational chemistry protocols with modern cloud infrastructure to enable reproducible, scalable structure-based drug discovery research.
                </p>
                <p className="text-gray-400 text-sm italic">
                  Expertise: Protein-ligand binding affinity prediction • Virtual screening • Molecular dynamics • Cheminformatics • Structural biology
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Docking Workstation */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="py-12"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-bold text-indigo-300 mb-2">Virtual Screening Workstation</h2>
            <p className="text-gray-400">Configure docking parameters and submit computational jobs to the processing queue</p>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, type: "spring" }}
              className="lg:col-span-1"
            >
              <JobForm onJobSubmitted={handleJobSubmitted} />
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4, type: "spring" }}
              className="lg:col-span-2"
            >
              <JobList refreshTrigger={jobListRefresh} />
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Scientific Content Sections */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="py-16 bg-slate-950/50 border-y border-indigo-900/30"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 mb-4">
              Computational Drug Discovery Framework
            </h2>
            <p className="text-gray-300 max-w-3xl mx-auto">
              A comprehensive overview of structure-based drug design methodologies, from target identification to molecular dynamics simulations
            </p>
          </motion.div>

          {/* Target Identification */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="mb-4"
          >
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => toggleSection('target')}
              className="w-full bg-gradient-to-r from-slate-800 to-indigo-950/50 border border-indigo-500/20 rounded-lg p-6 hover:border-indigo-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <motion.div 
                    animate={{ rotate: expandedSection === 'target' ? 360 : 0 }}
                    transition={{ duration: 0.5 }}
                    className="p-3 bg-indigo-500/10 rounded-lg"
                  >
                    <Microscope className="w-6 h-6 text-indigo-400" />
                  </motion.div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-indigo-300">Target Identification & Validation</h3>
                    <p className="text-gray-300 text-sm mt-1">Structural target selection and binding site characterization</p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: expandedSection === 'target' ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="w-5 h-5 text-indigo-400" />
                </motion.div>
              </div>
            </motion.button>
            {expandedSection === 'target' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 bg-slate-800/50 border border-indigo-500/10 rounded-lg p-8 space-y-4"
              >
                <p className="text-gray-300 leading-relaxed">
                  Target identification represents the critical first step in structure-based drug design. The process begins with proteomic and genomic profiling to identify disease-relevant biomolecules, followed by structural characterization using X-ray crystallography (resolution &lt;2.5 Å preferred), cryo-electron microscopy (cryo-EM), or NMR spectroscopy.
                </p>
                <div className="bg-slate-900/80 p-6 rounded-lg border border-indigo-500/20">
                  <h4 className="text-lg font-semibold text-indigo-300 mb-3">Binding Pocket Detection Algorithms</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-3">
                      <span className="text-indigo-400 mt-1">→</span>
                      <span><strong className="text-gray-200">LIGSITE/SURFNET:</strong> Geometric algorithms identifying surface pockets using molecular surface calculations and alpha shapes</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-indigo-400 mt-1">→</span>
                      <span><strong className="text-gray-200">FPocket:</strong> Voronoi tessellation-based detection with druggability scoring (α-spheres method)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-indigo-400 mt-1">→</span>
                      <span><strong className="text-gray-200">SiteMap (Schrödinger):</strong> Physics-based characterization calculating hydrophobic/hydrophilic properties</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-indigo-400 mt-1">→</span>
                      <span><strong className="text-gray-200">CASTp:</strong> Computational geometry approach for pocket volume and area calculations</span>
                    </li>
                  </ul>
                </div>
                <p className="text-gray-300 leading-relaxed">
                  Homology modeling (via MODELLER, SWISS-MODEL) is employed when experimental structures are unavailable, utilizing sequence alignment to templates with &gt;30% identity. Active site residues are identified through conservation analysis, known inhibitor co-crystal structures, and site-directed mutagenesis data.
                </p>
              </motion.div>
            )}
          </motion.div>

          {/* Molecular Docking */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection('docking')}
              className="w-full bg-gradient-to-r from-slate-800 to-blue-950/50 border border-cyan-500/20 rounded-lg p-6 hover:border-cyan-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-lg">
                    <Atom className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-emerald-300">Molecular Docking Mechanics</h3>
                    <p className="text-gray-400 text-sm mt-1">Search algorithms and scoring function methodologies</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-emerald-400 transition-transform ${expandedSection === 'docking' ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {expandedSection === 'docking' && (
              <div className="mt-4 bg-slate-800/50 border border-emerald-500/10 rounded-lg p-8 space-y-6">
                <div>
                  <h4 className="text-xl font-semibold text-emerald-300 mb-4">Docking Paradigms</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/80 p-4 rounded-lg border border-emerald-500/20">
                      <h5 className="font-bold text-emerald-300 mb-2">Rigid Docking</h5>
                      <p className="text-gray-400 text-sm">Both ligand and receptor treated as rigid bodies. Fast but less accurate. Used in initial HTVS campaigns.</p>
                    </div>
                    <div className="bg-slate-900/80 p-4 rounded-lg border border-emerald-500/20">
                      <h5 className="font-bold text-emerald-300 mb-2">Semi-Flexible</h5>
                      <p className="text-gray-400 text-sm">Ligand flexible, receptor rigid. Standard approach in AutoDock Vina. Balances accuracy and speed.</p>
                    </div>
                    <div className="bg-slate-900/80 p-4 rounded-lg border border-emerald-500/20">
                      <h5 className="font-bold text-emerald-300 mb-2">Flexible Docking</h5>
                      <p className="text-gray-400 text-sm">Both flexible. Computationally expensive. Used for induced-fit modeling and allosteric sites.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-6 rounded-lg border border-emerald-500/20">
                  <h4 className="text-lg font-semibold text-emerald-300 mb-4">Search Algorithms</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-200 mb-2">Lamarckian Genetic Algorithm (LGA)</h5>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Hybrid approach combining genetic algorithms with local search. Populations of ligand conformations undergo selection, crossover, and mutation. Local Solis-Wets minimization improves elite solutions. AutoDock's primary method (Morris et al., 1998).
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-200 mb-2">Monte Carlo / Simulated Annealing</h5>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Stochastic sampling with Metropolis criterion. Temperature schedule controls exploration vs. exploitation. Effective for conformational space exploration in programs like ICM and GOLD.
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-200 mb-2">Gradient-Based Optimization</h5>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Conjugate gradient or quasi-Newton methods for local minimization. Fast convergence but requires good starting geometry. Combined with global methods in Glide (Schrödinger).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-6 rounded-lg border border-emerald-500/20">
                  <h4 className="text-lg font-semibold text-emerald-300 mb-4">Scoring Functions</h4>
                  <div className="space-y-3">
                    <div>
                      <h5 className="font-semibold text-gray-200">Force-Field Based</h5>
                      <p className="text-gray-400 text-sm font-mono bg-slate-900/50 p-2 rounded mt-1">
                        ΔG = ΔG_vdW + ΔG_elec + ΔG_hbond + ΔG_desolv + ΔG_tors
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        Molecular mechanics potentials (AMBER, CHARMM). Computationally expensive but physically grounded. Used in DOCK, AutoDock.
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-200">Empirical Scoring</h5>
                      <p className="text-gray-400 text-sm font-mono bg-slate-900/50 p-2 rounded mt-1">
                        ΔG = Σ_i (W_i * ΔG_i) where i ∈ (vdW, H-bond, metal, hydrophobic)
                      </p>
                      <p className="text-gray-400 text-sm mt-2">
                        Weighted sum trained on experimental binding data. Fast evaluation. AutoDock Vina uses hybrid empirical approach with knowledge-based components.
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-200">Knowledge-Based</h5>
                      <p className="text-gray-400 text-sm mt-2">
                        Statistical potentials derived from PDB analysis. Distance-dependent pairwise atom preferences. Examples: PMF (Muegge & Martin), DrugScore.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Molecular Dynamics */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection('md')}
              className="w-full bg-gradient-to-r from-slate-800 to-blue-950/50 border border-cyan-500/20 rounded-lg p-6 hover:border-cyan-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Cpu className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-blue-300">Molecular Dynamics Simulations</h3>
                    <p className="text-gray-400 text-sm mt-1">Force fields, integration algorithms, and trajectory analysis</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-blue-400 transition-transform ${expandedSection === 'md' ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {expandedSection === 'md' && (
              <div className="mt-4 bg-slate-800/50 border border-blue-500/10 rounded-lg p-8 space-y-6">
                <p className="text-gray-300 leading-relaxed">
                  Molecular dynamics (MD) simulations integrate Newton's equations of motion to propagate atomic trajectories through phase space, providing atomistic insights into protein-ligand complex stability, conformational dynamics, and binding free energy landscapes.
                </p>

                <div className="bg-slate-900/80 p-6 rounded-lg border border-blue-500/20">
                  <h4 className="text-lg font-semibold text-blue-300 mb-3">Equations of Motion</h4>
                  <div className="space-y-3 font-mono text-sm bg-slate-950/50 p-4 rounded">
                    <p className="text-cyan-300">F_i = m_i * a_i = m_i * d²r_i/dt²</p>
                    <p className="text-gray-400">where F_i = -∇U(r₁, r₂, ..., r_N)</p>
                    <p className="text-gray-400 mt-3">Integration via Verlet, Leap-Frog, or velocity-Verlet algorithms with timesteps Δt = 1-2 fs</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-blue-300 mb-4">Force Fields</h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/80 p-4 rounded-lg border border-blue-500/20">
                      <h5 className="font-bold text-blue-300 mb-2">AMBER (ff19SB)</h5>
                      <p className="text-gray-400 text-sm">Assisted Model Building with Energy Refinement. Widely used for proteins and nucleic acids. Optimized for biomolecular simulations.</p>
                    </div>
                    <div className="bg-slate-900/80 p-4 rounded-lg border border-blue-500/20">
                      <h5 className="font-bold text-blue-300 mb-2">CHARMM36</h5>
                      <p className="text-gray-400 text-sm">Chemistry at Harvard Macromolecular Mechanics. Extensive parameter sets. Strong in lipid bilayer simulations.</p>
                    </div>
                    <div className="bg-slate-900/80 p-4 rounded-lg border border-blue-500/20">
                      <h5 className="font-bold text-blue-300 mb-2">GROMOS54A7</h5>
                      <p className="text-gray-400 text-sm">GROningen MOlecular Simulation. United-atom force field. Fast simulations, popular in European computational chemistry.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-6 rounded-lg border border-blue-500/20">
                  <h4 className="text-lg font-semibold text-blue-300 mb-4">Solvation Models</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-200 mb-2">Explicit Solvent (TIP3P, SPC/E, TIP4P)</h5>
                      <p className="text-gray-400 text-sm">
                        Individual water molecules treated atomistically. Accurate but computationally expensive. Typical system sizes: 20,000-100,000 atoms including solvent shell.
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-200 mb-2">Implicit Solvent (GB/SA, PB)</h5>
                      <p className="text-gray-400 text-sm">
                        Generalized Born or Poisson-Boltzmann continuum models. Faster but loses water-mediated effects. Useful for conformational sampling and free energy calculations.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-6 rounded-lg border border-blue-500/20">
                  <h4 className="text-lg font-semibold text-blue-300 mb-4">Trajectory Analysis Metrics</h4>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-cyan-400 font-mono">RMSD:</span>
                      <span className="text-gray-400">Root Mean Square Deviation from reference structure. Measures overall structural drift.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-cyan-400 font-mono">RMSF:</span>
                      <span className="text-gray-400">Root Mean Square Fluctuation per residue. Identifies flexible regions and binding site plasticity.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-cyan-400 font-mono">Rg:</span>
                      <span className="text-gray-400">Radius of gyration. Indicates protein compactness and folding state.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-cyan-400 font-mono">H-bond:</span>
                      <span className="text-gray-400">Hydrogen bond occupancy analysis. Critical for binding mode validation.</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-cyan-400 font-mono">SASA:</span>
                      <span className="text-gray-400">Solvent Accessible Surface Area. Burial of hydrophobic ligand regions upon binding.</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Evolution Timeline */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection('evolution')}
              className="w-full bg-gradient-to-r from-slate-800 to-blue-950/50 border border-cyan-500/20 rounded-lg p-6 hover:border-cyan-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-purple-300">Evolution of Drug Discovery</h3>
                    <p className="text-gray-400 text-sm mt-1">From phenotypic screening to computational genomics</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-purple-400 transition-transform ${expandedSection === 'evolution' ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {expandedSection === 'evolution' && (
              <div className="mt-4 bg-slate-800/50 border border-purple-500/10 rounded-lg p-8 space-y-6">
                <div className="space-y-6">
                  <div className="border-l-4 border-purple-500 pl-6">
                    <h4 className="text-lg font-bold text-purple-300 mb-2">1980s: Early Computational Methods</h4>
                    <p className="text-gray-400 leading-relaxed mb-3">
                      Kuntz et al. (1982) developed DOCK, the first geometric matching algorithm for protein-ligand docking. Rigid-body orientation search using distance geometry. Limited by computational power and crude scoring functions.
                    </p>
                    <p className="text-gray-500 text-sm italic">Key Publications: Kuntz, DOCK (1982) • GRID molecular field analysis (1985)</p>
                  </div>

                  <div className="border-l-4 border-purple-400 pl-6">
                    <h4 className="text-lg font-bold text-purple-300 mb-2">1990s: Force Fields & Flexibility</h4>
                    <p className="text-gray-400 leading-relaxed mb-3">
                      Introduction of AutoDock (Morris et al., 1998) with Lamarckian genetic algorithm. GOLD (Jones et al., 1997) implemented genetic algorithms with flexibility. FlexX pioneered incremental construction. Development of AMBER, CHARMM force field parameterization.
                    </p>
                    <p className="text-gray-500 text-sm italic">Key Publications: AutoDock LGA (1998) • GOLD genetic algorithm (1997) • FlexX (1996)</p>
                  </div>

                  <div className="border-l-4 border-cyan-500 pl-6">
                    <h4 className="text-lg font-bold text-purple-300 mb-2">2000s: High-Throughput Virtual Screening</h4>
                    <p className="text-gray-400 leading-relaxed mb-3">
                      Emergence of HTVS platforms capable of screening millions of compounds. Glide (Schrödinger, 2004) introduced hierarchical screening with XP precision. Integration with combinatorial chemistry and library design. Machine learning scoring function refinement.
                    </p>
                    <p className="text-gray-500 text-sm italic">Key Advances: Glide XP (2004) • ZINC database (2005) • PubChem (2004)</p>
                  </div>

                  <div className="border-l-4 border-emerald-500 pl-6">
                    <h4 className="text-lg font-bold text-purple-300 mb-2">2010s: Ensemble & Free Energy Methods</h4>
                    <p className="text-gray-400 leading-relaxed mb-3">
                      AutoDock Vina (Trott & Olson, 2010) revolutionized speed and accuracy. Multi-state ensemble docking accounting for receptor flexibility. Free energy perturbation (FEP) calculations reaching chemical accuracy. Integration of MD simulations for pose refinement and binding kinetics.
                    </p>
                    <p className="text-gray-500 text-sm italic">Key Publications: AutoDock Vina (2010) • FEP+ (Schrödinger) • Molecular dynamics integration</p>
                  </div>

                  <div className="border-l-4 border-blue-500 pl-6">
                    <h4 className="text-lg font-bold text-purple-300 mb-2">2020s: AI/ML & Cloud Computing</h4>
                    <p className="text-gray-400 leading-relaxed mb-3">
                      Deep learning scoring functions (DeepDock, GNINA). AlphaFold2 structure prediction enabling structure-based design for novel targets. Cloud-based platforms democratizing access. Quantum mechanics/molecular mechanics (QM/MM) hybrid methods. Fragment-based drug design integration.
                    </p>
                    <p className="text-gray-500 text-sm italic">Key Advances: AlphaFold2 (2020) • GNINA CNN scoring (2021) • Cloud HTVS platforms</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tool Ecosystem */}
          <div className="mb-4">
            <button
              onClick={() => toggleSection('tools')}
              className="w-full bg-gradient-to-r from-slate-800 to-blue-950/50 border border-cyan-500/20 rounded-lg p-6 hover:border-cyan-500/40 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <GitBranch className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-xl font-bold text-amber-300">Computational Tool Ecosystem</h3>
                    <p className="text-gray-400 text-sm mt-1">Comparative analysis of docking and simulation platforms</p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-amber-400 transition-transform ${expandedSection === 'tools' ? 'rotate-180' : ''}`} />
              </div>
            </button>
            {expandedSection === 'tools' && (
              <div className="mt-4 bg-slate-800/50 border border-amber-500/10 rounded-lg p-8">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-amber-500/30">
                        <th className="text-left py-3 px-4 text-amber-300 font-semibold">Software</th>
                        <th className="text-left py-3 px-4 text-amber-300 font-semibold">Algorithm</th>
                        <th className="text-left py-3 px-4 text-amber-300 font-semibold">Scoring</th>
                        <th className="text-left py-3 px-4 text-amber-300 font-semibold">Flexibility</th>
                        <th className="text-left py-3 px-4 text-amber-300 font-semibold">Speed</th>
                        <th className="text-left py-3 px-4 text-amber-300 font-semibold">License</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-400">
                      <tr className="border-b border-slate-700">
                        <td className="py-3 px-4 font-semibold text-cyan-300">AutoDock Vina</td>
                        <td className="py-3 px-4">Iterated local search</td>
                        <td className="py-3 px-4">Empirical/KB hybrid</td>
                        <td className="py-3 px-4">Ligand flexible</td>
                        <td className="py-3 px-4 text-emerald-400">Fast</td>
                        <td className="py-3 px-4">Apache 2.0</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-3 px-4 font-semibold text-cyan-300">Glide (Schrödinger)</td>
                        <td className="py-3 px-4">Hierarchical search</td>
                        <td className="py-3 px-4">GlideScore (empirical)</td>
                        <td className="py-3 px-4">Induced fit option</td>
                        <td className="py-3 px-4 text-yellow-400">Medium</td>
                        <td className="py-3 px-4">Commercial</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-3 px-4 font-semibold text-cyan-300">GOLD (CCDC)</td>
                        <td className="py-3 px-4">Genetic algorithm</td>
                        <td className="py-3 px-4">GoldScore/ChemScore</td>
                        <td className="py-3 px-4">Full flexibility</td>
                        <td className="py-3 px-4 text-red-400">Slow</td>
                        <td className="py-3 px-4">Commercial</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-3 px-4 font-semibold text-cyan-300">DOCK 6</td>
                        <td className="py-3 px-4">Geometric matching</td>
                        <td className="py-3 px-4">Force field/Grid</td>
                        <td className="py-3 px-4">Anchor-first flexible</td>
                        <td className="py-3 px-4 text-emerald-400">Fast</td>
                        <td className="py-3 px-4">Academic free</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-3 px-4 font-semibold text-cyan-300">GROMACS</td>
                        <td className="py-3 px-4">MD simulation</td>
                        <td className="py-3 px-4">Force field (AMBER/CHARMM)</td>
                        <td className="py-3 px-4">Full atomistic</td>
                        <td className="py-3 px-4 text-red-400">Very Slow</td>
                        <td className="py-3 px-4">LGPL</td>
                      </tr>
                      <tr className="border-b border-slate-700">
                        <td className="py-3 px-4 font-semibold text-cyan-300">AmberTools</td>
                        <td className="py-3 px-4">MD + Free energy</td>
                        <td className="py-3 px-4">AMBER force field</td>
                        <td className="py-3 px-4">Full MD flexibility</td>
                        <td className="py-3 px-4 text-red-400">Very Slow</td>
                        <td className="py-3 px-4">GPL</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-semibold text-cyan-300">rDock</td>
                        <td className="py-3 px-4">MC/Simplex</td>
                        <td className="py-3 px-4">Master equation</td>
                        <td className="py-3 px-4">Ligand + side-chain</td>
                        <td className="py-3 px-4 text-yellow-400">Medium</td>
                        <td className="py-3 px-4">LGPL</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 bg-slate-900/80 p-4 rounded-lg border border-amber-500/20">
                  <h4 className="text-sm font-semibold text-amber-300 mb-2">Platform Selection Criteria</h4>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    <strong className="text-gray-300">For HTVS campaigns:</strong> AutoDock Vina or DOCK 6 (speed critical)<br />
                    <strong className="text-gray-300">For accuracy:</strong> Glide XP or GOLD with post-processing<br />
                    <strong className="text-gray-300">For induced fit:</strong> Rosetta, Glide IFD, or ensemble docking<br />
                    <strong className="text-gray-300">For binding kinetics:</strong> GROMACS or AMBER MD with umbrella sampling
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cyan-900/30 bg-slate-950 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-cyan-300 mb-3">Research Platform</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Open-source computational structural biology platform for academic and pharmaceutical research. Developed by Karan Tandon.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-cyan-300 mb-3">Architecture</h3>
              <ul className="text-gray-400 text-sm space-y-2 font-mono">
                <li className="flex items-center gap-2">
                  <span className="text-cyan-500">→</span> Next.js 16 + TypeScript
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-500">→</span> MongoDB Atlas (M0)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-500">→</span> Supabase Storage
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-cyan-500">→</span> Hugging Face Spaces
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-cyan-300 mb-3">Resources</h3>
              <ul className="text-gray-400 text-sm space-y-2">
                <li><a href="#" className="hover:text-cyan-400 transition-colors flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Documentation
                </a></li>
                <li><a href="https://github.com/VIBEGOAT/dockGOAT" target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors flex items-center gap-2">
                  <GitBranch className="w-4 h-4" /> GitHub Repository
                </a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">Research Publications</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-cyan-900/30 pt-8 text-center">
            <p className="text-gray-500 text-sm font-mono">
              © 2026 dockGOAT • MIT License • Powered by AutoDock Vina • Built for computational chemistry research
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
