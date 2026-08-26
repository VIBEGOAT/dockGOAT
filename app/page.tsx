'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import ParticleBackground from './components/ParticleBackground';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import BentoGrid from './components/BentoGrid';
import JobForm from './components/JobForm';
import JobList from './components/JobList';
import { ThemeProvider } from './components/ThemeProvider';

export default function App() {
  const [jobListRefresh, setJobListRefresh] = useState<string>('');
  const workspaceRef = useRef<HTMLDivElement>(null);

  const handleJobSubmitted = (jobId: string) => {
    setJobListRefresh(jobId);
  };

  const scrollToWorkspace = () => {
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <ThemeProvider>
      <main className="min-h-screen bg-[#f5f5f7] dark:bg-black text-black dark:text-white transition-colors duration-500">
        {/* Particle Background */}
        <ParticleBackground />

        {/* Header */}
        <Header />

        {/* Hero Section */}
        <HeroSection onCtaClick={scrollToWorkspace} />

        {/* Tech Stack Bento Grid */}
        <BentoGrid />

        {/* Workspace Section */}
        <motion.section
          ref={workspaceRef}
          id="workspace"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
          className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10"
        >
          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <h2 className="text-4xl sm:text-5xl font-bold text-black dark:text-white mb-4 tracking-tight">
              Virtual Screening Workstation
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Configure docking parameters and monitor the processing queue in real-time.
            </p>
          </motion.div>

          {/* Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Job Form */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 80 }}
            >
              <JobForm onJobSubmitted={handleJobSubmitted} />
            </motion.div>

            {/* Job List */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 80 }}
            >
              <JobList refreshTrigger={jobListRefresh} />
            </motion.div>
          </div>
        </motion.section>

        {/* About / Attribution Section */}
        <motion.section
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.6 }}
            className="rounded-3xl bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/10 p-8 md:p-12 shadow-sm"
          >
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-2xl">K</span>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-black dark:text-white mb-3">Platform Architecture</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                  Developed by <span className="text-blue-600 dark:text-blue-400 font-semibold">Karan Tandon</span>, Lead Computational Researcher specializing in structural bioinformatics, molecular docking methodologies, and high-throughput virtual screening workflows. This platform integrates established computational chemistry protocols with modern cloud infrastructure to enable reproducible, scalable structure-based drug discovery research.
                </p>
                <p className="text-gray-600 dark:text-gray-500 text-sm">
                  <strong className="text-gray-800 dark:text-gray-400">Expertise:</strong> Protein-ligand binding affinity prediction • Virtual screening • Molecular dynamics • Cheminformatics • Structural biology
                </p>
              </div>
            </div>
          </motion.div>
        </motion.section>

        {/* Footer */}
        <footer className="border-t border-black/5 dark:border-white/10 py-12 px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="text-center md:text-left">
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  © 2024 dockGOAT. Built with Next.js, MongoDB, and AutoDock Vina.
                </p>
                <p className="text-gray-500 dark:text-gray-600 text-xs mt-1">
                  Open-source computational structural biology platform
                </p>
              </div>
              <div className="flex items-center gap-6">
                <motion.a
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  href="https://github.com/VIBEGOAT/dockGOAT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors text-sm font-medium"
                >
                  GitHub
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  href="#"
                  className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors text-sm font-medium"
                >
                  Documentation
                </motion.a>
                <motion.a
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  href="#"
                  className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors text-sm font-medium"
                >
                  API
                </motion.a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </ThemeProvider>
  );
}
