'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.93 }}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="
        relative w-9 h-9 rounded-full
        bg-black/[0.06] dark:bg-white/[0.08]
        hover:bg-black/[0.10] dark:hover:bg-white/[0.14]
        flex items-center justify-center
        border border-black/[0.06] dark:border-white/[0.08]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
        overflow-hidden
      "
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -45, opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0,   opacity: 1, scale: 1   }}
            exit={{    rotate: 45,  opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="absolute flex items-center justify-center"
          >
            <Moon className="w-4 h-4 text-blue-300" strokeWidth={1.8} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 45,  opacity: 0, scale: 0.7 }}
            animate={{ rotate: 0,   opacity: 1, scale: 1   }}
            exit={{    rotate: -45, opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="absolute flex items-center justify-center"
          >
            <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.8} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
