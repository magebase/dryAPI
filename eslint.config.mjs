import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import drizzlePlugin from "eslint-plugin-drizzle";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      drizzle: drizzlePlugin,
    },
    rules: {
      ...drizzlePlugin.configs.recommended.rules,
      "drizzle/enforce-delete-with-where": [
        "error",
        {
          drizzleObjectName: [
            "db",
            "primaryDb",
            "quoteDb",
            "authDb",
            "billingDb",
            "analyticsDb",
            "metadataDb",
          ],
        },
      ],
      "drizzle/enforce-update-with-where": [
        "error",
        {
          drizzleObjectName: [
            "db",
            "primaryDb",
            "quoteDb",
            "authDb",
            "billingDb",
            "analyticsDb",
            "metadataDb",
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".source/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tina/__generated__/**",
    ".tina/**",
    "public/admin/**",
    ".open-next/**",
  ]),
]);

export default eslintConfig;
