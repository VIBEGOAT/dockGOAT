// Shared Node test setup: registers a real RDKit instance for lib/chem.
import initRDKitModule from '@rdkit/rdkit';
import { registerRDKit, type RDKit } from '../lib/chem/rdkit';

let ready: Promise<RDKit> | null = null;

export function setupRDKit(): Promise<RDKit> {
  ready ??= (initRDKitModule as unknown as () => Promise<RDKit>)().then((rd) => {
    rd.prefer_coordgen(true);
    registerRDKit(rd);
    return rd;
  });
  return ready;
}
