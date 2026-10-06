/**
 * PubChem PUG REST client (CORS-enabled, no key required).
 * https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 */

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

export interface PubChemCompound {
  cid: number;
  title: string;
  iupacName?: string;
  formula?: string;
  molecularWeight?: number;
  smiles: string;
  inchiKey?: string;
  xlogp?: number;
  tpsa?: number;
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new Error(`PubChem request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export class NotFoundError extends Error {
  constructor(message = 'Not found in PubChem') {
    super(message);
    this.name = 'NotFoundError';
  }
}

const PROPS = 'Title,IUPACName,MolecularFormula,MolecularWeight,SMILES,ConnectivitySMILES,InChIKey,XLogP,TPSA';

interface PropTable {
  PropertyTable: {
    Properties: {
      CID: number;
      Title?: string;
      IUPACName?: string;
      MolecularFormula?: string;
      MolecularWeight?: string | number;
      SMILES?: string;
      ConnectivitySMILES?: string;
      IsomericSMILES?: string;
      CanonicalSMILES?: string;
      InChIKey?: string;
      XLogP?: number;
      TPSA?: number;
    }[];
  };
}

function toCompound(p: PropTable['PropertyTable']['Properties'][number]): PubChemCompound {
  return {
    cid: p.CID,
    title: p.Title ?? `CID ${p.CID}`,
    iupacName: p.IUPACName,
    formula: p.MolecularFormula,
    molecularWeight: p.MolecularWeight !== undefined ? Number(p.MolecularWeight) : undefined,
    smiles: p.SMILES ?? p.IsomericSMILES ?? p.ConnectivitySMILES ?? p.CanonicalSMILES ?? '',
    inchiKey: p.InChIKey,
    xlogp: p.XLogP,
    tpsa: p.TPSA,
  };
}

/** Look up compounds by name/synonym (best matches first). */
export async function searchByName(name: string, limit = 5): Promise<PubChemCompound[]> {
  const q = encodeURIComponent(name.trim());
  const data = await getJSON<PropTable>(`${BASE}/compound/name/${q}/property/${PROPS}/JSON`);
  return data.PropertyTable.Properties.slice(0, limit).map(toCompound);
}

export async function getByCid(cid: number): Promise<PubChemCompound> {
  const data = await getJSON<PropTable>(`${BASE}/compound/cid/${cid}/property/${PROPS}/JSON`);
  return toCompound(data.PropertyTable.Properties[0]);
}

/** CID for an exact structure (InChIKey match), or null. */
export async function cidForInchiKey(inchiKey: string): Promise<number | null> {
  try {
    const data = await getJSON<{ IdentifierList: { CID: number[] } }>(
      `${BASE}/compound/inchikey/${encodeURIComponent(inchiKey)}/cids/JSON`,
    );
    return data.IdentifierList.CID[0] ?? null;
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

/** PubChem's computed 3D conformer (OMEGA) as SDF, or null when none exists. */
export async function get3DSdf(cid: number): Promise<string | null> {
  const res = await fetch(`${BASE}/compound/cid/${cid}/SDF?record_type=3d`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`PubChem 3D conformer request failed (${res.status})`);
  return res.text();
}

/** Name suggestions for a search box. */
export async function autocomplete(term: string, limit = 8): Promise<string[]> {
  if (term.trim().length < 2) return [];
  const res = await fetch(
    `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(term.trim())}/json?limit=${limit}`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { dictionary_terms?: { compound?: string[] } };
  return data.dictionary_terms?.compound ?? [];
}

export function compoundUrl(cid: number): string {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}
