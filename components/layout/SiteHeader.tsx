'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Github, Menu, X } from 'lucide-react';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { cn } from '@/components/ui/primitives';
import { Brand } from './Brand';
import { GITHUB_URL, NAV } from './nav';

export default function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:inline-flex"
            aria-label="Source code on GitHub"
          >
            <Github className="h-4 w-4" strokeWidth={1.8} />
          </a>
          <Link
            href="/dock"
            className="ml-2 hidden h-8 items-center rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-hover sm:inline-flex"
          >
            Open Studio
          </Link>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-line bg-surface px-4 py-2 md:hidden" aria-label="Mobile">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'block rounded-md px-3 py-2 text-sm font-medium',
                pathname.startsWith(n.href) ? 'bg-surface-2 text-fg' : 'text-muted',
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
