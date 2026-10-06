import type { Metadata } from 'next';
import ViewerWorkbench from '@/components/viewer/ViewerWorkbench';

export const metadata: Metadata = {
  title: 'Structure viewer',
  description: 'Visualise PDB entries, AlphaFold models and your own structures in 3D, with sequence properties (ProtParam) and a Ramachandran plot.',
};

export default function ViewerPage() {
  return <ViewerWorkbench />;
}
