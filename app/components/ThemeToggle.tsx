'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

/**
 * Color-theme toggle — switches the site between Light Mode (#fbfbfd surfaces,
 * dark text) and Dark Mode (OLED black surfaces, light text).
 *
 * Strictly controls the `dark` class on <html>. Has zero effect on animations
 * or particle interactions.
 */
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <motion.button
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="
        relative flex items-center gap-1.5 pl-2.5 pr-3 h-9 rounded-full
        bg-black/[0.05] dark:bg-white/[0.08]
        hover:bg-black/[0.09] dark:hover:bg-white/[0.14]
        border border-black/[0.06] dark:border-white/[0.08]
        text-gray-700 dark:text-gray-300
        transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50
        overflow-hidden
      "
    >
      {/* Icon — crossfades between Sun and Moon */}
      <span className="relative w-4 h-4 flex-shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.span
              key="moon"
              initial={{ rotate: -30, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0,   opacity: 1, scale: 1   }}
              exit={{    rotate: 30,  opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Moon className="w-4 h-4 text-indigo-400" strokeWidth={1.8} />
            </motion.span>
          ) : (
            <motion.span
              key="sun"
              initial={{ rotate: 30,  opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0,   opacity: 1, scale: 1   }}
              exit={{    rotate: -30, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.8} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>

      {/* Label */}
      <span className="hidden sm:block text-sm font-medium leading-none select-none">
        {isDark ? 'Light' : 'Dark'}
      </span>
    </motion.button>
  );
}
