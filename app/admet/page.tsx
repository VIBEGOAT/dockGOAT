import type { Metadata } from 'next';
import AdmetWorkbench from '@/components/admet/AdmetWorkbench';

export const metadata: Metadata = {
  title: 'ADMET & drug-likeness',
  description:
    'Profile molecules for physicochemical properties, solubility, absorption, BBB permeation, drug-likeness rules, QED, PAINS/Brenk alerts and toxicity structural alerts — computed in your browser with RDKit.',
};

export default function AdmetPage() {
  return <AdmetWorkbench />;
}
