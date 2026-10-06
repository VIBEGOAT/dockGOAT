/**
 * RCSB Protein Data Bank and AlphaFold DB clients (all CORS-enabled).
 */

export interface EntryInfo {
  id: string;
  title: string;
  method?: string;
  resolution?: number;
  releaseDate?: string;
  atomCount?: number;
  polymers: { description: string; organism?: string; chains: string[]; uniprot?: string }[];
  ligands: { id: string; name: string; weight?: number; chains: string[] }[];
}

export const PDB_ID = /^[0-9][A-Za-z0-9]{3}$/;
export const UNIPROT_ID = /^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/i;

/** Download coordinates; falls back to mmCIF for entries too large for the PDB format. */
export async function fetchStructureFile(id: string): Promise<{ text: string; format: 'pdb' | 'cif' }> {
  const pid = id.trim().toUpperCase();
  if (!PDB_ID.test(pid)) throw new Error('A PDB ID has 4 characters, e.g. 1IEP');
  const pdb = await fetch(`https://files.rcsb.org/download/${pid}.pdb`);
  if (pdb.ok) return { text: await pdb.text(), format: 'pdb' };
  const cif = await fetch(`https://files.rcsb.org/download/${pid}.cif`);
  if (cif.ok) return { text: await cif.text(), format: 'cif' };
  throw new Error(`PDB entry ${pid} was not found`);
}

const ENTRY_QUERY = `query($id:String!){entry(entry_id:$id){
  rcsb_id struct{title} exptl{method}
  rcsb_entry_info{resolution_combined deposited_atom_count}
  rcsb_accession_info{initial_release_date}
  polymer_entities{rcsb_polymer_entity{pdbx_description} rcsb_entity_source_organism{scientific_name}
    entity_poly{pdbx_strand_id}
    rcsb_polymer_entity_container_identifiers{reference_sequence_identifiers{database_name database_accession}}}
  nonpolymer_entities{nonpolymer_comp{chem_comp{id name formula_weight}}
    rcsb_nonpolymer_entity_container_identifiers{auth_asym_ids}}}}`;

interface EntryResponse {
  data?: {
    entry: {
      rcsb_id: string;
      struct?: { title?: string };
      exptl?: { method?: string }[];
      rcsb_entry_info?: { resolution_combined?: number[]; deposited_atom_count?: number };
      rcsb_accession_info?: { initial_release_date?: string };
      polymer_entities?: {
        rcsb_polymer_entity?: { pdbx_description?: string };
        rcsb_entity_source_organism?: { scientific_name?: string }[];
        entity_poly?: { pdbx_strand_id?: string };
        rcsb_polymer_entity_container_identifiers?: {
          reference_sequence_identifiers?: { database_name?: string; database_accession?: string }[];
        };
      }[];
      nonpolymer_entities?: {
        nonpolymer_comp?: { chem_comp?: { id?: string; name?: string; formula_weight?: number } };
        rcsb_nonpolymer_entity_container_identifiers?: { auth_asym_ids?: string[] };
      }[];
    } | null;
  };
}

export async function fetchEntryInfo(id: string): Promise<EntryInfo | null> {
  const res = await fetch('https://data.rcsb.org/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: ENTRY_QUERY, variables: { id: id.toUpperCase() } }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as EntryResponse;
  const e = json.data?.entry;
  if (!e) return null;
  return {
    id: e.rcsb_id,
    title: e.struct?.title ?? '',
    method: e.exptl?.[0]?.method,
    resolution: e.rcsb_entry_info?.resolution_combined?.[0],
    releaseDate: e.rcsb_accession_info?.initial_release_date?.slice(0, 10),
    atomCount: e.rcsb_entry_info?.deposited_atom_count,
    polymers: (e.polymer_entities ?? []).map((p) => ({
      description: p.rcsb_polymer_entity?.pdbx_description ?? 'Polymer',
      organism: p.rcsb_entity_source_organism?.[0]?.scientific_name,
      chains: (p.entity_poly?.pdbx_strand_id ?? '').split(',').filter(Boolean),
      uniprot: p.rcsb_polymer_entity_container_identifiers?.reference_sequence_identifiers?.find(
        (r) => r.database_name === 'UniProt',
      )?.database_accession,
    })),
    ligands: (e.nonpolymer_entities ?? []).map((n) => ({
      id: n.nonpolymer_comp?.chem_comp?.id ?? '?',
      name: n.nonpolymer_comp?.chem_comp?.name ?? '',
      weight: n.nonpolymer_comp?.chem_comp?.formula_weight,
      chains: n.rcsb_nonpolymer_entity_container_identifiers?.auth_asym_ids ?? [],
    })),
  };
}

/**
 * A bound ligand instance as SDF in the crystal frame, with bond orders
 * (RCSB ModelServer). Hydrogens are not included.
 */
export async function fetchLigandInstanceSdf(id: string, chain: string, resSeq: number): Promise<string> {
  const url = `https://models.rcsb.org/v1/${id.toLowerCase()}/ligand?auth_seq_id=${resSeq}&auth_asym_id=${encodeURIComponent(chain)}&encoding=sdf`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the ligand instance (${res.status})`);
  const text = await res.text();
  if (!text.includes('M  END') && !/V2000|V3000/.test(text)) throw new Error('RCSB returned no ligand coordinates');
  return text;
}

/** Full-text search of the PDB (returns entry IDs, best first). */
export async function searchEntries(text: string, rows = 10): Promise<string[]> {
  const res = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: { type: 'terminal', service: 'full_text', parameters: { value: text } },
      return_type: 'entry',
      request_options: { paginate: { start: 0, rows } },
    }),
  });
  if (res.status === 204) return [];
  if (!res.ok) throw new Error(`PDB search failed (${res.status})`);
  const json = (await res.json()) as { result_set?: { identifier: string }[] };
  return (json.result_set ?? []).map((r) => r.identifier);
}

export interface AlphaFoldModel {
  entryId: string;
  uniprot: string;
  description?: string;
  organism?: string;
  meanPlddt?: number;
  pdbUrl: string;
}

/** Predicted structure from AlphaFold DB for a UniProt accession. */
export async function fetchAlphaFold(uniprot: string): Promise<{ model: AlphaFoldModel; text: string }> {
  const acc = uniprot.trim().toUpperCase();
  const res = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${acc}`);
  if (res.status === 404 || res.status === 422) throw new Error(`No AlphaFold model for ${acc}`);
  if (!res.ok) throw new Error(`AlphaFold DB request failed (${res.status})`);
  const list = (await res.json()) as {
    modelEntityId?: string;
    entryId?: string;
    uniprotAccession?: string;
    uniprotDescription?: string;
    organismScientificName?: string;
    globalMetricValue?: number;
    pdbUrl: string;
  }[];
  const m = list[0];
  if (!m?.pdbUrl) throw new Error(`No AlphaFold model for ${acc}`);
  const pdb = await fetch(m.pdbUrl);
  if (!pdb.ok) throw new Error('Could not download the AlphaFold model');
  return {
    model: {
      entryId: m.modelEntityId ?? m.entryId ?? `AF-${acc}`,
      uniprot: m.uniprotAccession ?? acc,
      description: m.uniprotDescription,
      organism: m.organismScientificName,
      meanPlddt: m.globalMetricValue,
      pdbUrl: m.pdbUrl,
    },
    text: await pdb.text(),
  };
}

export function entryUrl(id: string): string {
  return `https://www.rcsb.org/structure/${id.toUpperCase()}`;
}
