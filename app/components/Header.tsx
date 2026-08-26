import React from 'react';
import { motion } from 'framer-motion';
import { Atom, Github } from 'lucide-react';

export default function Header() {
  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100 }}
      className="border-b border-indigo-900/40 bg-slate-950/95 backdrop-blur-md sticky top-0 z-50 shadow-lg shadow-indigo-900/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ rotate: 360, scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-lg border border-indigo-500/40 shadow-lg shadow-indigo-500/20"
            >
              <Atom className="w-6 h-6 text-indigo-300" />
            </motion.div>
            <div>
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 tracking-tight"
              >
                dockGOAT
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xs text-gray-400 font-mono tracking-wider"
              >
                COMPUTATIONAL DRUG DISCOVERY
              </motion.p>
            </div>
          </div>

          <nav className="flex items-center gap-6 text-sm">
            <motion.a 
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              href="https://github.com/VIBEGOAT/dockGOAT" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 text-gray-400 hover:text-indigo-300 font-medium transition-colors"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">Repository</span>
            </motion.a>
            <motion.a 
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              href="#" 
              className="text-gray-400 hover:text-indigo-300 font-medium transition-colors font-mono"
            >
              DOCS
            </motion.a>
          </nav>
        </div>
      </div>
    </motion.header>
  );
}
