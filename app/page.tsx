'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ThemeProvider } from './components/ThemeProvider';
import ParticleBackground from './components/ParticleBackground';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import BioinformaticsSection from './components/BioinformaticsSection';
import JobForm from './components/JobForm';
import JobList from './components/JobList';
import TechStack from './components/TechStack';

export default function App() {
  const [jobListRefresh, setJobListRefresh] = useState<string>('');
  const workspaceRef = useRef<HTMLDivElement>(null);

  const scrollToWorkspace = () => {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <ThemeProvider>
      <div className="relative min-h-screen bg-[var(--bg)] text-[var(--fg)]">
        {/* Fixed canvas background */}
        <ParticleBackground />

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <Header />

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <HeroSection onCtaClick={scrollToWorkspace} />

        {/* ── Bioinformatics Concepts (accordion) ──────────────────────── */}
        <BioinformaticsSection />

        {/* ── Virtual Screening Workstation ────────────────────────────── */}
        <section
          ref={workspaceRef}
          id="workspace"
          className="relative z-10 py-24 px-4 sm:px-6 lg:px-8"
        >
          <div className="max-w-7xl mx-auto">
            {/* Section header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="mb-16 text-center"
            >
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white tracking-tight mb-4">
                Virtual Screening Workstation
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                Configure docking parameters and monitor the processing queue in real-time.
              </p>
            </motion.div>

            {/* Form + Queue grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              >
                <JobForm onJobSubmitted={(id) => setJobListRefresh(id)} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              >
                <JobList refreshTrigger={jobListRefresh} />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── About / Attribution ──────────────────────────────────────── */}
        <section className="relative z-10 py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              className="rounded-3xl bg-white dark:bg-[#111111] border border-black/[0.06] dark:border-white/[0.07] p-8 md:p-12 shadow-[var(--shadow-sm)]"
            >
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                  <span className="text-white font-bold text-xl">K</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                    Platform Architecture
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    Developed by{' '}
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      Karan Tandon
                    </span>
                    , Lead Computational Researcher specialising in structural bioinformatics,
                    molecular docking methodologies, and high-throughput virtual screening workflows.
                    This platform integrates established computational chemistry protocols with modern
                    cloud infrastructure to enable reproducible, scalable structure-based drug discovery.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    <span className="font-medium text-gray-700 dark:text-gray-400">Expertise: </span>
                    Protein–ligand binding affinity prediction · Virtual screening · Molecular dynamics ·
                    Cheminformatics · Structural biology
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Tech Stack (minimal footer grid) ─────────────────────────── */}
        <TechStack />

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="relative z-10 border-t border-black/[0.06] dark:border-white/[0.07] py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-500 text-center sm:text-left">
                © 2025 dockGOAT. Built with Next.js, MongoDB & AutoDock Vina.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 text-center sm:text-left">
                Open-source computational structural biology platform
              </p>
            </div>
            <div className="flex items-center gap-6 text-sm">
              {[
                { label: 'GitHub', href: 'https://github.com/VIBEGOAT/dockGOAT' },
                { label: 'Documentation', href: '#' },
                { label: 'API', href: '#' },
              ].map((link) => (
                <motion.a
                  key={link.label}
                  whileHover={{ y: -2 }}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors font-medium"
                >
                  {link.label}
                </motion.a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
