/**
 * Ligand preparation: 3D molecule (explicit H) → flexible AutoDock PDBQT.
 *
 * Follows Meeko's defaults: AutoDock 4 atom typing by chemical environment,
 * Gasteiger charges, non-polar hydrogens merged into their carbons, amide C–N
 * bonds kept rigid, and a torsion tree rooted at the most central rigid
 * fragment. Vina only scores heavy atoms; polar hydrogens are kept because
 * they define which N/O atoms are H-bond donors.
 */
import { gasteigerCharges } from '../chem/gasteiger';
import { adjacency, findRings, ringBondFlags, type Molecule } from '../chem/molecule';

export interface LigandPrepOptions {
  /** Keep amide C–N bonds rigid (trans/cis as in the input). Default true. */
  rigidAmides?: boolean;
  /** Residue name written to the PDBQT. */
  resName?: string;
}

export interface PreparedLigand {
  pdbqt: string;
  /** PDBQT atom order → index in the source molecule. Vina writes poses in this order. */
  atomMap: number[];
  /** Rotatable bonds as [atomIndexA, atomIndexB] in the source molecule. */
  torsions: [number, number][];
  adTypes: string[];
  charges: number[];
  heavyAtoms: number;
  warnings: string[];
}

const SUPPORTED = new Set(['C', 'N', 'O', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'H', 'Si', 'B']);

/** AutoDock 4 atom type of every atom (Meeko's SMARTS rules, expressed on the bond graph). */
export function assignAdTypes(m: Molecule): string[] {
  const adj = adjacency(m);
  const hCount = (i: number) => adj[i].filter(([j]) => m.atoms[j].el === 'H').length;
  const isAmideLike = (i: number) =>
    adj[i].some(([j, bi]) => {
      if (m.bonds[bi].order !== 1) return false;
      const nb = m.atoms[j];
      if (nb.el !== 'C') return false;
      // C with a double bond (to anything) → amide, urea, amidine, enamine, carbamate…
      return adj[j].some(([, bj]) => m.bonds[bj].order === 2);
    });

  return m.atoms.map((a, i) => {
    switch (a.el) {
      case 'H': {
        const parent = adj[i][0]?.[0];
        const pel = parent === undefined ? '' : m.atoms[parent].el;
        return pel === 'N' || pel === 'O' || pel === 'S' || pel === 'P' || pel === 'F' ? 'HD' : 'H';
      }
      case 'C':
        return a.aromatic ? 'A' : 'C';
      case 'N': {
        const degree = adj[i].length; // explicit hydrogens included
        if (a.charge > 0) return 'N'; // ammonium, pyridinium, nitro N
        if (degree === 3 && adj[i].every(([, bi]) => m.bonds[bi].order === 1)) {
          // Trivalent N bonded to an aromatic atom (pyrrole, aniline) or amide-like C: lone pair delocalised.
          if (adj[i].some(([j]) => m.atoms[j].aromatic) || isAmideLike(i)) return 'N';
          if (a.aromatic && hCount(i) > 0) return 'N';
        }
        if (a.aromatic && degree === 3) return 'N'; // N-substituted aromatic N (e.g. N-methylimidazole N1)
        return 'NA';
      }
      case 'O':
        return 'OA';
      case 'S': {
        // Divalent sulfur (thioether, thiol, thiophene) is a weak acceptor; oxidised S is not.
        const valence = adj[i].reduce((s, [, bi]) => s + m.bonds[bi].order, 0);
        return valence === 2 ? 'SA' : 'S';
      }
      default:
        return a.el;
    }
  });
}

/**
 * Rotatable bonds: acyclic single bonds between two atoms that each carry at
 * least one other heavy atom. Bonds that only spin hydrogens (–OH, –NH2, –CH3)
 * or lie along a linear sp axis are excluded because rotating them cannot
 * change Vina's heavy-atom score.
 */
export function rotatableBonds(m: Molecule, opts: LigandPrepOptions = {}): number[] {
  const adj = adjacency(m);
  const inRing = ringBondFlags(m);
  const rigidAmides = opts.rigidAmides ?? true;
  const heavyNeighbors = (i: number) => adj[i].filter(([j]) => m.atoms[j].el !== 'H');
  const isSp = (i: number) => {
    let doubles = 0;
    for (const [, bi] of adj[i]) {
      if (m.bonds[bi].order === 3) return true;
      if (m.bonds[bi].order === 2) doubles++;
    }
    return doubles >= 2;
  };
  const isCarbonylC = (i: number) =>
    m.atoms[i].el === 'C' && adj[i].some(([j, bi]) => m.bonds[bi].order === 2 && (m.atoms[j].el === 'O' || m.atoms[j].el === 'S'));

  const out: number[] = [];
  m.bonds.forEach((b, bi) => {
    if (b.order !== 1 || b.aromatic || inRing[bi]) return;
    if (m.atoms[b.a].el === 'H' || m.atoms[b.b].el === 'H') return;
    if (heavyNeighbors(b.a).length < 2 || heavyNeighbors(b.b).length < 2) return;
    if (isSp(b.a) || isSp(b.b)) return;
    if (rigidAmides) {
      const [c, n] = m.atoms[b.a].el === 'N' ? [b.b, b.a] : [b.a, b.b];
      if (m.atoms[n].el === 'N' && isCarbonylC(c) && adj[n].length === 3) return;
    }
    out.push(bi);
  });
  return out;
}

const fmtCharge = (q: number) => {
  const s = q.toFixed(3);
  return (s.startsWith('-') ? s : `+${s}`).padStart(6);
};

function atomLine(serial: number, name: string, resName: string, x: number, y: number, z: number, q: number, type: string) {
  const nm = name.length >= 4 ? name.slice(0, 4) : ` ${name.padEnd(3)}`;
  return (
    'ATOM  ' +
    String(serial).padStart(5) +
    ' ' +
    nm +
    ' ' +
    resName.padEnd(3).slice(0, 3) +
    ' ' +
    ' ' +
    '   1' +
    '    ' +
    x.toFixed(3).padStart(8) +
    y.toFixed(3).padStart(8) +
    z.toFixed(3).padStart(8) +
    '  1.00  0.00    ' +
    fmtCharge(q) +
    ' ' +
    type.padEnd(2)
  );
}

/**
 * Build the PDBQT for a 3D ligand with explicit hydrogens.
 */
export function prepareLigand(mol: Molecule, opts: LigandPrepOptions = {}): PreparedLigand {
  const warnings: string[] = [];
  const unsupported = [...new Set(mol.atoms.map((a) => a.el).filter((el) => !SUPPORTED.has(el)))];
  if (unsupported.length) throw new Error(`Unsupported element(s) for Vina: ${unsupported.join(', ')}`);
  if (!mol.atoms.some((a) => a.el === 'H')) {
    warnings.push('Ligand has no explicit hydrogens — H-bond donors cannot be recognised.');
  }
  if (mol.atoms.every((a) => Math.abs(a.z) < 1e-3)) throw new Error('Ligand has no 3D coordinates.');

  const adj = adjacency(mol);
  const types = assignAdTypes(mol);
  const charges = gasteigerCharges(mol);

  // Merge non-polar hydrogens into their heavy atom.
  const merged = new Set<number>();
  types.forEach((t, i) => {
    if (t !== 'H') return;
    const parent = adj[i][0]?.[0];
    if (parent !== undefined) charges[parent] += charges[i];
    merged.add(i);
  });
  const keep = mol.atoms.map((_, i) => !merged.has(i));

  // Rigid fragments = components after cutting rotatable bonds.
  const rot = rotatableBonds(mol, opts);
  const rotSet = new Set(rot);
  const frag = new Array<number>(mol.atoms.length).fill(-1);
  const frags: number[][] = [];
  for (let i = 0; i < mol.atoms.length; i++) {
    if (!keep[i] || frag[i] >= 0) continue;
    const id = frags.length;
    const list: number[] = [];
    const stack = [i];
    frag[i] = id;
    while (stack.length) {
      const u = stack.pop()!;
      list.push(u);
      for (const [v, bi] of adj[u]) {
        if (!keep[v] || frag[v] >= 0 || rotSet.has(bi)) continue;
        frag[v] = id;
        stack.push(v);
      }
    }
    frags.push(list);
  }

  // Fragment tree edges.
  const fragAdj: { to: number; from: number; atomFrom: number; atomTo: number }[][] = frags.map(() => []);
  for (const bi of rot) {
    const { a, b } = mol.bonds[bi];
    fragAdj[frag[a]].push({ from: frag[a], to: frag[b], atomFrom: a, atomTo: b });
    fragAdj[frag[b]].push({ from: frag[b], to: frag[a], atomFrom: b, atomTo: a });
  }

  // Root: fragment minimising the deepest branch (ties → more atoms), like ADT's "smallest largest subtree".
  const depthFrom = (root: number) => {
    let maxDepth = 0;
    const seen = new Set([root]);
    let layer = [root];
    while (layer.length) {
      const next: number[] = [];
      for (const f of layer) for (const e of fragAdj[f]) if (!seen.has(e.to)) {
        seen.add(e.to);
        next.push(e.to);
      }
      if (next.length) maxDepth++;
      layer = next;
    }
    return maxDepth;
  };
  let root = 0;
  let best = Infinity;
  frags.forEach((f, i) => {
    const d = depthFrom(i) * 1000 - f.length;
    if (d < best) {
      best = d;
      root = i;
    }
  });

  const rings = findRings(mol);
  if (rings.some((r) => r.length >= 8)) warnings.push('Macrocycle detected: ring conformations are kept rigid during docking.');

  // Emit.
  const resName = (opts.resName ?? 'UNL').toUpperCase();
  const lines: string[] = [];
  const atomMap: number[] = [];
  const serialOf = new Map<number, number>();
  const nameByIndex = new Map<number, string>();
  const counters = new Map<string, number>();
  const nameOf = (i: number) => {
    const el = mol.atoms[i].el;
    const n = (counters.get(el) ?? 0) + 1;
    counters.set(el, n);
    const name = `${el}${n}`;
    return name.length > 4 ? `${el}${n % 100}` : name;
  };
  const emitAtom = (i: number) => {
    const serial = atomMap.length + 1;
    serialOf.set(i, serial);
    atomMap.push(i);
    const a = mol.atoms[i];
    const name = nameOf(i);
    nameByIndex.set(i, name);
    lines.push(atomLine(serial, name, resName, a.x, a.y, a.z, charges[i], types[i]));
  };
  // Within a fragment write the attachment atom first, then the rest in input order.
  const emitFragment = (f: number, first?: number) => {
    if (first !== undefined) emitAtom(first);
    for (const i of [...frags[f]].sort((x, y) => x - y)) if (i !== first) emitAtom(i);
  };

  const torsions: [number, number][] = rot.map((bi) => [mol.bonds[bi].a, mol.bonds[bi].b]);
  lines.push(`REMARK  ${rot.length} active torsions:`);
  lines.push(`REMARK  status: ('A' for Active; 'I' for Inactive)`);
  const remarkIndex = lines.length;
  lines.push('ROOT');
  emitFragment(root);
  lines.push('ENDROOT');
  const visit = (f: number, parent: number) => {
    for (const e of fragAdj[f]) {
      if (e.to === parent) continue;
      const startSerialLine = lines.length;
      lines.push(''); // placeholder for BRANCH (child serial known after emitting)
      emitFragment(e.to, e.atomTo);
      const a = serialOf.get(e.atomFrom)!;
      const b = serialOf.get(e.atomTo)!;
      lines[startSerialLine] = `BRANCH ${String(a).padStart(3)} ${String(b).padStart(3)}`;
      visit(e.to, f);
      lines.push(`ENDBRANCH ${String(a).padStart(3)} ${String(b).padStart(3)}`);
    }
  };
  visit(root, -1);
  lines.push(`TORSDOF ${rot.length}`);

  const torsionRemarks = torsions.map(
    ([a, b], k) =>
      `REMARK ${String(k + 1).padStart(4)}  A    between atoms: ${nameByIndex.get(a)}_${serialOf.get(a)}  and  ${nameByIndex.get(b)}_${serialOf.get(b)}`,
  );
  lines.splice(remarkIndex, 0, ...torsionRemarks);

  return {
    pdbqt: lines.join('\n') + '\n',
    atomMap,
    torsions,
    adTypes: types,
    charges,
    heavyAtoms: mol.atoms.filter((a) => a.el !== 'H').length,
    warnings,
  };
}
