import type { Metadata } from 'next';
import ToolsWorkbench from '@/components/tools/ToolsWorkbench';

export const metadata: Metadata = {
  title: 'Toolkit',
  description: 'Molecule identifiers and 3D export, ΔG/Kd conversion with ligand efficiency, ProtParam sequence analysis and Vina-ready PDBQT preparation.',
};

export default function ToolsPage() {
  return <ToolsWorkbench />;
}
