import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Superseded by components/ and lib/. Nothing imports these any more;
    // they are kept only until they can be deleted.
    "app/components/**",
    "app/api/**",
    "lib/job-helpers.ts",
    "lib/r2-client.ts",
    "lib/supabase-client.ts",
    "lib/mongodb.ts",
    "models/**",
    "worker/**",
    // Vendored third-party WebAssembly glue.
    "public/**",
  ]),
]);

export default eslintConfig;
