'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

/** Mutates <html> class and persists. Pure DOM, no React state. */
function applyTheme(t: Theme) {
  if (t === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('theme', t);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  /*
   * Read the class the blocking <head> script already stamped.
   * The lazy initialiser runs client-only so document is always available.
   * First render already has the correct theme — no second render/flicker.
   */
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  );

  /*
   * One-time sync: reconcile if localStorage and the DOM class diverge.
   * Normally a no-op since the blocking script already applied localStorage.
   */
  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored && stored !== theme) {
      setTheme(stored);
      applyTheme(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
