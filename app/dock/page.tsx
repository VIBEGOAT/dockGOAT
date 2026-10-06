import type { Metadata } from 'next';
import DockStudio from '@/components/dock/DockStudio';

export const metadata: Metadata = {
  title: 'Docking Studio',
  description:
    'Dock a ligand into a protein with AutoDock Vina running locally in your browser: automatic preparation, pocket detection, pose ranking and interaction analysis.',
};

export default function DockPage() {
  return <DockStudio />;
}
