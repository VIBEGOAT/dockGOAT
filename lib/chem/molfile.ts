/**
 * MDL molfile / SDF reader and writer (V2000, plus a V3000 reader).
 */
import { normalizeSymbol } from './elements';
import type { BondOrder, MolAtom, MolBond, Molecule } from './molecule';

const V2000_CHARGE: Record<number, number> = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };

function parseV2000(lines: string[], title: string): Molecule {
  const counts = lines[3] ?? '';
  const nAtoms = parseInt(counts.slice(0, 3), 10);
  const nBonds = parseInt(counts.slice(3, 6), 10);
  if (!Number.isFinite(nAtoms) || !Number.isFinite(nBonds)) throw new Error('Malformed molfile counts line');

  const atoms: MolAtom[] = [];
  for (let i = 0; i < nAtoms; i++) {
    const l = lines[4 + i];
    if (l === undefined) throw new Error('Molfile atom block is truncated');
    const chgCode = parseInt(l.slice(36, 39), 10) || 0;
    atoms.push({
      x: parseFloat(l.slice(0, 10)),
      y: parseFloat(l.slice(10, 20)),
      z: parseFloat(l.slice(20, 30)),
      el: normalizeSymbol(l.slice(31, 34)),
      charge: V2000_CHARGE[chgCode] ?? 0,
      aromatic: false,
    });
  }

  const bonds: MolBond[] = [];
  for (let i = 0; i < nBonds; i++) {
    const l = lines[4 + nAtoms + i];
    if (l === undefined) throw new Error('Molfile bond block is truncated');
    const a = parseInt(l.slice(0, 3), 10) - 1;
    const b = parseInt(l.slice(3, 6), 10) - 1;
    const type = parseInt(l.slice(6, 9), 10);
    const stereo = parseInt(l.slice(9, 12), 10) || 0;
    bonds.push({
      a,
      b,
      order: (type === 2 || type === 3 ? type : 1) as BondOrder,
      aromatic: type === 4,
      stereo,
    });
  }

  // Properties block: M  CHG overrides the atom-block charge column.
  let chgSeen = false;
  for (let i = 4 + nAtoms + nBonds; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('M  END')) break;
    if (l.startsWith('M  CHG')) {
      if (!chgSeen) {
        atoms.forEach((a) => (a.charge = 0));
        chgSeen = true;
      }
      const n = parseInt(l.slice(6, 9), 10);
      for (let k = 0; k < n; k++) {
        const idx = parseInt(l.slice(10 + k * 8, 13 + k * 8), 10) - 1;
        const chg = parseInt(l.slice(14 + k * 8, 17 + k * 8), 10);
        if (atoms[idx]) atoms[idx].charge = chg;
      }
    }
  }

  return { title, atoms, bonds, props: {} };
}

function parseV3000(lines: string[], title: string): Molecule {
  const atoms: MolAtom[] = [];
  const bonds: MolBond[] = [];
  const idToIndex = new Map<number, number>();
  let block: 'atom' | 'bond' | null = null;
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (!l.startsWith('M  V30 ')) continue;
    // Continuation lines end with '-'.
    while (l.endsWith('-') && i + 1 < lines.length) l = l.slice(0, -1) + lines[++i].slice(7);
    const body = l.slice(7).trim();
    if (body.startsWith('BEGIN ATOM')) block = 'atom';
    else if (body.startsWith('BEGIN BOND')) block = 'bond';
    else if (body.startsWith('END')) block = null;
    else if (block === 'atom') {
      const f = body.split(/\s+/);
      const chg = body.match(/CHG=(-?\d+)/);
      idToIndex.set(parseInt(f[0], 10), atoms.length);
      atoms.push({
        el: normalizeSymbol(f[1]),
        x: parseFloat(f[2]),
        y: parseFloat(f[3]),
        z: parseFloat(f[4]),
        charge: chg ? parseInt(chg[1], 10) : 0,
        aromatic: false,
      });
    } else if (block === 'bond') {
      const f = body.split(/\s+/);
      const type = parseInt(f[1], 10);
      const cfg = body.match(/CFG=(\d)/);
      bonds.push({
        a: idToIndex.get(parseInt(f[2], 10))!,
        b: idToIndex.get(parseInt(f[3], 10))!,
        order: (type === 2 || type === 3 ? type : 1) as BondOrder,
        aromatic: type === 4,
        stereo: cfg ? ({ 1: 1, 2: 4, 3: 6 } as Record<string, number>)[cfg[1]] ?? 0 : 0,
      });
    }
  }
  return { title, atoms, bonds, props: {} };
}

/** Parse a single molfile record (no $$$$ / data fields). */
export function parseMolfile(text: string): Molecule {
  const lines = text.replace(/\r/g, '').split('\n');
  const title = (lines[0] ?? '').trim();
  const counts = lines[3] ?? '';
  return counts.includes('V3000') ? parseV3000(lines, title) : parseV2000(lines, title);
}

/** Parse a (possibly multi-record) SDF file, including `> <FIELD>` data items. */
export function parseSDF(text: string): Molecule[] {
  const records = text.replace(/\r/g, '').split(/^\$\$\$\$\s*$/m);
  const mols: Molecule[] = [];
  for (let r = 0; r < records.length; r++) {
    const rec = records[r];
    if (!rec.trim()) continue;
    // Records after the first start with the newline that followed '$$$$'.
    // (The first record may legitimately start with an empty title line.)
    const body = r > 0 ? rec.replace(/^\n/, '') : rec;
    const endIdx = body.indexOf('M  END');
    if (endIdx < 0) continue;
    const molText = body.slice(0, endIdx + 6);
    const mol = parseMolfile(molText);
    const dataText = body.slice(endIdx + 6);
    const re = /^>\s*.*?<([^>]+)>.*\n([\s\S]*?)(?=\n\s*\n|\n>|$)/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(dataText))) mol.props[m[1].trim()] = m[2].trim();
    mols.push(mol);
  }
  return mols;
}

const fmt = (v: number, w: number, d: number) => v.toFixed(d).padStart(w);
const int = (v: number, w: number) => String(v).padStart(w);

/** Write a V2000 molfile. Aromatic bonds are written in their Kekulé form. */
export function writeMolfile(m: Molecule, program = 'dockGOAT'): string {
  const is3D = m.atoms.some((a) => Math.abs(a.z) > 1e-4);
  const out: string[] = [];
  out.push(m.title || '');
  out.push(`  ${program.slice(0, 8).padEnd(8)}          ${is3D ? '3D' : '2D'}`);
  out.push('');
  out.push(`${int(m.atoms.length, 3)}${int(m.bonds.length, 3)}  0  0  0  0  0  0  0  0999 V2000`);
  for (const a of m.atoms) {
    out.push(
      `${fmt(a.x, 10, 4)}${fmt(a.y, 10, 4)}${fmt(a.z, 10, 4)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`,
    );
  }
  for (const b of m.bonds) {
    out.push(`${int(b.a + 1, 3)}${int(b.b + 1, 3)}${int(b.order, 3)}${int(b.stereo ?? 0, 3)}`);
  }
  const charged = m.atoms.map((a, i) => [i, a.charge] as const).filter(([, c]) => c !== 0);
  for (let i = 0; i < charged.length; i += 8) {
    const chunk = charged.slice(i, i + 8);
    out.push(`M  CHG${int(chunk.length, 3)}${chunk.map(([idx, c]) => `${int(idx + 1, 4)}${int(c, 4)}`).join('')}`);
  }
  out.push('M  END');
  return out.join('\n');
}

/** Write a multi-record SDF with data fields. */
export function writeSDF(mols: Molecule[]): string {
  return mols
    .map((m) => {
      const fields = Object.entries(m.props)
        .map(([k, v]) => `> <${k}>\n${v}\n`)
        .join('\n');
      return `${writeMolfile(m)}\n${fields}${fields ? '\n' : ''}$$$$`;
    })
    .join('\n') + '\n';
}
