import Link from 'next/link';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden className={className}>
      <path
        d="M9 8 L9 28 M9 8 C9 8 22 8 22 18 C22 28 9 28 9 28"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27 13 C24.5 10 20.5 9.5 18.5 11.5 C15.5 14.5 15.5 21.5 18.5 24.5 C21 27 26 26.5 27 23.5 L27 19.5 L23.5 19.5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="dockGOAT home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-fg text-bg">
        <Logo className="h-5 w-5" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        dock<span className="text-accent">GOAT</span>
      </span>
    </Link>
  );
}
