'use client';

import { useEffect, useState } from 'react';
import { depict, getRDKit } from '@/lib/chem/rdkit';

/**
 * 2D structure drawing from RDKit. The SVG inherits the page theme through the
 * `.mol-svg` rule in globals.css, which inverts it in dark mode.
 */
export default function MoleculeDepiction({
  smiles,
  width = 320,
  height = 240,
  highlightAtoms,
  className,
}: {
  smiles: string;
  width?: number;
  height?: number;
  highlightAtoms?: number[];
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setSvg(null);
    setFailed(false);
    if (!smiles) return;
    getRDKit()
      .then((rd) => {
        if (!alive) return;
        setSvg(depict(rd, smiles, { width, height, highlightAtoms, transparent: true }));
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [smiles, width, height, highlightAtoms]);

  if (failed) return <div className={`flex h-full w-full items-center justify-center text-[11px] text-subtle ${className ?? ''}`}>No depiction</div>;
  if (!svg) return <div className={`h-full w-full animate-pulse bg-surface-2 ${className ?? ''}`} />;
  return <div className={`mol-svg h-full w-full ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
