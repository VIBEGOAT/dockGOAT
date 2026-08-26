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

/** Applies theme class to <html> and persists to localStorage. */
function applyTheme(t: Theme) {
  if (t === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  localStorage.setItem('theme', t);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialise from the class already stamped by the blocking <head> script
  // so the very first render uses the correct value — no extra effect needed.
  const [theme, setTheme] = useState<Theme>(() => {
    // useState initialiser only runs on the client, so document is available
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    }
    return 'light';
  });

  // Keep state in sync if something outside (e.g., OS preference) changes it
  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    const resolved: Theme = stored === 'dark' ? 'dark' : 'light';
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

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
