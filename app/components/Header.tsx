'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Github } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 80, damping: 12 }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl bg-white/70 dark:bg-black/70 border-b border-black/5 dark:border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          {/* Logo & Branding */}
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">D</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-black dark:text-white tracking-tight">dockGOAT</h1>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Molecular Docking</p>
            </div>
          </motion.div>

          {/* Navigation */}
          <nav className="flex items-center gap-6 text-sm">
            <motion.a 
              whileHover={{ color: '#0071e3' }}
              href="#features"
              className="hidden sm:block text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            >
              Features
            </motion.a>
            <motion.a 
              whileHover={{ color: '#0071e3' }}
              href="#workspace"
              className="hidden sm:block text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
            >
              Workspace
            </motion.a>
            <ThemeToggle />
            <motion.a 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href="https://github.com/VIBEGOAT/dockGOAT" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/20 transition-colors font-medium"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline text-sm">GitHub</span>
            </motion.a>
          </nav>
        </div>
      </div>
    </motion.header>
  );
}
