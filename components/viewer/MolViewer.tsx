'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { GLViewer } from '3dmol';
import type { Vec3 } from '@/lib/chem/geometry';
import { Spinner } from '@/components/ui/primitives';

export type ReceptorStyle = 'cartoon' | 'cartoon-sticks' | 'surface' | 'sticks' | 'lines' | 'hidden';
export type ColorScheme = 'chain' | 'spectrum' | 'ss' | 'bfactor' | 'hydrophobicity' | 'neutral';

export interface ViewerLigand {
  id: string;
  data: string;
  format: 'sdf' | 'mol' | 'pdb' | 'pdbqt' | 'mol2';
  /** Carbon colour. */
  color?: string;
  style?: 'sticks' | 'ballstick' | 'spheres' | 'lines';
  opacity?: number;
}

export interface ViewerLine {
  from: Vec3;
  to: Vec3;
  color: string;
  dashed?: boolean;
  radius?: number;
}

export interface ViewerProps {
  receptor?: { data: string; format: 'pdb' | 'pdbqt' | 'cif' } | null;
  receptorStyle?: ReceptorStyle;
  colorScheme?: ColorScheme;
  /** Show crystallographic hetero groups (ligands, cofactors, ions) as sticks. */
  showHetero?: boolean;
  showWater?: boolean;
  /** Translucent molecular surface around the binding site residues within this radius of the box/ligands. */
  pocketSurface?: boolean;
  ligands?: ViewerLigand[];
  box?: { center: Vec3; size: Vec3 } | null;
  points?: { positions: Vec3[]; color: string; radius?: number }[];
  lines?: ViewerLine[];
  /** Residues to draw as sticks with labels, e.g. interacting residues. */
  residues?: { chain: string; resi: number; label?: string }[];
  /** Changing this value re-centres the camera. */
  focusKey?: string;
  focus?: 'all' | 'ligands' | 'box';
  spin?: boolean;
  className?: string;
  /** Text shown over an empty viewer. */
  placeholder?: React.ReactNode;
}

export interface ViewerHandle {
  snapshot: () => string | null;
  resetView: () => void;
}

type ThreeDmol = typeof import('3dmol');

const HYDROPHOBICITY: Record<string, string> = {
  // Kyte–Doolittle mapped to a teal (hydrophilic) → amber (hydrophobic) ramp.
  ILE: '#d97706', VAL: '#e08a12', LEU: '#e49422', PHE: '#e8a33a', CYS: '#ebb052', MET: '#eebc6a', ALA: '#f1c983',
  GLY: '#cfd6de', THR: '#a9cfd0', SER: '#9ccbcc', TRP: '#c9c58d', TYR: '#b6c9a4', PRO: '#a3c4bc', HIS: '#7fbcbf',
  GLU: '#5aaeb3', GLN: '#57acb1', ASP: '#47a3aa', ASN: '#4aa5ac', LYS: '#3297a0', ARG: '#1f8c96',
};

function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function receptorStyleSpec(style: ReceptorStyle, scheme: ColorScheme): Record<string, unknown> {
  const color =
    scheme === 'spectrum'
      ? { color: 'spectrum' }
      : scheme === 'chain'
        ? { colorscheme: 'chain' }
        : scheme === 'ss'
          ? { colorscheme: 'ssPyMol' }
          : scheme === 'bfactor'
            ? { colorscheme: { prop: 'b', gradient: 'rwb', min: 90, max: 30 } }
            : scheme === 'hydrophobicity'
              ? { colorfunc: (a: { resn: string }) => HYDROPHOBICITY[a.resn] ?? '#cfd6de' }
              : { color: '#b8c4d6' };
  switch (style) {
    case 'cartoon':
      return { cartoon: { ...color, opacity: 0.95 } };
    case 'cartoon-sticks':
      return { cartoon: { ...color, opacity: 0.9 }, stick: { radius: 0.12, colorscheme: 'grayCarbon', opacity: 0.6 } };
    case 'sticks':
      return { stick: { radius: 0.14, ...(scheme === 'neutral' ? { colorscheme: 'grayCarbon' } : color) } };
    case 'lines':
      return { line: { ...(scheme === 'neutral' ? { colorscheme: 'grayCarbon' } : color) } };
    case 'surface':
      return { cartoon: { ...color, opacity: 0.5 } };
    default:
      return {};
  }
}

const MolViewer = forwardRef<ViewerHandle, ViewerProps>(function MolViewer(props, ref) {
  const {
    receptor,
    receptorStyle = 'cartoon',
    colorScheme = 'spectrum',
    showHetero = true,
    showWater = false,
    pocketSurface = false,
    ligands = [],
    box,
    points = [],
    lines = [],
    residues = [],
    focusKey,
    focus = 'all',
    spin = false,
    className,
    placeholder,
  } = props;

  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<GLViewer | null>(null);
  const lib = useRef<ThreeDmol | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFocus = useRef<string | undefined>(undefined);

  // Create the WebGL viewer once.
  useEffect(() => {
    let cancelled = false;
    import('3dmol')
      .then((mod) => {
        if (cancelled || !host.current) return;
        lib.current = mod;
        viewer.current = mod.createViewer(host.current, {
          backgroundColor: cssVar('--viewer-bg', '#ffffff'),
          antialias: true,
          cartoonQuality: 8,
        } as never);
        setReady(true);
      })
      .catch(() => setError('WebGL viewer failed to load'));
    const onTheme = () => {
      const v = viewer.current;
      if (!v) return;
      // Wait one frame so CSS variables reflect the new theme.
      requestAnimationFrame(() => {
        v.setBackgroundColor(cssVar('--viewer-bg', '#ffffff'), 1);
        v.render();
      });
    };
    window.addEventListener('themechange', onTheme);
    const ro = new ResizeObserver(() => {
      viewer.current?.resize();
      viewer.current?.render();
    });
    if (host.current) ro.observe(host.current);
    return () => {
      cancelled = true;
      window.removeEventListener('themechange', onTheme);
      ro.disconnect();
      try {
        viewer.current?.clear();
      } catch {
        /* context already lost */
      }
      viewer.current = null;
    };
  }, []);

  // Rebuild the scene whenever inputs change; the camera is preserved unless focusKey changes.
  useEffect(() => {
    const v = viewer.current;
    const $3D = lib.current;
    if (!ready || !v || !$3D) return;
    const view = v.getView();
    v.removeAllModels();
    v.removeAllShapes();
    v.removeAllSurfaces();
    v.removeAllLabels();

    let receptorModel: ReturnType<GLViewer['addModel']> | null = null;
    if (receptor?.data) {
      receptorModel = v.addModel(receptor.data, receptor.format === 'cif' ? 'cif' : receptor.format === 'pdbqt' ? 'pdbqt' : 'pdb', {
        keepH: false,
      });
      const sel = { model: receptorModel };
      v.setStyle(sel, {});
      if (receptorStyle !== 'hidden') v.setStyle({ model: receptorModel, hetflag: false }, receptorStyleSpec(receptorStyle, colorScheme) as never);
      if (showHetero)
        v.setStyle(
          { model: receptorModel, hetflag: true, not: { resn: ['HOH', 'WAT'] } } as never,
          { stick: { radius: 0.18, colorscheme: 'orangeCarbon' }, sphere: { scale: 0.25 } } as never,
        );
      if (showWater) v.addStyle({ model: receptorModel, resn: ['HOH', 'WAT'] } as never, { sphere: { radius: 0.25, color: '#7fb3ff' } } as never);
      if (receptorStyle === 'surface') {
        v.addSurface('VDW', { opacity: 0.85, colorscheme: { prop: 'resn', map: HYDROPHOBICITY } } as never, { model: receptorModel, hetflag: false } as never);
      }
      v.setHoverable(
        { model: receptorModel } as never,
        true,
        (atom: { resn: string; resi: number; chain: string; atom: string }, vw: GLViewer) => {
          const a = atom as unknown as { __label?: unknown };
          if (a.__label) return;
          a.__label = vw.addLabel(`${atom.resn}${atom.resi}:${atom.chain} ${atom.atom}`, {
            position: atom as never,
            backgroundColor: '#111827',
            backgroundOpacity: 0.85,
            fontColor: '#ffffff',
            fontSize: 11,
            borderRadius: 4,
          } as never);
        },
        (atom: unknown, vw: GLViewer) => {
          const a = atom as { __label?: unknown };
          if (a.__label) {
            vw.removeLabel(a.__label as never);
            delete a.__label;
          }
        },
      );
    }

    // Highlighted residues (e.g. interaction partners).
    if (receptorModel && residues.length) {
      for (const r of residues) {
        const sel = { model: receptorModel, chain: r.chain, resi: r.resi } as never;
        v.addStyle(sel, { stick: { radius: 0.16, colorscheme: 'whiteCarbon' } } as never);
        if (r.label)
          v.addLabel(r.label, {
            fontSize: 11,
            fontColor: '#ffffff',
            backgroundColor: '#334155',
            backgroundOpacity: 0.8,
            borderRadius: 4,
            inFront: true,
          } as never, { ...(sel as object), atom: 'CA' } as never);
      }
    }

    // Ligands / poses.
    const ligandModels = ligands.map((l) => {
      const m = v.addModel(l.data, l.format === 'mol' ? 'sdf' : l.format, { keepH: true });
      const carbon = l.color ?? '#22c55e';
      const op = l.opacity ?? 1;
      const scheme = { prop: 'elem', map: { C: carbon, N: '#3b6cf6', O: '#ef4444', S: '#eab308', P: '#f97316', F: '#22d3ee', Cl: '#10b981', Br: '#b45309', I: '#7c3aed', H: '#e5e7eb' } };
      const spec =
        l.style === 'spheres'
          ? { sphere: { colorscheme: scheme, opacity: op } }
          : l.style === 'lines'
            ? { line: { colorscheme: scheme, opacity: op } }
            : l.style === 'ballstick'
              ? { stick: { radius: 0.12, colorscheme: scheme, opacity: op }, sphere: { scale: 0.22, colorscheme: scheme, opacity: op } }
              : { stick: { radius: 0.18, colorscheme: scheme, opacity: op } };
      v.setStyle({ model: m } as never, spec as never);
      return m;
    });

    if (pocketSurface && receptorModel && (ligandModels.length || box)) {
      const within = ligandModels.length
        ? { model: receptorModel, hetflag: false, within: { distance: 6, sel: { model: ligandModels[0] } } }
        : null;
      if (within) v.addSurface('MS', { opacity: 0.55, color: '#e2e8f0' } as never, within as never);
    }

    // Search box.
    if (box) {
      const center = { x: box.center[0], y: box.center[1], z: box.center[2] };
      const dimensions = { w: box.size[0], h: box.size[1], d: box.size[2] };
      v.addBox({ center, dimensions, color: '#3b82f6', opacity: 0.07 } as never);
      v.addBox({ center, dimensions, color: '#3b82f6', wireframe: true, linewidth: 1.5 } as never);
    }

    for (const set of points) {
      for (const p of set.positions)
        v.addSphere({ center: { x: p[0], y: p[1], z: p[2] }, radius: set.radius ?? 0.35, color: set.color, opacity: 0.75 } as never);
    }

    for (const l of lines) {
      v.addCylinder({
        start: { x: l.from[0], y: l.from[1], z: l.from[2] },
        end: { x: l.to[0], y: l.to[1], z: l.to[2] },
        radius: l.radius ?? 0.06,
        color: l.color,
        dashed: l.dashed ?? true,
        dashLength: 0.25,
        gapLength: 0.18,
        fromCap: 1,
        toCap: 1,
      } as never);
    }

    const refocus = focusKey !== lastFocus.current;
    lastFocus.current = focusKey;
    if (refocus) {
      if (focus === 'ligands' && ligandModels.length) v.zoomTo({ model: ligandModels } as never);
      else if (focus === 'box' && box) {
        v.zoomTo({ model: receptorModel ?? undefined, within: { distance: Math.max(...box.size) / 2, sel: {} } } as never);
        v.center({ x: box.center[0], y: box.center[1], z: box.center[2] } as never);
      } else v.zoomTo();
    } else {
      v.setView(view);
    }
    v.render();
  }, [ready, receptor, receptorStyle, colorScheme, showHetero, showWater, pocketSurface, ligands, box, points, lines, residues, focusKey, focus]);

  useEffect(() => {
    const v = viewer.current;
    if (!ready || !v) return;
    if (spin) v.spin('y', 0.4);
    else v.spin(false as never);
  }, [spin, ready]);

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      try {
        return viewer.current?.pngURI() ?? null;
      } catch {
        return null;
      }
    },
    resetView: () => {
      viewer.current?.zoomTo();
      viewer.current?.render();
    },
  }));

  const empty = !receptor?.data && !ligands.length;
  return (
    <div className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <div ref={host} className="absolute inset-0" />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {error && <div className="absolute inset-0 flex items-center justify-center text-sm text-danger">{error}</div>}
      {ready && empty && placeholder && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">{placeholder}</div>
      )}
    </div>
  );
});

export default MolViewer;
