/**
 * Data tables for QED (quantitative estimate of drug-likeness).
 *
 * Bickerton, G. R.; Paolini, G. V.; Besnard, J.; Muresan, S.; Hopkins, A. L.
 * "Quantifying the chemical beauty of drugs." Nat. Chem. 2012, 4, 90-98.
 *
 * Transcribed verbatim from RDKit's rdkit/Chem/QED.py so that this engine
 * reproduces RDKit's QED rather than a near-miss. That file is BSD-3-Clause,
 * Copyright (c) 2009-2017 Novartis Institutes for BioMedical Research Inc.
 * Generated file - do not hand-edit.
 */

/** Parameters of the asymmetric double sigmoidal desirability function. */
export interface AdsParameter {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
  DMAX: number;
}

export type QedPropertyName = 'MW' | 'ALOGP' | 'HBA' | 'HBD' | 'PSA' | 'ROTB' | 'AROM' | 'ALERTS';

/** Order matters: the weight vectors below line up with it. */
export const QED_PROPERTY_NAMES: readonly QedPropertyName[] = [
  'MW',
  'ALOGP',
  'HBA',
  'HBD',
  'PSA',
  'ROTB',
  'AROM',
  'ALERTS',
];

export const QED_WEIGHT_MAX: readonly number[] = [0.50, 0.25, 0.00, 0.50, 0.00, 0.50, 0.25, 1.00];

export const QED_WEIGHT_MEAN: readonly number[] = [0.66, 0.46, 0.05, 0.61, 0.06, 0.65, 0.48, 0.95];

export const QED_WEIGHT_NONE: readonly number[] = [1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00, 1.00];

/** Ring atoms deleted before QED counts aromatic rings. */
export const QED_ALIPHATIC_RING_SMARTS = '[$([A;R][!a])]';

export const QED_ACCEPTOR_SMARTS: readonly string[] = [
  '[oH0;X2]',
  '[OH1;X2;v2]',
  '[OH0;X2;v2]',
  '[OH0;X1;v2]',
  '[O-;X1]',
  '[SH0;X2;v2]',
  '[SH0;X1;v2]',
  '[S-;X1]',
  '[nH0;X2]',
  '[NH0;X1;v3]',
  '[$([N;+0;X3;v3]);!$(N[C,S]=O)]',
];

/** The 116 structural alerts QED counts as the ALERTS property. */
export const QED_ALERT_SMARTS: readonly string[] = [
  '*1[O,S,N]*1',
  '[S,C](=[O,S])[F,Br,Cl,I]',
  '[CX4][Cl,Br,I]',
  '[#6]S(=O)(=O)O[#6]',
  '[$([CH]),$(CC)]#CC(=O)[#6]',
  '[$([CH]),$(CC)]#CC(=O)O[#6]',
  'n[OH]',
  '[$([CH]),$(CC)]#CS(=O)(=O)[#6]',
  'C=C(C=O)C=O',
  'n1c([F,Cl,Br,I])cccc1',
  '[CH1](=O)',
  '[#8][#8]',
  '[C;!R]=[N;!R]',
  '[N!R]=[N!R]',
  '[#6](=O)[#6](=O)',
  '[#16][#16]',
  '[#7][NH2]',
  'C(=O)N[NH2]',
  '[#6]=S',
  '[$([CH2]),$([CH][CX4]),$(C([CX4])[CX4])]=[$([CH2]),$([CH][CX4]),$(C([CX4])[CX4])]',
  'C1(=[O,N])C=CC(=[O,N])C=C1',
  'C1(=[O,N])C(=[O,N])C=CC=C1',
  'a21aa3a(aa1aaaa2)aaaa3',
  'a31a(a2a(aa1)aaaa2)aaaa3',
  'a1aa2a3a(a1)A=AA=A3=AA=A2',
  'c1cc([NH2])ccc1',
  '[Hg,Fe,As,Sb,Zn,Se,se,Te,B,Si,Na,Ca,Ge,Ag,Mg,K,Ba,Sr,Be,Ti,Mo,Mn,Ru,Pd,Ni,Cu,Au,Cd,Al,Ga,Sn,Rh,Tl,Bi,Nb,Li,Pb,Hf,Ho]',
  'I',
  'OS(=O)(=O)[O-]',
  '[N+](=O)[O-]',
  'C(=O)N[OH]',
  'C1NC(=O)NC(=O)1',
  '[SH]',
  '[S-]',
  'c1ccc([Cl,Br,I,F])c([Cl,Br,I,F])c1[Cl,Br,I,F]',
  'c1cc([Cl,Br,I,F])cc([Cl,Br,I,F])c1[Cl,Br,I,F]',
  '[CR1]1[CR1][CR1][CR1][CR1][CR1][CR1]1',
  '[CR1]1[CR1][CR1]cc[CR1][CR1]1',
  '[CR2]1[CR2][CR2][CR2][CR2][CR2][CR2][CR2]1',
  '[CR2]1[CR2][CR2]cc[CR2][CR2][CR2]1',
  '[CH2R2]1N[CH2R2][CH2R2][CH2R2][CH2R2][CH2R2]1',
  '[CH2R2]1N[CH2R2][CH2R2][CH2R2][CH2R2][CH2R2][CH2R2]1',
  'C#C',
  '[OR2,NR2]@[CR2]@[CR2]@[OR2,NR2]@[CR2]@[CR2]@[OR2,NR2]',
  '[$([N+R]),$([n+R]),$([N+]=C)][O-]',
  '[#6]=N[OH]',
  '[#6]=NOC=O',
  '[#6](=O)[CX4,CR0X3,O][#6](=O)',
  'c1ccc2c(c1)ccc(=O)o2',
  '[O+,o+,S+,s+]',
  'N=C=O',
  '[NX3,NX4][F,Cl,Br,I]',
  'c1ccccc1OC(=O)[#6]',
  '[CR0]=[CR0][CR0]=[CR0]',
  '[C+,c+,C-,c-]',
  'N=[N+]=[N-]',
  'C12C(NC(N1)=O)CSC2',
  'c1c([OH])c([OH,NH2,NH])ccc1',
  'P',
  '[N,O,S]C#N',
  'C=C=O',
  '[Si][F,Cl,Br,I]',
  '[SX2]O',
  '[SiR0,CR0](c1ccccc1)(c2ccccc2)(c3ccccc3)',
  'O1CCCCC1OC2CCC3CCCCC3C2',
  'N=[CR0][N,n,O,S]',
  '[cR2]1[cR2][cR2]([Nv3X3,Nv4X4])[cR2][cR2][cR2]1[cR2]2[cR2][cR2][cR2]([Nv3X3,Nv4X4])[cR2][cR2]2',
  'C=[C!r]C#N',
  '[cR2]1[cR2]c([N+0X3R0,nX3R0])c([N+0X3R0,nX3R0])[cR2][cR2]1',
  '[cR2]1[cR2]c([N+0X3R0,nX3R0])[cR2]c([N+0X3R0,nX3R0])[cR2]1',
  '[cR2]1[cR2]c([N+0X3R0,nX3R0])[cR2][cR2]c1([N+0X3R0,nX3R0])',
  '[OH]c1ccc([OH,NH2,NH])cc1',
  'c1ccccc1OC(=O)O',
  '[SX2H0][N]',
  'c12ccccc1(SC(S)=N2)',
  'c12ccccc1(SC(=S)N2)',
  'c1nnnn1C=O',
  's1c(S)nnc1NC=O',
  'S1C=CSC1=S',
  'C(=O)Onnn',
  'OS(=O)(=O)C(F)(F)F',
  'N#CC[OH]',
  'N#CC(=O)',
  'S(=O)(=O)C#N',
  'N[CH2]C#N',
  'C1(=O)NCC1',
  'S(=O)(=O)[O-,OH]',
  'NC[F,Cl,Br,I]',
  'C=[C!r]O',
  '[NX2+0]=[O+0]',
  '[OR0,NR0][OR0,NR0]',
  'C(=O)O[C,H1].C(=O)O[C,H1].C(=O)O[C,H1]',
  '[CX2R0][NX3R0]',
  'c1ccccc1[C;!R]=[C;!R]c2ccccc2',
  '[NX3R0,NX4R0,OR0,SX2R0][CX4][NX3R0,NX4R0,OR0,SX2R0]',
  '[s,S,c,C,n,N,o,O]~[n+,N+](~[s,S,c,C,n,N,o,O])(~[s,S,c,C,n,N,o,O])~[s,S,c,C,n,N,o,O]',
  '[s,S,c,C,n,N,o,O]~[nX3+,NX3+](~[s,S,c,C,n,N])~[s,S,c,C,n,N]',
  '[*]=[N+]=[*]',
  '[SX3](=O)[O-,OH]',
  'N#N',
  'F.F.F.F',
  '[R0;D2][R0;D2][R0;D2][R0;D2]',
  '[cR,CR]~C(=O)NC(=O)~[cR,CR]',
  'C=!@CC=[O,S]',
  '[#6,#8,#16][#6](=O)O[#6]',
  'c[C;R0](=[O,S])[#6]',
  'c[SX2][C;!R]',
  'C=C=C',
  'c1nc([F,Cl,Br,I,S])ncc1',
  'c1ncnc([F,Cl,Br,I,S])c1',
  'c1nc(c2c(n1)nc(n2)[F,Cl,Br,I])',
  '[#6]S(=O)(=O)c1ccc(cc1)F',
  '[15N]',
  '[13C]',
  '[18O]',
  '[34S]',
];

export const QED_ADS_PARAMETERS: Record<QedPropertyName, AdsParameter> = {
  MW: { A: 2.817065973, B: 392.5754953, C: 290.7489764, D: 2.419764353, E: 49.22325677, F: 65.37051707, DMAX: 104.9805561 },
  ALOGP: { A: 3.172690585, B: 137.8624751, C: 2.534937431, D: 4.581497897, E: 0.822739154, F: 0.576295591, DMAX: 131.3186604 },
  HBA: { A: 2.948620388, B: 160.4605972, C: 3.615294657, D: 4.435986202, E: 0.290141953, F: 1.300669958, DMAX: 148.7763046 },
  HBD: { A: 1.618662227, B: 1010.051101, C: 0.985094388, D: 0.000000001, E: 0.713820843, F: 0.920922555, DMAX: 258.1632616 },
  PSA: { A: 1.876861559, B: 125.2232657, C: 62.90773554, D: 87.83366614, E: 12.01999824, F: 28.51324732, DMAX: 104.5686167 },
  ROTB: { A: 0.010000000, B: 272.4121427, C: 2.558379970, D: 1.565547684, E: 1.271567166, F: 2.758063707, DMAX: 105.4420403 },
  AROM: { A: 3.217788970, B: 957.7374108, C: 2.274627939, D: 0.000000001, E: 1.317690384, F: 0.375760881, DMAX: 312.3372610 },
  ALERTS: { A: 0.010000000, B: 1199.094025, C: -0.09002883, D: 0.000000001, E: 0.185904477, F: 0.875193782, DMAX: 417.7253140 },
};
