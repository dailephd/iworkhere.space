import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    "dashboard/**",
    // Disposable local tools/proofs are not application source.
    ".my-dev-kit-workflow/**",
    // Playwright HTML/trace reports contain generated third-party JavaScript.
    "test-report/e2e/**",
    // Unmodified pinned upstream runtimes are verified by checksums, not linted.
    "public/vendor/pdfjs/6.4.299/pdf.worker.mjs",
    "public/vendor/qpdf/12.4.2/qpdf.js",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
