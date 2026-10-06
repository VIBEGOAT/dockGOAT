/**
 * AutoDock Vina 1.2.3 in the browser (Webina WebAssembly build, Apache-2.0).
 *
 * The Emscripten module is built with PROXY_TO_PTHREAD, so Vina's main() runs on
 * a pthread worker and the page stays responsive. Each run gets a fresh module
 * instance; when it finishes (or is cancelled) all of its threads are torn down.
 * Requires a cross-origin isolated page (see next.config.ts headers).
 */
import type { Vec3 } from '../chem/geometry';

export type ScoringFunction = 'vina' | 'vinardo';

export interface VinaConfig {
  center: Vec3;
  size: Vec3;
  exhaustiveness: number;
  numModes: number;
  energyRange: number;
  seed?: number;
  /** Worker threads; defaults to navigator.hardwareConcurrency (max 8). */
  cpu?: number;
  scoring?: ScoringFunction;
}

export interface VinaPose {
  mode: number;
  affinity: number;
  rmsdLB: number;
  rmsdUB: number;
  inter?: number;
  intra?: number;
  /** This model's PDBQT block (MODEL…ENDMDL). */
  pdbqt: string;
  /** Coordinates in PDBQT atom order (matches PreparedLigand.atomMap). */
  coords: Vec3[];
}

export interface VinaResult {
  poses: VinaPose[];
  outputPdbqt: string;
  log: string;
  seconds: number;
  seed: number;
  threads: number;
  config: VinaConfig;
}

export type VinaPhase = 'loading' | 'setup' | 'grid' | 'search' | 'refine' | 'done';

export interface VinaCallbacks {
  /** `progress` is overall 0..1; `phase` describes the current stage. */
  onProgress?: (progress: number, phase: VinaPhase) => void;
  onLog?: (line: string) => void;
}

export interface VinaHandle {
  promise: Promise<VinaResult>;
  cancel: () => void;
}

export class VinaCancelled extends Error {
  constructor() {
    super('Docking run cancelled');
    this.name = 'VinaCancelled';
  }
}

interface EmscriptenFS {
  writeFile(path: string, data: string): void;
  readFile(path: string, opts: { encoding: 'utf8' }): string;
}
interface VinaModule {
  FS: EmscriptenFS;
  callMain(args: string[]): void;
  PThread?: { terminateAllThreads?: () => void };
}
type VinaFactory = (opts: Record<string, unknown>) => Promise<VinaModule>;

let factory: Promise<VinaFactory> | null = null;
let busy = false;

function loadFactory(): Promise<VinaFactory> {
  if (!factory) {
    const url = `${window.location.origin}/vina/vina.js`;
    factory = import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)
      .then((m: { default: VinaFactory }) => m.default)
      .catch((err) => {
        factory = null;
        throw err;
      });
  }
  return factory;
}

/** Why docking cannot run in this browser, or null if it can. */
export function vinaSupportProblem(): string | null {
  if (typeof window === 'undefined') return 'Docking runs in the browser.';
  if (typeof WebAssembly === 'undefined') return 'This browser does not support WebAssembly.';
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === 'undefined')
    return 'This page is not cross-origin isolated, so multithreaded WebAssembly is unavailable. Reload the page; if the problem persists, use a current version of Chrome, Edge, Firefox or Safari.';
  return null;
}

export function defaultThreads(): number {
  if (typeof navigator === 'undefined') return 2;
  return Math.max(1, Math.min(8, navigator.hardwareConcurrency || 2));
}

export function isVinaBusy(): boolean {
  return busy;
}

/** Vina draws a 51-character '*' progress bar during the Monte Carlo search. */
const STARS = 51;

export function runVina(receptorPdbqt: string, ligandPdbqt: string, config: VinaConfig, cb: VinaCallbacks = {}): VinaHandle {
  let cancelFn: () => void = () => {};
  const promise = new Promise<VinaResult>((resolve, reject) => {
    const problem = vinaSupportProblem();
    if (problem) return reject(new Error(problem));
    if (busy) return reject(new Error('Another docking run is in progress.'));
    busy = true;

    const threads = config.cpu ?? defaultThreads();
    const seed = config.seed ?? Math.floor(Math.random() * 2 ** 31);
    const started = performance.now();
    let mod: VinaModule | null = null;
    let finished = false;
    let log = '';
    let line = '';
    let errText = '';
    let inBar = false;
    let stars = 0;
    let phase: VinaPhase = 'loading';

    const progress = (p: number, ph: VinaPhase) => {
      phase = ph;
      cb.onProgress?.(Math.max(0, Math.min(1, p)), ph);
    };
    const finish = () => {
      finished = true;
      busy = false;
      try {
        mod?.PThread?.terminateAllThreads?.();
      } catch {
        /* threads already gone */
      }
    };
    cancelFn = () => {
      if (finished) return;
      finish();
      reject(new VinaCancelled());
    };

    const onLine = (text: string) => {
      log += text + '\n';
      cb.onLog?.(text);
      if (/^Reading input|^Setting up/.test(text)) progress(0.04, 'setup');
      else if (/^Analyzing the binding site|^Computing Vina grid|^Computing Vinardo grid/.test(text)) progress(0.08, 'grid');
      else if (/^Performing (docking|search)/.test(text)) progress(0.12, 'search');
      else if (text.startsWith('|----')) inBar = true;
      else if (/^Refining|^done\./.test(text) && phase === 'search') progress(0.95, 'refine');
    };

    progress(0.01, 'loading');
    loadFactory()
      .then((createModule) =>
        createModule({
          noInitialRun: true,
          pthreadPoolSize: threads + 1,
          mainScriptUrlOrBlob: `${window.location.origin}/vina/vina.js`,
          stdout: (code: number | null) => {
            if (code === null || code === undefined || finished) return;
            const ch = String.fromCharCode(code);
            if (ch === '\n') {
              if (inBar && line && !line.startsWith('|')) inBar = false;
              onLine(line);
              line = '';
              return;
            }
            line += ch;
            if (inBar && ch === '*') {
              stars++;
              progress(0.12 + 0.82 * Math.min(1, stars / STARS), 'search');
            }
          },
          stderr: (code: number | null) => {
            if (code === null || code === undefined) return;
            errText += String.fromCharCode(code);
          },
          onExit: (code: number) => {
            if (finished) return;
            if (line) onLine(line);
            let out = '';
            try {
              out = mod!.FS.readFile('/ligand_out.pdbqt', { encoding: 'utf8' });
            } catch {
              out = '';
            }
            finish();
            if (code !== 0 || !out) {
              const msg = (errText || log).trim().split('\n').filter(Boolean).slice(-4).join(' ');
              reject(new Error(msg ? `Vina failed: ${msg}` : `Vina exited with code ${code}`));
              return;
            }
            progress(1, 'done');
            resolve({
              poses: parseVinaOutput(out),
              outputPdbqt: out,
              log: log + (errText ? `\n${errText}` : ''),
              seconds: (performance.now() - started) / 1000,
              seed,
              threads,
              config: { ...config, seed, cpu: threads },
            });
          },
          onAbort: (what: unknown) => {
            if (finished) return;
            finish();
            reject(new Error(`Vina aborted: ${String(what)}`));
          },
        }),
      )
      .then((m) => {
        if (finished) {
          m.PThread?.terminateAllThreads?.();
          return;
        }
        mod = m;
        m.FS.writeFile('/receptor.pdbqt', receptorPdbqt);
        m.FS.writeFile('/ligand.pdbqt', ligandPdbqt);
        const f = (v: number) => (Math.round(v * 1000) / 1000).toString();
        const args = [
          '--receptor', '/receptor.pdbqt',
          '--ligand', '/ligand.pdbqt',
          '--out', '/ligand_out.pdbqt',
          '--center_x', f(config.center[0]),
          '--center_y', f(config.center[1]),
          '--center_z', f(config.center[2]),
          '--size_x', f(config.size[0]),
          '--size_y', f(config.size[1]),
          '--size_z', f(config.size[2]),
          '--exhaustiveness', String(Math.round(config.exhaustiveness)),
          '--num_modes', String(Math.round(config.numModes)),
          '--energy_range', f(config.energyRange),
          '--seed', String(seed),
          '--cpu', String(threads),
        ];
        if (config.scoring && config.scoring !== 'vina') args.push('--scoring', config.scoring);
        progress(0.03, 'setup');
        m.callMain(args);
      })
      .catch((err) => {
        if (finished) return;
        finish();
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
  return { promise, cancel: () => cancelFn() };
}

/** Parse Vina's multi-model output PDBQT. */
export function parseVinaOutput(text: string): VinaPose[] {
  const poses: VinaPose[] = [];
  const blocks = text.replace(/\r/g, '').split(/^MODEL\s+/m).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const mode = parseInt(lines[0], 10);
    const body = lines.slice(1);
    const res = body.find((l) => l.startsWith('REMARK VINA RESULT:'));
    if (!res) continue;
    const [affinity, rmsdLB, rmsdUB] = res.slice('REMARK VINA RESULT:'.length).trim().split(/\s+/).map(Number);
    const remark = (label: string) => {
      const l = body.find((x) => x.startsWith(`REMARK ${label}`));
      return l ? parseFloat(l.split(':')[1]) : undefined;
    };
    const coords: Vec3[] = [];
    for (const l of body) {
      if (!l.startsWith('ATOM') && !l.startsWith('HETATM')) continue;
      coords.push([parseFloat(l.slice(30, 38)), parseFloat(l.slice(38, 46)), parseFloat(l.slice(46, 54))]);
    }
    const end = body.findIndex((l) => l.startsWith('ENDMDL'));
    poses.push({
      mode: Number.isFinite(mode) ? mode : poses.length + 1,
      affinity,
      rmsdLB,
      rmsdUB,
      inter: remark('INTER:'),
      intra: remark('INTRA:'),
      pdbqt: `MODEL ${mode}\n${body.slice(0, end >= 0 ? end + 1 : body.length).join('\n')}\n`,
      coords,
    });
  }
  return poses;
}

/** Thermodynamic helpers (T = 298.15 K). */
const RT = 0.0019872036 * 298.15; // kcal/mol

/** Estimated dissociation constant (M) from a binding free energy (kcal/mol). */
export function kdFromDeltaG(dg: number): number {
  return Math.exp(dg / RT);
}

export function deltaGFromKd(kd: number): number {
  return RT * Math.log(kd);
}

/** Format a molar concentration with an SI prefix. */
export function formatMolar(m: number): string {
  if (!Number.isFinite(m) || m <= 0) return '—';
  const units: [number, string][] = [
    [1, 'M'],
    [1e-3, 'mM'],
    [1e-6, 'µM'],
    [1e-9, 'nM'],
    [1e-12, 'pM'],
    [1e-15, 'fM'],
  ];
  for (const [f, u] of units) if (m >= f) return `${(m / f).toPrecision(3)} ${u}`;
  return `${(m / 1e-15).toPrecision(3)} fM`;
}

/** Ligand efficiency (kcal/mol per heavy atom). */
export function ligandEfficiency(dg: number, heavyAtoms: number): number {
  return heavyAtoms > 0 ? -dg / heavyAtoms : NaN;
}
