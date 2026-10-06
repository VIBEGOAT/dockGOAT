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
  // Each result is tagged with the request it answers, so a stale drawing is
  // never shown for a new molecule and no state has to be reset in an effect.
  const highlightKey = highlightAtoms?.join(',') ?? '';
  const key = `${smiles}|${width}|${height}|${highlightKey}`;
  const [result, setResult] = useState<{ key: string; svg: string | null } | null>(null);

  useEffect(() => {
    if (!smiles) return;
    let alive = true;
    const atoms = highlightKey ? highlightKey.split(',').map(Number) : undefined;
    getRDKit()
      .then((rd) => alive && setResult({ key, svg: depict(rd, smiles, { width, height, highlightAtoms: atoms, transparent: true }) }))
      .catch(() => alive && setResult({ key, svg: null }));
    return () => {
      alive = false;
    };
  }, [key, smiles, width, height, highlightKey]);

  const current = result?.key === key ? result : null;
  const svg = current?.svg ?? null;
  const failed = current !== null && current.svg === null;

  if (failed) return <div className={`flex h-full w-full items-center justify-center text-[11px] text-subtle ${className ?? ''}`}>No depiction</div>;
  if (!svg) return <div className={`h-full w-full animate-pulse bg-surface-2 ${className ?? ''}`} />;
  return <div className={`mol-svg h-full w-full ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
