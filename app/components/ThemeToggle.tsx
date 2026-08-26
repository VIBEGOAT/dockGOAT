'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

/**
 * Light / Dark mode toggle.
 * - Shows ☀ Sun  when currently in dark  mode  (click → switch to light)
 * - Shows ☾ Moon when currently in light mode  (click → switch to dark)
 *
 * Exclusively controls the `dark` class on <html> via ThemeProvider.
 * Has zero effect on animations, particles, or any other state.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="
        relative flex items-center gap-2 pl-2.5 pr-3.5 h-9 rounded-full
        bg-black/[0.06] dark:bg-white/[0.10]
        hover:bg-black/[0.10] dark:hover:bg-white/[0.16]
        border border-black/[0.08] dark:border-white/[0.10]
        text-gray-800 dark:text-gray-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60
        select-none cursor-pointer
      "
    >
      {/* Animated icon */}
      <span className="relative w-4 h-4 flex-shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.span
              key="sun"
              initial={{ rotate: -60, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0,   opacity: 1, scale: 1   }}
              exit={{    rotate: 60,  opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Sun className="w-4 h-4 text-amber-400" strokeWidth={1.8} />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={{ rotate: 60,  opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0,   opacity: 1, scale: 1   }}
              exit={{    rotate: -60, opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Moon className="w-4 h-4 text-slate-500 dark:text-slate-400" strokeWidth={1.8} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {/* Text label — hidden on mobile */}
      <span className="hidden sm:block text-[13px] font-medium leading-none">
        {isDark ? 'Light' : 'Dark'}
      </span>
    </motion.button>
  );
}
