// Copies browser runtime assets that ship inside npm packages into /public so
// they are served as static files instead of being bundled.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = [
  ['node_modules/@rdkit/rdkit/dist/RDKit_minimal.js', 'public/rdkit/RDKit_minimal.js'],
  ['node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm', 'public/rdkit/RDKit_minimal.wasm'],
];

for (const [from, to] of assets) {
  const src = join(root, from);
  const dest = join(root, to);
  if (!existsSync(src)) {
    console.error(`copy-vendor: missing ${from} (run npm install)`);
    process.exit(1);
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}
console.log(`copy-vendor: copied ${assets.length} files`);
