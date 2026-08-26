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
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: 'easeOut',
      },
    },
  };

  return (
    <motion.section
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-20"
    >
      {/* Background gradient accent */}
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-blue-100 blur-3xl" />
      </div>

      <motion.div variants={itemVariants} className="text-center space-y-6 max-w-4xl">
        {/* Eyebrow text */}
        <motion.div
          variants={itemVariants}
          className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20"
        >
          <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Computational Structural Biology</span>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          variants={itemVariants}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-black dark:text-white tracking-tight leading-tight"
        >
          Molecular Docking{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-500 dark:from-blue-400 dark:to-blue-500">
            Pipeline
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={itemVariants}
          className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed max-w-2xl mx-auto"
        >
          High-throughput virtual screening for structure-based drug design. Harness AutoDock Vina's empirical scoring and Lamarckian genetic algorithms for rapid ligand-receptor binding affinity predictions.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
        >
          {/* Primary CTA - Pill shaped */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgba(0, 113, 227, 0.15)' }}
            whileTap={{ scale: 0.98 }}
            onClick={onCtaClick}
            className="px-8 py-3.5 rounded-full bg-blue-600 dark:bg-blue-500 text-white font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
          >
            Start Docking
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          {/* Secondary CTA */}
          <motion.a
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            href="https://github.com/VIBEGOAT/dockGOAT"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3.5 rounded-full bg-black/5 dark:bg-white/10 text-black dark:text-white font-semibold hover:bg-black/10 dark:hover:bg-white/20 transition-colors border border-black/10 dark:border-white/10"
          >
            View on GitHub
          </motion.a>
        </motion.div>

        {/* Trust badges / Stats */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-center gap-8 pt-12 text-sm text-gray-600 dark:text-gray-500"
        >
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span>AutoDock Vina 1.2.5</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span>PDBQT Format</span>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-blue-600 dark:bg-blue-400" />
            <span>Flexible Docking</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <svg
          className="w-6 h-6 text-gray-400 dark:text-gray-600"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </motion.div>
    </motion.section>
  );
}
