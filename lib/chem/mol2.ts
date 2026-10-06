/** Tripos MOL2 reader (first molecule or all molecules in a file). */
import { normalizeSymbol } from './elements';
import type { BondOrder, MolAtom, MolBond, Molecule } from './molecule';

export function parseMol2(text: string): Molecule[] {
  const blocks = text.replace(/\r/g, '').split('@<TRIPOS>MOLECULE').slice(1);
  return blocks.map((block) => {
    const sections: Record<string, string[]> = {};
    let current = 'MOLECULE';
    for (const line of block.split('\n')) {
      const m = line.match(/^@<TRIPOS>(\w+)/);
      if (m) {
        current = m[1];
        sections[current] = [];
        continue;
      }
      (sections[current] ??= []).push(line);
    }
    const title = (sections.MOLECULE?.find((l) => l.trim()) ?? '').trim();
    const atoms: MolAtom[] = [];
    const idToIndex = new Map<string, number>();
    for (const line of sections.ATOM ?? []) {
      const f = line.trim().split(/\s+/);
      if (f.length < 6) continue;
      const type = f[5];
      const el = normalizeSymbol(type.split('.')[0]);
      idToIndex.set(f[0], atoms.length);
      atoms.push({
        el: el === 'Lp' || el === 'Du' ? 'X' : el,
        name: f[1],
        x: parseFloat(f[2]),
        y: parseFloat(f[3]),
        z: parseFloat(f[4]),
        charge: 0,
        aromatic: type.endsWith('.ar'),
      });
    }
    const bonds: MolBond[] = [];
    for (const line of sections.BOND ?? []) {
      const f = line.trim().split(/\s+/);
      if (f.length < 4) continue;
      const a = idToIndex.get(f[1]);
      const b = idToIndex.get(f[2]);
      if (a === undefined || b === undefined) continue;
      const t = f[3];
      bonds.push({
        a,
        b,
        order: (t === '2' ? 2 : t === '3' ? 3 : 1) as BondOrder,
        aromatic: t === 'ar',
      });
    }
    return { title, atoms, bonds, props: {} };
  });
}
