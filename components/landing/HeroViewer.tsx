'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const MolViewer = dynamic(() => import('@/components/viewer/MolViewer'), { ssr: false });

/** Abl kinase (PDB 1IEP, chain A) with imatinib, shipped as a static demo file. */
export default function HeroViewer() {
  const [pdb, setPdb] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/demo/1iep_A_imatinib.pdb')
      .then((r) => (r.ok ? r.text() : null))
      .then((t) => alive && setPdb(t))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-[var(--viewer-bg)] shadow-float">
      <MolViewer
        receptor={pdb ? { data: pdb, format: 'pdb' } : null}
        receptorStyle="cartoon"
        colorScheme="spectrum"
        showHetero
        spin
        focusKey={pdb ? 'hero' : undefined}
      />
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-md border border-line bg-surface/90 px-2.5 py-1.5 text-[11px] font-medium text-muted backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        PDB 1IEP · Abl kinase + imatinib
      </div>
      <div className="pointer-events-none absolute bottom-3 right-3 rounded-md border border-line bg-surface/90 px-2.5 py-1.5 text-[11px] text-subtle backdrop-blur">
        Drag to rotate · scroll to zoom
      </div>
    </div>
  );
}
