// ESLint 9 flat config with type-aware typescript-eslint rules.
//
// The lint toolchain lives in tools/lint (its own package.json and lockfile)
// because typescript-eslint needs the TypeScript 6 JS API, while the app is
// built with TypeScript 7, which has no JS API. Install it once with
// `npm run lint:install`, then run `npm run lint`.
import { createRequire } from "node:module";

const require = createRequire(new URL("./tools/lint/package.json", import.meta.url));
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "tools/**",
      "crates/**",
      "docker/**",
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: { reportUnusedDisableDirectives: "warn" },
    rules: {
      // node:test's test()/describe() return promises the runner awaits itself.
      "@typescript-eslint/no-floating-promises": [
        "error",
        {
          allowForKnownSafeCalls: [
            { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
          ],
        },
      ],
      // no-misused-promises is enabled (recommendedTypeChecked) but is a
      // warning for now; see the TODO list below.

      // TODO(lint): the rules below are warnings because main has many
      // existing violations. Counts are from when this config was added
      // (src, scripts and tests together). Fix them in small PRs, then flip
      // each back to "error". `npm run lint` fails only on errors.
      "@typescript-eslint/require-await": "warn", // 396
      "@typescript-eslint/no-unnecessary-type-assertion": "warn", // 153
      "@typescript-eslint/no-unused-vars": "warn", // 148
      "@typescript-eslint/no-unsafe-member-access": "warn", // 135
      "@typescript-eslint/no-misused-promises": "warn", // 90
      "@typescript-eslint/no-unsafe-assignment": "warn", // 59
      "@typescript-eslint/no-unsafe-argument": "warn", // 43
      "@typescript-eslint/no-base-to-string": "warn", // 43
      "@typescript-eslint/no-explicit-any": "warn", // 34
      "@typescript-eslint/no-unsafe-call": "warn", // 29
      "@typescript-eslint/restrict-template-expressions": "warn", // 26
      "@typescript-eslint/no-unsafe-return": "warn", // 16
      "@typescript-eslint/no-unsafe-enum-comparison": "warn", // 13
      "@typescript-eslint/no-require-imports": "warn", // 12
      "@typescript-eslint/no-implied-eval": "warn", // 10 (tests parse served JS with new Function)
      "@typescript-eslint/no-redundant-type-constituents": "warn", // 9
      "no-control-regex": "warn", // 5 (mostly intentional control-character sanitizers)
      "no-useless-escape": "warn", // 3
      "no-misleading-character-class": "warn", // 2
      "@typescript-eslint/no-unused-expressions": "warn", // 1
      "@typescript-eslint/unbound-method": "warn", // 1
    },
  },
);
