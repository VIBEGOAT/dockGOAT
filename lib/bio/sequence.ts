/**
 * Protein sequence helpers: FASTA parsing/formatting, cleaning, composition and
 * per-chain sequences extracted from a parsed structure.
 */
import { dist } from '../chem/geometry';
import { atomVec, sequences, type ResidueInfo, type Structure } from '../chem/pdb';

export interface FastaRecord {
  /** First whitespace-delimited token of the header (without '>'). */
  id: string;
  /** Rest of the header line. */
  description: string;
  /** Uppercased residues with whitespace and digits removed; other symbols ('*', '-', 'X'…) are kept. */
  sequence: string;
}

/**
 * Parse FASTA text into records. Lines starting with ';' are comments. Text
 * without any '>' header is returned as a single record with an empty id.
 */
export function parseFasta(text: string): FastaRecord[] {
  const out: FastaRecord[] = [];
  let cur: { id: string; description: string; parts: string[] } | null = null;
  const flush = () => {
    if (cur) out.push({ id: cur.id, description: cur.description, sequence: cur.parts.join('') });
  };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.startsWith('>')) {
      flush();
      const header = line.slice(1).trim();
      const sp = header.search(/\s/);
      cur = sp < 0 ? { id: header, description: '', parts: [] } : { id: header.slice(0, sp), description: header.slice(sp + 1).trim(), parts: [] };
      continue;
    }
    cur ??= { id: '', description: '', parts: [] };
    cur.parts.push(line.replace(/[\s\d]/g, '').toUpperCase());
  }
  flush();
  return out.filter((r) => r.id || r.sequence);
}

/**
 * Reduce free text to bare one-letter residues: drops FASTA header/comment
 * lines, whitespace, digits, gaps ('-', '.'), stop symbols ('*') and anything
 * that is not a letter; uppercases the rest.
 */
export function cleanSequence(s: string): string {
  return s
    .replace(/^[>;].*$/gm, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
}

export interface CompositionEntry {
  letter: string;
  count: number;
  /** Percentage of the sequence length (0-100). */
  percent: number;
}

/** Residue counts and percentages for every letter present, sorted alphabetically. */
export function composition(seq: string): CompositionEntry[] {
  const counts = new Map<string, number>();
  for (const ch of seq) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const n = seq.length;
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([letter, count]) => ({ letter, count, percent: n ? (count * 100) / n : 0 }));
}

export interface ChainSequence {
  chain: string;
  /** FASTA-friendly id, e.g. '1UBQ_A'. */
  id: string;
  /** One-letter sequence of residues with a CA atom (non-standard residues → 'X'). */
  sequence: string;
  residues: ResidueInfo[];
  /** Number of chain breaks (consecutive CA atoms more than 4.2 Å apart). */
  gaps: number;
}

/** Per-chain amino-acid sequences of a structure (wraps `sequences` from lib/chem/pdb). */
export function chainSequencesFromStructure(s: Structure): ChainSequence[] {
  const base = s.header.id || s.title || 'chain';
  return sequences(s).map(({ chain, seq, residues }) => {
    const ca = residues.map((r) => {
      const i = r.atoms.find((k) => s.atoms[k].name === 'CA');
      return i === undefined ? null : atomVec(s.atoms[i]);
    });
    let gaps = 0;
    for (let i = 1; i < ca.length; i++) {
      const a = ca[i - 1];
      const b = ca[i];
      if (a && b && dist(a, b) > 4.2) gaps++;
    }
    return { chain, id: `${base}_${chain}`, sequence: seq, residues, gaps };
  });
}

/** Format one FASTA record, wrapping the sequence at `width` characters (0 = no wrapping). */
export function formatFasta(id: string, seq: string, width = 60): string {
  const lines = [`>${id}`];
  if (width > 0) for (let i = 0; i < seq.length; i += width) lines.push(seq.slice(i, i + width));
  else if (seq) lines.push(seq);
  return lines.join('\n') + '\n';
}
