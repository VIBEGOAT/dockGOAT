import type { Metadata } from 'next';
import ScreenWorkbench from '@/components/screen/ScreenWorkbench';

export const metadata: Metadata = {
  title: 'Virtual screening',
  description: 'Dock a compound library against a protein target with AutoDock Vina in your browser, with optional drug-likeness pre-filtering and ranked CSV/SDF export.',
};

export default function ScreenPage() {
  return <ScreenWorkbench />;
}
