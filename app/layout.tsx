import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import SiteHeader from '@/components/layout/SiteHeader';
import { THEME_BOOTSTRAP, ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'], display: 'swap' });
const mono = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'dockGOAT — Structure-based drug discovery in your browser',
    template: '%s · dockGOAT',
  },
  description:
    'Molecular docking with AutoDock Vina, ADMET profiling with RDKit, binding-site detection and 3D structure analysis — all running locally in the browser. No installation, no uploads.',
  keywords: [
    'molecular docking',
    'AutoDock Vina',
    'virtual screening',
    'ADMET',
    'drug discovery',
    'RDKit',
    'protein-ligand interactions',
    'PDB',
    'AlphaFold',
  ],
  openGraph: {
    title: 'dockGOAT — Structure-based drug discovery in your browser',
    description: 'AutoDock Vina docking, ADMET profiling and structure analysis, computed locally in your browser.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c10' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs before first paint so the stored theme never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        <ThemeProvider>
          <SiteHeader />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
