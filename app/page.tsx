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
      <div className="relative z-10 min-h-screen text-[#1d1d1f] dark:text-white">
        {/* Fixed canvas background */}
        <ParticleBackground />

        {/* â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Header />

        {/* â”€â”€ Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <HeroSection onCtaClick={scrollToWorkspace} />

        {/* â”€â”€ Bioinformatics Concepts (accordion) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <BioinformaticsSection />

        {/* â”€â”€ Virtual Screening Workstation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
              <h2 className="text-4xl sm:text-5xl font-bold text-[#1d1d1f] dark:text-white tracking-tight mb-4">
                Virtual Screening Workstation
              </h2>
              <p className="text-lg text-[#6e6e73] dark:text-[#a1a1a6] max-w-2xl mx-auto">
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

        {/* â”€â”€ About / Attribution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                  <h3 className="text-xl font-bold text-[#1d1d1f] dark:text-white mb-3">
                    Platform Architecture
                  </h3>
                  <p className="text-[#3a3a3c] dark:text-[#a1a1a6] leading-relaxed mb-4">
                    Developed by{' '}
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      Karan Tandon
                    </span>
                    , Lead Computational Researcher specialising in structural bioinformatics,
                    molecular docking methodologies, and high-throughput virtual screening workflows.
                    This platform integrates established computational chemistry protocols with modern
                    cloud infrastructure to enable reproducible, scalable structure-based drug discovery.
                  </p>
                  <p className="text-sm text-[#6e6e73] dark:text-[#6e6e73]">
                    <span className="font-medium text-[#1d1d1f] dark:text-[#a1a1a6]">Expertise: </span>
                    Proteinâ€“ligand binding affinity prediction Â· Virtual screening Â· Molecular dynamics Â·
                    Cheminformatics Â· Structural biology
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* â”€â”€ Tech Stack (minimal footer grid) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <TechStack />

        {/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <footer className="relative z-10 border-t border-black/[0.06] dark:border-white/[0.07] py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm text-[#6e6e73] dark:text-[#6e6e73] text-center sm:text-left">
                Â© 2026 dockGOAT. Built with Next.js, MongoDB & AutoDock Vina.
              </p>
              <p className="text-xs text-[#86868b] dark:text-[#48484a] mt-0.5 text-center sm:text-left">
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
                  className="text-[#6e6e73] hover:text-[#1d1d1f] dark:text-[#a1a1a6] dark:hover:text-white transition-colors font-medium"
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


