'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

/** Inline script for <head>: applies the stored/system theme before first paint. */
export const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark')}catch(e){}})();`;

function apply(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* storage unavailable (private mode) */
  }
  window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The bootstrap script already set the class, so read it lazily on the client.
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    apply(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      apply(next);
      return next;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
