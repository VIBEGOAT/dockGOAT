'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  onCtaClick?: () => void;
}

export default function HeroSection({ onCtaClick }: HeroSectionProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.18, delayChildren: 0.25 },
    },
  };

  const itemVariants = {
    hidden:   { opacity: 0, y: 24 },
    visible:  { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1] } },
  };

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-20"
    >
      {/* Background radial glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-200/30 dark:bg-blue-500/10 blur-3xl" />
      </div>

      <div className="text-center space-y-7 max-w-4xl w-full">

        {/* Eyebrow pill */}
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200/70 dark:border-blue-500/20"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400 tracking-wide">
            Computational Structural Biology
          </span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] text-[#1d1d1f] dark:text-white"
        >
          Molecular Docking{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
            Pipeline
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto text-[#3a3a3c] dark:text-[#a1a1a6]"
        >
          High-throughput virtual screening for structure-based drug design.
          Harness AutoDock Vina's empirical scoring and Lamarckian genetic
          algorithms for rapid ligand–receptor binding affinity predictions.
        </motion.p>

        {/* CTA row */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
        >
          {/* Primary — solid blue pill */}
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: '0 16px 40px rgba(37,99,235,0.25)' }}
            whileTap={{ scale: 0.97 }}
            onClick={onCtaClick}
            className="flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-lg shadow-blue-600/20 dark:shadow-blue-500/20 transition-colors duration-200"
          >
            Start Docking
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          {/* Ghost button */}
          <motion.a
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            href="https://github.com/VIBEGOAT/dockGOAT"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold border-2 border-[#1d1d1f] text-[#1d1d1f] hover:bg-[#1d1d1f] hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black transition-colors duration-200"
          >
            View on GitHub
          </motion.a>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center gap-8 pt-8 text-sm text-[#6e6e73] dark:text-[#6e6e73]"
        >
          {['AutoDock Vina 1.2.5', 'PDBQT Format', 'Flexible Docking'].map((badge, i) => (
            <div key={badge} className={`flex items-center gap-2 ${i > 0 ? 'hidden sm:flex' : ''}`}>
              <span className="w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400 flex-shrink-0" />
              <span>{badge}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
        aria-hidden
      >
        <svg
          className="w-5 h-5 text-[#86868b] dark:text-[#48484a]"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </motion.div>
    </motion.section>
  );
}
