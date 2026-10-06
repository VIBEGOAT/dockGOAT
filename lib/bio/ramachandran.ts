/**
 * Backbone φ/ψ dihedrals and Ramachandran region classification.
 *
 * Regions come from the MolProbity Top8000 percentile contour grids (Williams
 * et al. 2018, Protein Sci. 27:293-315; methodology of Lovell et al. 2003,
 * Proteins 50:437-450), data from https://github.com/rlabduke/reference_data
 * (Top8000/Top8000_ramachandran_pct_contour_grids, © Richardson Lab, Duke
 * University, CC BY 4.0). Each 2°×2° grid value was thresholded with
 * MolProbity's cut-offs (favoured ≥ 0.02; allowed ≥ 0.0005 for general,
 * ≥ 0.002 for cis-Pro, ≥ 0.001 otherwise) and run-length encoded below.
 *
 * Approximation: MolProbity interpolates the density between grid points; here
 * a point takes the class of the 2° bin it falls in, so residues within ~1° of
 * a contour can be classified differently from MolProbity. Contours are not
 * smoothed. Use this for a quick quality overview, not as a validation report.
 */
import { dihedral, dist, type Vec3 } from '../chem/geometry';
import { AMINO_ACIDS, atomVec, residues, type Structure } from '../chem/pdb';

export type RamaKind = 'general' | 'glycine' | 'proline' | 'pre-proline';
export type RamaRegion = 'favoured' | 'allowed' | 'outlier';
/** MolProbity table used to classify a residue (finer than `RamaKind`). */
export type RamaTable = 'general' | 'ile-val' | 'glycine' | 'trans-proline' | 'cis-proline' | 'pre-proline';

export const RAMA_TABLES: readonly RamaTable[] = ['general', 'ile-val', 'glycine', 'trans-proline', 'cis-proline', 'pre-proline'];

export interface RamaPoint {
  /** Residue key as produced by `residueKey` in lib/chem/pdb ('A:GLY10'). */
  key: string;
  resName: string;
  resSeq: number;
  iCode: string;
  chain: string;
  phi: number;
  psi: number;
  /** ω of the preceding peptide bond, CA(i−1)–C(i−1)–N–CA; null if CA(i−1) is missing. */
  omega: number | null;
  kind: RamaKind;
  table: RamaTable;
  region: RamaRegion;
}

/** Grid size: 180 × 180 bins of 2°, psi-major, bin i covers [−180 + 2i, −178 + 2i). */
export const RAMA_BINS = 180;
export const RAMA_STEP = 2;

/** Run-length encoded class grids: 'o' outlier, 'a' allowed, 'f' favoured, followed by the run length. */
const RLE: Record<RamaTable, string> = {
  'general':
    'a4f51a6o58a12o45a8f50a6o58a13o45a9f48a6o59a12o46a10f46a6o59a13o47a10f24a9f11a7o59a12o48a12f17a17' +
    'f7a7o60a12o49a13f11a34o60a13o50a14f5a38o60a12o52a55o60a13o53a54o60a13o54a52o60a14o54a51o61a14o54' +
    'a50o61a14o56a48o62a14o56a48o61a15o57a46o62a15o58a45o61a15o60a43o62a15o61a42o61a16o62a41o61a16o63' +
    'a39o61a16o66a37o61a16o68a35o60a17o69a33o60a18o70a32o60a8f2a8o70a32o59a8f4a8o69a31o60a8f4a8o69a31' +
    'o60a9f3a8o69a31o60a9f3a9o68a31o60a21o68a31o60a21o68a31o60a21o68a31o60a20o68a32o61a19o68a33o60a19' +
    'o68a33o61a18o68a33o62a16o69a34o62a15o69a34o64a13o69a34o65a11o70a34o66a10o70a35o67a7o71a35o69a2o7' +
    '4a36o143a37o143a38o141a39o141a40o139a42o137a45o135a47o132a50o65a4o61a52o62a7o59a54o5a4o50a9o58a6' +
    '6o46a10o58a67o45a11o57a68o43a12o57a69o42a13o56a69o42a13o56a40f4a3f11a11o42a13o56a22f4a8f26a9o42a' +
    '13o56a21f40a8o42a13o56a20f41a7o42a14o57a19f41a7o42a14o57a19f41a7o42a14o57a19f41a6o43a14o57a18f42' +
    'a6o43a14o57a18f42a5o44a14o57a18f42a4o45a14o57a17f42a5o45a14o57a17f42a4o46a14o57a16f42a5o46a13o58' +
    'a16f42a4o47a14o56a16f42a4o49a13o56a16f42a4o49a13o56a16f41a4o50a14o55a15f42a3o52a14o54a15f41a4o52' +
    'a15o53a14f42a3o53a16o52a14f41a3o54a17o51a14f41a3o54a18o51a13f40a3o55a18o51a12f40a4o55a18o51a12f4' +
    '0a3o56a18o51a12f39a4o55a19o51a12f38a4o56a19o51a12f38a4o56a19o51a12f37a4o56a7f4a9o50a12f37a4o57a6' +
    'f5a9o50a12f36a5o56a6f6a8o51a11f37a4o57a5f7a8o51a11f36a4o57a6f7a7o52a11f35a5o57a5f8a7o52a10f35a5o' +
    '57a5f9a6o52a11f34a5o58a4f9a7o52a11f32a7o57a5f9a6o53a11f31a7o57a5f10a6o53a11f30a7o58a4f10a7o53a11' +
    'f30a6o58a5f10a7o53a11f29a7o58a4f11a6o53a12f28a7o59a4f11a6o53a12f27a8o58a4f11a7o53a12f26a9o58a3f1' +
    '2a6o54a13f24a10o57a4f12a6o54a13f23a11o56a4f12a7o54a13f22a12o56a4f12a6o55a13f21a13o55a4f13a6o55a1' +
    '3f20a14o55a4f12a7o55a13f19a16o53a4f13a6o56a13f16a19o53a4f12a7o56a13f14a21o52a4f13a7o55a14f13a22o' +
    '52a4f13a6o56a14f11a24o51a4f13a7o56a15f8a27o50a4f13a6o57a15f6a29o49a5f13a6o57a16f4a19f3a8o48a6f12' +
    'a6o58a16f3a19f5a7o48a5f13a6o58a37f7a6o47a6f13a6o58a36f9a5o47a7f11a7o57a37f9a5o47a7f11a7o57a37f9a' +
    '5o46a9f9a8o57a37f10a5o45a11f6a9o57a36f11a5o45a26o57a36f11a5o46a25o57a36f11a5o46a26o56a36f12a4o47' +
    'a25o55a37f12a4o48a24o55a36f13a4o49a23o55a36f13a4o52a21o54a36f13a4o55a18o54a21f1a13f14a4o57a16o54' +
    'a19f7a8f15a4o58a15o53a17f33a4o59a14o53a16f34a5o60a12o53a15f35a5o61a11o52a15f36a5o62a10o52a13f38a' +
    '6o62a9o52a12f39a6o63a8o52a11f41a6o63a8o51a10f42a6o63a8o50a11f43a7o62a7o50a10f44a9o60a8o49a10f45a' +
    '11o57a8o49a10f46a15o52a9o48a10f46a18o49a9o47a10f48a18o49a8o47a10f50a17o48a8o47a9f53a15o49a6o48a9' +
    'f56a13o48a6o48a9f58a11o49a4o49a9f59a10o51a1o50a8f61a9o102a8f62a7o102a8f63a7o102a8f63a6o103a8f63a' +
    '6o53a2o48a7f64a5o53a4o46a8f63a6o52a6o45a8f63a5o52a7o45a7f63a6o52a7o45a7f63a5o53a7o45a7f62a5o53a9' +
    'o43a7f63a5o53a9o43a7f62a5o53a10o43a7f62a4o53a11o42a7f62a5o53a11o42a7f61a5o53a12o41a8f61a5o53a13o' +
    '40a7f61a5o53a14o40a7f61a5o53a14o40a7f60a5o53a15o40a6f61a4o54a15o40a6f60a5o54a15o40a6f59a5o54a15o' +
    '41a6f59a4o55a15o41a6f58a5o55a15o41a7f56a5o56a14o42a7f55a6o56a14o42a7f54a6o57a13o43a8f52a6o58a13o' +
    '43a5',
  'ile-val':
    'o10a10f8a31o132a47o134a44o136a43o138a39o142a36o145a32o148a30o151a27o154a24o157a21o160a18o163a15o' +
    '167a11o171a6o5043a2o175a8o170a13o166a16o163a19o160a21o158a24o155a26o153a28o151a30o149a33o147a36o' +
    '68a4o71a43o60a8o68a48o55a10o67a51o51a12o66a52o49a13o65a14f4a36o48a14o64a12f17a26o47a14o64a11f35a' +
    '10o46a14o64a10f38a8o45a15o64a10f39a7o46a14o64a10f40a6o46a14o64a10f41a6o45a14o63a12f40a5o47a12o64' +
    'a12f40a5o47a11o65a13f39a5o48a9o66a13f39a5o50a6o67a14f38a5o123a15f36a5o124a16f35a5o124a16f35a4o12' +
    '5a17f34a4o125a16f34a5o125a15f35a4o126a13f36a4o127a12f37a4o127a11f37a4o128a10f38a4o128a10f37a4o12' +
    '9a9f37a5o129a9f37a4o130a9f36a5o130a9f35a5o131a8f36a4o132a8f35a4o133a8f34a5o133a8f32a6o134a8f30a8' +
    'o134a8f28a9o135a8f26a10o136a9f24a10o137a9f22a11o138a9f21a11o139a9f20a12o139a9f19a12o140a9f18a11o' +
    '141a10f17a11o142a10f16a11o143a10f15a11o144a10f13a12o145a10f12a12o64a7o75a11f10a12o63a10o74a11f8a' +
    '13o63a12o73a13f3a15o63a13o73a30o63a15o72a29o63a16o72a28o63a18o71a27o63a19o72a26o63a19o72a25o63a2' +
    '0o72a25o63a21o71a26o62a21o71a27o61a21o71a29o59a21o71a31o57a21o72a32o55a21o72a34o54a20o72a35o53a2' +
    '0o72a36o53a19o72a36o54a17o73a37o55a15o73a37o56a13o74a38o57a11o74a38o59a7o75a39o141a39o141a40o140' +
    'a40o140a40o140a29f2a9o140a28f4a8o139a28f5a9o138a27f7a8o137a26f9a8o137a12f24a8o135a11f26a8o135a10' +
    'f28a8o133a10f30a8o132a9f31a8o132a9f32a8o130a9f34a8o129a9f34a9o128a8f36a10o125a9f37a10o124a8f39a1' +
    '1o121a9f40a11o119a9f43a10o117a10f45a9o116a9f47a9o114a10f49a7o113a10f51a7o111a11f52a6o111a10f53a6' +
    'o110a10f54a6o109a10f55a6o109a9f56a6o108a9f57a5o109a8f57a6o108a9f57a6o108a8f57a6o109a8f56a7o109a7' +
    'f57a6o110a7f56a6o111a7f55a7o111a7f55a6o112a8f53a6o113a8f53a6o113a10f50a6o114a12f47a7o115a12f45a7' +
    'o116a13f29a1f13a8o117a12f26a8f7a9o118a13f24a25o119a12f22a26o121a12f20a26o124a11f17a28o125a11f14a' +
    '29o128a10f12a29o120',
  'glycine':
    'f60a3o54a3f119a4o53a3f120a4o53a3f119a4o53a3f120a4o53a3f120a4o52a4f119a4o53a3f120a4o52a4f119a4o53' +
    'a3f120a4o52a4f119a4o53a4f119a4o53a3f119a4o53a4f119a3o54a3f119a4o53a4f118a5o53a3f119a4o53a4f118a5' +
    'o52a4f119a5o52a4f118a5o52a4f119a5o52a4f118a6o51a4f72a11f36a6o51a4f70a15f33a6o51a5f69a17f32a6o51a' +
    '5f66a21f30a7o51a4f62a27f29a6o52a5f57a32f27a7o52a5f54a36f26a7o52a5f52a40f23a8o52a6f49a44f21a7o54a' +
    '5f47a48f18a8o54a6f44a51f17a8o55a7f40a54f16a8o55a9f36a56f16a8o56a10f31a60f14a9o58a10f28a61f14a9o6' +
    '0a13f21a64f12a10o62a15f16a65f12a10o64a14f13a68f11a11o65a12f12a69f10a12o66a12f9a72f9a12o67a12f6a4' +
    '2o7a25f9a12o68a12f3a41o18a18f8a13o68a53o22a17f7a13o68a51o25a17f5a15o68a50o26a36o68a50o27a36o67a5' +
    '0o28a36o66a50o29a37o64a51o28a40o61a52o28a45o55a7f4a41o29a47o52a6f5a42o28a48o51a5f7a41o28a50o49a5' +
    'f7a42o28a50o48a5f8a41o28a29f11a10o48a4f9a41o28a26f16a9o47a4f9a42o27a25f19a7o47a4f10a41o27a24f21a' +
    '6o47a4f10a41o27a22f23a6o47a4f10a41o27a21f25a5o47a4f10a42o26a20f26a5o47a4f10a42o26a19f27a5o46a5f1' +
    '0a42o25a19f28a5o46a5f10a42o25a18f29a4o47a5f10a42o24a18f30a4o47a6f10a41o23a18f31a4o47a6f10a41o23a' +
    '17f31a4o48a7f10a40o22a16f33a4o48a7f21a28o22a16f33a4o49a7f25a24o22a15f34a3o50a8f27a21o21a15f35a3o' +
    '50a8f30a18o21a14f35a3o51a8f31a16o21a14f36a3o51a7f33a15o21a13f36a3o52a7f33a14o21a13f37a3o52a7f33a' +
    '14o21a12f38a2o53a7f33a13o22a11f38a3o53a6f34a12o22a11f39a2o54a6f34a11o23a10f39a3o54a5f35a11o23a10' +
    'f39a2o55a5f35a10o23a10f39a3o55a4f36a10o23a9f40a2o56a4f36a10o23a9f39a3o55a4f37a9o23a9f39a3o56a3f3' +
    '8a9o22a9f40a3o55a4f38a9o22a9f39a3o56a3f38a9o22a9f39a3o56a3f39a9o22a8f39a4o55a3f39a9o22a9f39a3o55' +
    'a4f39a8o22a9f39a3o56a3f39a9o22a9f38a3o56a3f39a9o22a9f38a4o55a3f40a9o22a9f38a3o56a3f39a9o23a9f37a' +
    '4o55a3f39a9o23a10f36a4o56a2f40a9o23a10f36a4o55a3f39a10o23a10f35a5o55a2f39a10o23a11f35a5o54a3f39a' +
    '10o23a11f34a6o54a2f39a11o22a12f34a6o53a3f38a11o22a13f33a7o53a2f38a12o21a14f33a7o52a3f37a13o21a14' +
    'f33a7o52a3f36a13o21a15f33a7o51a3f36a14o21a16f31a8o51a3f35a14o21a18f30a8o50a3f35a15o21a21f27a8o50' +
    'a3f34a15o22a24f25a7o49a4f33a16o22a28f21a7o48a4f33a16o22a40f10a7o48a4f31a17o23a41f10a6o47a4f31a18' +
    'o23a41f10a6o47a4f30a18o24a42f10a5o47a4f29a18o25a42f10a5o46a5f28a19o25a42f10a5o46a5f27a19o26a42f1' +
    '0a4o47a5f26a20o26a42f10a4o47a5f25a21o27a41f10a4o47a6f23a22o27a41f10a4o47a6f21a24o27a41f10a4o47a7' +
    'f19a25o27a42f9a4o47a9f16a26o28a41f9a4o48a10f11a29o28a41f8a5o48a50o28a42f7a5o49a50o28a41f7a5o51a4' +
    '8o28a42f5a6o52a47o29a41f4a7o55a45o28a52o61a40o28a51o64a37o29a50o66a36o28a50o67a36o27a50o68a36o26' +
    'a50o68a15f5a17o25a51o68a13f7a17o22a53o68a13f8a18o18a41f3a12o68a12f9a25o7a42f6a12o67a12f9a72f9a12' +
    'o66a12f10a69f12a12o65a11f11a68f13a14o64a10f12a65f16a15o62a10f12a64f21a13o60a9f14a61f28a10o58a9f1' +
    '4a60f31a10o56a8f16a56f36a9o55a8f16a54f40a7o55a8f17a51f44a6o54a8f18a48f47a5o54a7f21a44f49a6o52a8f' +
    '23a40f52a5o52a7f26a36f54a5o52a7f27a32f57a5o52a6f29a27f62a4o51a7f30a21f66a5o51a6f32a17f69a5o51a6f' +
    '33a15f70a4o51a6f36a11f72a4o51a6f118a4o52a5f119a4o52a5f118a4o52a5f119a4o52a5f118a4o53a4f119a3o53a' +
    '5f118a4o53a4f119a3o54a3f119a4o53a4f119a3o53a4f119a4o53a4f119a4o52a4f120a3o53a4f119a4o52a4f120a3o' +
    '53a4f119a4o52a4f120a3o53a4f120a3o53a4f119a3o53a4f120a3o53a4f119a3o54a3f60',
  'trans-proline':
    'o38a8f10a5o157a8f9a6o158a9f5a7o159a20o161a19o161a18o163a16o165a14o167a12o170a9o175a1o8294a8o169a' +
    '13o165a16o162a19o160a20o158a9f5a8o157a7f10a7o155a7f12a6o155a6f13a6o154a6f14a5o155a5f15a5o154a5f1' +
    '6a4o154a6f16a4o153a6f16a4o153a6f17a3o154a5f18a3o153a6f17a4o152a6f18a3o152a6f19a3o151a6f19a3o151a' +
    '6f20a3o151a6f19a3o151a6f20a3o150a6f20a3o151a6f20a3o150a6f20a3o151a6f19a3o151a6f20a3o150a7f19a3o1' +
    '51a6f19a3o151a7f19a3o151a6f19a3o152a6f18a4o151a7f17a4o152a7f16a4o153a7f14a6o153a7f13a6o154a7f12a' +
    '6o155a8f10a6o156a8f9a6o157a9f7a7o158a9f4a8o159a21o159a21o160a20o160a20o161a19o161a19o162a18o163a' +
    '17o163a18o163a17o163a17o163a17o163a17o163a17o163a18o162a7f4a7o162a6f6a6o162a5f7a6o162a5f8a5o162a' +
    '5f8a5o162a4f9a5o162a4f10a4o162a4f10a4o162a4f10a4o162a4f10a4o162a4f10a4o162a4f10a4o162a4f10a4o162' +
    'a5f8a5o163a4f8a5o163a4f8a5o163a5f7a5o163a6f5a6o163a6f4a7o163a17o163a17o163a17o163a17o163a18o162a' +
    '18o162a18o162a19o161a19o161a20o160a22o158a8f4a13o155a7f7a13o152a8f8a14o150a7f10a14o149a7f15a9o14' +
    '8a8f18a7o147a7f21a5o147a7f22a5o145a8f22a5o145a7f24a4o145a7f24a4o145a7f24a4o144a7f25a4o144a7f25a3' +
    'o145a7f25a3o145a6f25a4o145a6f25a4o144a7f25a3o145a6f25a4o145a6f25a4o145a6f25a3o146a6f24a3o146a7f2' +
    '4a3o146a7f23a3o147a7f23a3o147a7f22a3o148a7f22a3o148a7f21a4o148a7f21a3o149a7f20a3o150a7f19a4o150a' +
    '7f19a4o150a7f18a4o151a8f16a4o153a7f15a4o154a7f14a5o154a8f12a5o118',
  'cis-proline':
    'o30a7f24a5o145a6f23a6o145a7f22a5o147a8f19a5o149a8f18a5o150a8f16a5o152a8f14a6o152a9f12a6o154a9f10' +
    'a7o155a10f7a8o156a23o158a22o159a20o160a20o161a18o163a16o165a14o168a11o171a7o8454a9o169a14o164a17' +
    'o162a20o159a22o157a23o156a10f6a9o154a9f10a8o152a8f13a7o151a8f15a6o151a7f16a6o150a7f18a6o148a7f19' +
    'a6o147a6f21a5o148a5f22a5o147a5f23a5o146a6f23a5o146a5f24a5o145a5f24a5o145a5f25a5o145a5f24a5o145a5' +
    'f25a5o145a5f25a5o144a5f25a5o145a5f25a5o144a6f24a5o145a6f24a5o145a6f23a6o145a6f23a5o146a6f23a5o14' +
    '6a6f22a5o147a6f22a5o147a6f21a5o149a5f21a5o149a5f20a5o150a5f20a4o151a5f19a5o152a4f19a4o153a4f18a5' +
    'o153a5f16a5o154a5f16a5o154a5f15a5o154a6f15a5o154a6f14a5o155a7f12a6o155a7f12a5o156a8f10a6o156a8f8' +
    'a7o157a9f6a8o157a22o158a22o158a21o160a20o160a19o161a19o162a17o164a15o166a13o168a11o171a7o2704a8o' +
    '169a13o165a17o162a19o160a21o158a23o156a11f3a11o155a8f9a8o154a8f12a7o153a7f14a7o151a7f16a6o151a6f' +
    '18a6o150a6f18a7o148a7f19a7o147a6f21a7o146a6f23a6o145a6f24a6o144a6f25a5o144a6f26a5o143a6f26a5o143' +
    'a5f28a4o142a6f28a5o141a6f29a4o141a6f29a4o141a5f30a4o141a5f30a4o140a6f30a4o140a6f30a4o140a5f31a4o' +
    '139a6f31a3o140a6f30a4o139a6f31a4o139a6f31a4o139a5f31a4o140a5f31a4o139a6f30a4o140a6f29a5o140a6f29' +
    'a4o142a5f28a5o142a6f26a5o143a6f26a5o113',
  'pre-proline':
    'a61o116a63o117a62o119a59o124a55o127a51o131a24o6a16o138a5o8138a11o166a19o159a27o151a30o148a33o146' +
    'a15f4a16o144a14f10a13o142a14f14a10o141a14f17a9o140a14f18a8o139a14f19a8o138a15f20a7o138a14f21a6o1' +
    '38a15f21a6o138a15f20a6o138a16f20a6o138a16f19a6o138a17f19a6o138a17f18a6o138a19f16a6o139a20f15a5o1' +
    '40a21f13a5o140a23f11a6o140a24f9a6o141a25f7a7o141a38o142a37o143a37o143a36o144a35o145a33o148a31o14' +
    '9a29o151a28o152a24o157a11o169a8o174a2o2147a5o173a8o170a12o166a14o165a16o80a7o76a18o76a12o72a20o7' +
    '5a15o69a22o73a17o66a24o72a19o64a25o70a22o61a28o68a23o59a30o66a10f4a12o56a17f5a10o65a9f8a10o55a17' +
    'f8a8o64a9f10a10o53a16f11a8o62a9f12a9o52a16f12a8o61a9f13a9o51a15f15a7o60a10f14a9o50a13f17a7o60a9f' +
    '15a9o49a12f20a6o59a10f15a9o49a11f21a6o59a10f15a9o49a10f22a6o58a11f14a11o47a10f23a6o58a12f13a11o4' +
    '7a10f23a6o58a13f11a12o47a10f24a6o57a14f8a14o47a10f24a6o57a36o47a9f25a6o57a35o48a10f24a7o57a34o48' +
    'a10f25a7o56a34o47a11f25a8o56a32o48a11f26a8o55a32o48a12f26a8o56a29o49a12f26a10o55a27o50a12f27a10o' +
    '57a22o52a12f28a10o67a9o54a13f28a10o129a13f29a11o127a13f31a10o126a13f32a13o6a12o104a13f33a32o102a' +
    '14f34a31o101a14f37a29o100a14f39a28o99a14f43a24o99a14f46a22o98a14f52a16o98a14f55a13o98a14f56a12o9' +
    '7a14f58a11o97a14f58a11o97a14f58a11o97a13f59a11o97a13f60a9o98a12f61a9o98a11f61a9o99a10f62a9o99a10' +
    'f62a9o98a10f63a8o99a10f63a7o100a10f63a7o100a9f63a7o101a9f63a7o100a10f62a7o50a5o46a9f63a6o50a8o44' +
    'a9f62a7o49a10o42a9f63a6o49a12o41a9f62a7o48a13o41a9f62a6o49a13o40a9f62a7o49a13o40a9f62a7o49a13o40' +
    'a9f61a7o50a13o40a9f60a8o50a13o40a9f59a8o52a11o41a10f58a7o53a11o41a10f57a7o55a9o43a10f55a7o58a5o4' +
    '5a11f52a8o109a12f50a8o111a13f7a4f9a15f11a9o112a52f3a12o114a4',
};

const grids = new Map<RamaTable, Uint8Array>();

/** Class grid for a table (0 outlier, 1 allowed, 2 favoured), index = psiBin * 180 + phiBin. */
export function ramaGrid(table: RamaTable): Uint8Array {
  let g = grids.get(table);
  if (g) return g;
  g = new Uint8Array(RAMA_BINS * RAMA_BINS);
  let at = 0;
  for (const m of RLE[table].matchAll(/([oaf])(\d+)/g)) {
    const len = parseInt(m[2], 10);
    g.fill(m[1] === 'f' ? 2 : m[1] === 'a' ? 1 : 0, at, at + len);
    at += len;
  }
  if (at !== g.length) throw new Error(`Corrupt Ramachandran grid '${table}'`);
  grids.set(table, g);
  return g;
}

function bin(angle: number): number {
  const a = ((((angle + 180) % 360) + 360) % 360) / RAMA_STEP;
  return Math.min(RAMA_BINS - 1, Math.floor(a));
}

/** Classify a (φ, ψ) pair against one of the Top8000 tables. */
export function classifyRama(table: RamaTable, phi: number, psi: number): RamaRegion {
  const v = ramaGrid(table)[bin(psi) * RAMA_BINS + bin(phi)];
  return v === 2 ? 'favoured' : v === 1 ? 'allowed' : 'outlier';
}

/** Table used to draw the background for a residue kind ('proline' → trans-Pro). */
export function tableForKind(kind: RamaKind): RamaTable {
  return kind === 'proline' ? 'trans-proline' : kind;
}

export interface RamaOutlines {
  /** Closed rectilinear polygons ([φ, ψ] vertices, degrees) enclosing favoured bins. */
  favoured: [number, number][][];
  /** Polygons enclosing allowed-or-better bins (contains the favoured area). */
  allowed: [number, number][][];
}

const outlineCache = new Map<RamaTable, RamaOutlines>();

/**
 * Region outlines for drawing a plot background. Outer boundaries run
 * counter-clockwise and holes clockwise, so fill with the 'evenodd' rule.
 * Regions touching ±180° are cut at the plot edge (no wrapping).
 */
export function ramaOutlines(tableOrKind: RamaTable | RamaKind): RamaOutlines {
  const table = tableOrKind === 'proline' ? 'trans-proline' : tableOrKind;
  let o = outlineCache.get(table);
  if (!o) {
    const g = ramaGrid(table);
    o = { favoured: trace(g, 2), allowed: trace(g, 1) };
    outlineCache.set(table, o);
  }
  return o;
}

/** Trace the boundary loops of bins with class ≥ `min` (inside on the left of each edge). */
function trace(g: Uint8Array, min: number): [number, number][][] {
  const N = RAMA_BINS;
  const W = N + 1;
  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && g[j * N + i] >= min;
  const next = new Map<number, number[]>(); // vertex → end vertices of unused edges
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const k = y0 * W + x0;
    const list = next.get(k);
    if (list) list.push(y1 * W + x1);
    else next.set(k, [y1 * W + x1]);
  };
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      if (!inside(i, j)) continue;
      if (!inside(i, j - 1)) add(i, j, i + 1, j);
      if (!inside(i + 1, j)) add(i + 1, j, i + 1, j + 1);
      if (!inside(i, j + 1)) add(i + 1, j + 1, i, j + 1);
      if (!inside(i - 1, j)) add(i, j + 1, i, j);
    }
  const loops: [number, number][][] = [];
  for (const start of [...next.keys()]) {
    while (next.get(start)?.length) {
      const verts: number[] = [start];
      let cur = start;
      for (;;) {
        const outs = next.get(cur);
        if (!outs?.length) break;
        const to = outs.pop()!;
        if (to === start) break;
        verts.push(to);
        cur = to;
      }
      // Drop collinear vertices, then convert lattice points to degrees.
      const pts = verts.map((v) => [v % W, Math.floor(v / W)] as const);
      const keep = pts.filter((p, k) => {
        const a = pts[(k - 1 + pts.length) % pts.length];
        const b = pts[(k + 1) % pts.length];
        return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
      });
      loops.push(keep.map(([x, y]) => [x * RAMA_STEP - 180, y * RAMA_STEP - 180]));
    }
  }
  return loops;
}

interface Backbone {
  key: string;
  resName: string;
  resSeq: number;
  iCode: string;
  chain: string;
  N?: Vec3;
  CA?: Vec3;
  C?: Vec3;
}

export interface RamaOptions {
  /** Maximum C(i−1)–N(i) distance (Å) accepted as a peptide bond. Default 2.0. */
  maxPeptideBond?: number;
  /** |ω| below this (degrees) marks a cis peptide, classified with the cis-Pro table for Pro. Default 30. */
  cisOmega?: number;
}

/**
 * φ/ψ for every amino-acid residue with N, CA and C whose neighbours are
 * peptide-bonded to it (chain breaks and termini give no point), classified
 * MolProbity-style: Gly → glycine; Pro → trans/cis-Pro; residue before a
 * bonded Pro → pre-proline; Ile/Val → ile-val table (kind 'general'); else general.
 */
export function ramachandran(s: Structure, opts: RamaOptions = {}): RamaPoint[] {
  const maxBond = opts.maxPeptideBond ?? 2.0;
  const cisOmega = opts.cisOmega ?? 30;
  const byChain = new Map<string, Backbone[]>();
  for (const r of residues(s)) {
    if (!AMINO_ACIDS.has(r.resName)) continue;
    const bb: Backbone = { key: r.key, resName: r.resName, resSeq: r.resSeq, iCode: r.iCode, chain: r.chain };
    for (const i of r.atoms) {
      const a = s.atoms[i];
      if (a.name === 'N' || a.name === 'CA' || a.name === 'C') bb[a.name] = atomVec(a);
    }
    const list = byChain.get(r.chain);
    if (list) list.push(bb);
    else byChain.set(r.chain, [bb]);
  }

  const out: RamaPoint[] = [];
  for (const list of byChain.values()) {
    const bonded = (a: Backbone | undefined, b: Backbone | undefined) =>
      !!(a?.C && b?.N && dist(a.C, b.N) < maxBond);
    for (let i = 0; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      const nxt = list[i + 1];
      if (!cur.N || !cur.CA || !cur.C || !bonded(prev, cur) || !bonded(cur, nxt)) continue;
      const phi = dihedral(prev.C!, cur.N, cur.CA, cur.C);
      const psi = dihedral(cur.N, cur.CA, cur.C, nxt.N!);
      const omega = prev.CA ? dihedral(prev.CA, prev.C!, cur.N, cur.CA) : null;

      let kind: RamaKind;
      let table: RamaTable;
      if (cur.resName === 'GLY') kind = table = 'glycine';
      else if (cur.resName === 'PRO') {
        kind = 'proline';
        table = omega !== null && Math.abs(omega) < cisOmega ? 'cis-proline' : 'trans-proline';
      } else if (nxt.resName === 'PRO') kind = table = 'pre-proline';
      else {
        kind = 'general';
        table = cur.resName === 'ILE' || cur.resName === 'VAL' ? 'ile-val' : 'general';
      }
      out.push({
        key: cur.key,
        resName: cur.resName,
        resSeq: cur.resSeq,
        iCode: cur.iCode,
        chain: cur.chain,
        phi,
        psi,
        omega,
        kind,
        table,
        region: classifyRama(table, phi, psi),
      });
    }
  }
  return out;
}

export interface RamaCounts {
  total: number;
  favoured: number;
  allowed: number;
  outlier: number;
}

export interface RamaSummary extends RamaCounts {
  /** Percentages of `total` (0-100; 0 when there are no points). */
  favouredPct: number;
  allowedPct: number;
  outlierPct: number;
  byKind: Record<RamaKind, RamaCounts>;
  outliers: RamaPoint[];
}

/** Counts and percentages per region, overall and per residue kind. */
export function ramachandranSummary(points: RamaPoint[]): RamaSummary {
  const zero = (): RamaCounts => ({ total: 0, favoured: 0, allowed: 0, outlier: 0 });
  const all = zero();
  const byKind: Record<RamaKind, RamaCounts> = {
    general: zero(),
    glycine: zero(),
    proline: zero(),
    'pre-proline': zero(),
  };
  for (const p of points) {
    for (const c of [all, byKind[p.kind]]) {
      c.total++;
      c[p.region]++;
    }
  }
  const pct = (k: number) => (all.total ? (k * 100) / all.total : 0);
  return {
    ...all,
    favouredPct: pct(all.favoured),
    allowedPct: pct(all.allowed),
    outlierPct: pct(all.outlier),
    byKind,
    outliers: points.filter((p) => p.region === 'outlier'),
  };
}
