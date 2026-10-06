/**
 * Toxicity-related structural alerts.
 *
 * These are *alerts*, not predictions: a hit means the molecule contains a
 * substructure that published work associates with a liability, which is a
 * reason to look closer, not a computed probability of harm.
 *
 * Ames toxicophores follow the structural definitions approved in
 *   Kazius, J.; McGuire, R.; Bursi, R. "Derivation and Validation of
 *   Toxicophores for Mutagenicity Prediction." J. Med. Chem. 2005, 48,
 *   312-320.
 * The paper publishes its toxicophores as annotated structures (SMARTS are in
 * its supporting information, which is not redistributable here), so the
 * SMARTS below are our own encodings of those published definitions - they
 * reproduce the described chemistry but are not byte-identical to the
 * authors' strings. Two polycyclic-aromatic patterns are taken from RDKit's
 * QED alert list (BSD-3-Clause).
 *
 * Bioactivation / hepatotoxicity alerts follow
 *   Kalgutkar, A. S. et al. "A Comprehensive Listing of Bioactivation Pathways
 *   of Organic Functional Groups." Curr. Drug Metab. 2005, 6, 161-225, and
 *   Stepan, A. F. et al. "Structural Alert/Reactive Metabolite Concept..."
 *   Chem. Res. Toxicol. 2011, 24, 1345-1410.
 */

export interface ToxPattern {
  readonly name: string;
  readonly smarts: string;
  readonly description: string;
}

/** Ames mutagenicity toxicophores (Kazius et al. 2005). */
export const AMES_TOXICOPHORES: readonly ToxPattern[] = [
  {
    name: 'aromatic_nitro',
    // [OX1] covers both the pentavalent (=O) and charge-separated ([O-]) forms.
    smarts: '[a]-[NX3](=[OX1])[OX1]',
    description: 'Aromatic nitro group; reduced to a nitrenium ion that alkylates DNA.',
  },
  {
    name: 'aromatic_amine',
    smarts:
      '[c;!$(c[NX3](=[OX1])[OX1])]-[NX3;!$(N=O);!$(N-[!#6;!#1]);!$(N-C=[O,S,N]);!$(N-S(=O)=O)]',
    description: 'Aromatic amine; N-hydroxylated and esterified to a DNA-reactive nitrenium ion.',
  },
  {
    name: 'aromatic_n_oxide',
    smarts: '[nX3+][OX1-]',
    description: 'Aromatic N-oxide.',
  },
  {
    name: 'three_membered_heterocycle',
    smarts: '*1[O,S,N]*1',
    description: 'Epoxide, aziridine or thiirane; direct-acting alkylating agent.',
  },
  {
    name: 'n_nitroso',
    smarts: '[NX3]-[NX2]=[OX1]',
    description: 'N-nitroso (nitrosamine); alpha-hydroxylated to an alkyl-diazonium ion.',
  },
  {
    name: 'aliphatic_nitroso',
    smarts: '[CX4]-[NX2]=[OX1]',
    description: 'Aliphatic C-nitroso group.',
  },
  {
    name: 'aromatic_nitroso',
    smarts: '[c]-[NX2]=[OX1]',
    description: 'Aromatic nitroso group; oxidation state between aromatic amine and nitro.',
  },
  {
    name: 'unsubstituted_heteroatom_bonded_heteroatom',
    smarts: '[$([NX3;H1,H2]-[NX3]),$([NX3;H1,H2]-[OX2]),$([OX2H1]-[NX3]),$([SX2H1]-[SX2])]',
    description: 'Hydrazine, hydroxylamine or related N-N / N-O / S-S bond carrying a hydrogen.',
  },
  {
    name: 'aromatic_hydroxylamine',
    smarts: '[c]-[NX3;H0,H1]-[OX2H1]',
    description: 'Aromatic hydroxylamine; proximate mutagen of aromatic amines and nitro compounds.',
  },
  {
    name: 'azo_type',
    smarts: '[#6]-[NX2]=[NX2]-[#6]',
    description: 'Azo group; reductively cleaved to two aromatic amines.',
  },
  {
    name: 'azoxy',
    smarts: '[#6]-[NX2]=[NX3+]([OX1-])-[#6]',
    description: 'Azoxy group.',
  },
  {
    name: 'aliphatic_halide',
    smarts: '[CX4][Cl,Br,I]',
    description: 'Aliphatic halide (Cl, Br, I); alkylating agent.',
  },
  {
    name: 'carboxylic_acid_halide',
    smarts: '[CX3](=[OX1])[F,Cl,Br,I]',
    description: 'Acyl halide; strongly electrophilic acylating agent.',
  },
  {
    name: 'nitrogen_or_sulfur_mustard',
    smarts: '[Cl,Br,I][CX4][CX4][NX3,SX2]',
    description: 'Mustard; forms a cyclic onium ion that cross-links DNA.',
  },
  {
    name: 'polycyclic_aromatic_system_1',
    smarts: 'a21aa3a(aa1aaaa2)aaaa3',
    description: 'Polycyclic aromatic system; epoxidised to bay-region diol epoxides.',
  },
  {
    name: 'polycyclic_aromatic_system_2',
    smarts: 'a31a(a2a(aa1)aaaa2)aaaa3',
    description: 'Polycyclic aromatic system (angular fusion).',
  },
  {
    name: 'alkyl_nitrite',
    smarts: '[CX4]-[OX2]-[NX2]=[OX1]',
    description: 'Alkyl nitrite ester.',
  },
  {
    name: 'alkyl_nitrate',
    smarts: '[$([CX4]-[OX2]-[NX3](=O)=O),$([CX4]-[OX2]-[NX3+](=O)[OX1-])]',
    description: 'Alkyl nitrate ester.',
  },
  {
    name: 'aliphatic_n_nitro',
    smarts: '[$([NX3]-[NX3](=O)=O),$([NX3]-[NX3+](=O)[OX1-])]',
    description: 'N-nitro group (nitramine).',
  },
  {
    name: 'alpha_beta_unsaturated_aldehyde',
    smarts: '[CX3H1](=[OX1])-[CX3]=[CX3]',
    description: 'Alpha,beta-unsaturated aldehyde; Michael acceptor that adducts DNA bases.',
  },
  {
    name: 'n_methylol',
    smarts: '[NX3]-[CH2]-[OX2H1]',
    description: 'N-methylol; releases formaldehyde.',
  },
  {
    name: 'monohaloalkene',
    smarts: '[CX3;!$(C([F,Cl,Br,I])[F,Cl,Br,I])](=[CX3])[F,Cl,Br,I]',
    description: 'Monohaloalkene; epoxidised to a reactive halo-oxirane.',
  },
  {
    name: 'propiolactone_or_propiosultone',
    smarts: '[$([OX2]1[CX3](=[OX1])[CX4][CX4]1),$([OX2]1[SX4](=[OX1])(=[OX1])[CX4][CX4]1)]',
    description: 'Beta-propiolactone or propiosultone; strained, direct-acting alkylator.',
  },
  {
    name: 'sulfonate_bonded_carbon',
    smarts: '[$([CX4][OX2][SX4](=[OX1])(=[OX1])),$([CX4][OX2][SX3](=[OX1]))]',
    description: 'Alkyl sulfonate or sulfate ester; alkylating leaving group.',
  },
  {
    name: 'azide',
    smarts: '[#6]-[NX2]=[NX2+]=[NX1-]',
    description: 'Organic azide.',
  },
];

/** Reactive-metabolite / hepatotoxicity alerts (Kalgutkar 2005; Stepan 2011). */
export const BIOACTIVATION_ALERTS: readonly ToxPattern[] = [
  {
    name: 'aniline',
    smarts: '[c]-[NX3;H1,H2;!$(N-C=[O,S]);!$(N-S(=O)=O)]',
    description: 'Aniline; oxidised to quinone-imine or nitroso metabolites.',
  },
  {
    name: 'para_aminophenol',
    smarts: '[OX2H1]-c1ccc([NX3])cc1',
    description: 'para-Aminophenol; classic quinone-imine precursor (paracetamol motif).',
  },
  {
    name: 'thiophene',
    smarts: 'c1ccsc1',
    description: 'Thiophene; oxidised to a reactive S-oxide or thiophene epoxide.',
  },
  {
    name: 'furan',
    smarts: 'c1ccoc1',
    description: 'Furan; oxidised to a reactive cis-enedione.',
  },
  {
    name: 'hydrazine_or_hydrazide',
    smarts: '[NX3]-[NX3]',
    description: 'Hydrazine or hydrazide; forms acyl/alkyl radicals and diazonium species.',
  },
  {
    name: 'thiourea_or_thioamide',
    smarts: '[NX3]-[CX3]=[SX1]',
    description: 'Thiourea or thioamide; oxidised to reactive sulfenes.',
  },
  {
    name: 'terminal_alkyne',
    smarts: '[CX2H1]#[CX2]',
    description: 'Terminal alkyne; mechanism-based P450 inactivator via ketene formation.',
  },
  {
    name: 'michael_acceptor',
    smarts: '[CX3]=[CX3]-[CX3]=[OX1]',
    description: 'Michael acceptor; conjugates with glutathione and protein thiols.',
  },
  {
    name: 'aldehyde',
    smarts: '[CX3H1](=[OX1])[#6]',
    description: 'Aldehyde; protein cross-linker, oxidised to the acid.',
  },
  {
    name: 'carboxylic_acid',
    smarts: '[CX3](=[OX1])[OX2H1]',
    description: 'Carboxylic acid; forms reactive acyl glucuronides and acyl-CoA thioesters.',
  },
  {
    name: 'quinone',
    smarts: '[$([OX1]=C1C=CC(=[OX1])C=C1),$([OX1]=C1C(=[OX1])C=CC=C1)]',
    description: 'Quinone; redox cycles and arylates nucleophiles directly.',
  },
  {
    name: 'isocyanate_or_isothiocyanate',
    smarts: '[NX2]=[CX2]=[OX1,SX1]',
    description: 'Isocyanate or isothiocyanate; carbamoylates proteins.',
  },
];
