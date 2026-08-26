'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Github } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

/**
 * DockGoat logomark — an abstract DG monogram built from two geometric paths:
 *  - A rounded arc that opens to the right (the "D" stroke)
 *  - A clean chevron / goat-horn inflection (the "G" + subtle horns motif)
 * Uses currentColor so it adapts to any theme automatically.
 */
function DockGoatLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="dockGOAT logo"
      className={className}
    >
      {/* ── "D" arc — left vertical bar + right semicircle ── */}
      <path
        d="M9 8 L9 28 M9 8 C9 8 22 8 22 18 C22 28 9 28 9 28"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* ── "G" shape — open arc with inward horizontal serif ── */}
      <path
        d="M27 13 C24.5 10 20.5 9.5 18.5 11.5 C15.5 14.5 15.5 21.5 18.5 24.5 C21 27 26 26.5 27 23.5 L27 19.5 L23.5 19.5"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function Header() {
  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/80 dark:bg-black/80 border-b border-black/[0.06] dark:border-white/[0.08]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">

          {/* ── Logo + Brand ─────────────────────────────────────────── */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            {/* Icon container */}
            <div className="w-9 h-9 rounded-xl bg-black dark:bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <DockGoatLogo className="w-5 h-5 text-white dark:text-black" />
            </div>

            {/* Word mark */}
            <div className="leading-none">
              <span className="block text-[15px] font-semibold tracking-tight text-[#1d1d1f] dark:text-white">
                dockGOAT
              </span>
              <span className="block text-[11px] text-[#86868b] dark:text-[#86868b] font-medium mt-px">
                Molecular Docking
              </span>
            </div>
          </motion.div>

          {/* ── Nav items ────────────────────────────────────────────── */}
          <nav className="flex items-center gap-2 sm:gap-4">
            {/* Page links — hidden on mobile */}
            <motion.a
              whileHover={{ y: -1 }}
              href="#concepts"
              className="hidden sm:block text-sm text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium px-2 py-1 rounded-lg transition-colors"
            >
              Concepts
            </motion.a>
            <motion.a
              whileHover={{ y: -1 }}
              href="#workspace"
              className="hidden sm:block text-sm text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-white font-medium px-2 py-1 rounded-lg transition-colors"
            >
              Workspace
            </motion.a>

            {/* Divider */}
            <div className="hidden sm:block w-px h-5 bg-black/[0.08] dark:bg-white/[0.10]" />

            {/* ── Theme toggle ─────────────────────────────────────── */}
            <ThemeToggle />

            {/* ── GitHub ───────────────────────────────────────────── */}
            <motion.a
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              href="https://github.com/VIBEGOAT/dockGOAT"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[#1d1d1f] dark:text-[#e5e5e7] hover:bg-black/[0.09] dark:hover:bg-white/[0.14] border border-black/[0.10] dark:border-white/[0.08] transition-colors font-medium text-sm"
            >
              <Github className="w-4 h-4" strokeWidth={1.8} />
              <span className="hidden sm:inline">GitHub</span>
            </motion.a>
          </nav>
        </div>
      </div>
    </motion.header>
  );
}
