import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import stylistic from "@stylistic/eslint-plugin";
import unusedImports from "eslint-plugin-unused-imports";

/**
 * https://eslint.org/docs/latest/rules/
 * https://typescript-eslint.io/rules/
 * https://eslint.style/rules
 */
export default defineConfig([
  globalIgnores(["**/node_modules/**", "**/dist/**", "**/binbox/**", "**/build/**", "build/**", "public/**", "app/data/generated-http-client/**", ".react-router/**"]),
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  js.configs.recommended,
  tseslint.configs.recommended,

  {
    // files          : ["**/*.{ts,mts,cts}"],
    languageOptions: {
      parser       : tseslint.parser,
      parserOptions: {
        project        : "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@stylistic"    : stylistic,
      "unused-imports": unusedImports,
    },
    rules: {
      "no-case-declarations": "off",
            
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/await-thenable" : "error",
            
      "require-await"                          : "off",
      "@typescript-eslint/require-await"       : "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises" : "error",

      "@stylistic/indent"       : ["error", 2],
      "@stylistic/quotes"       : ["error", "double"],
      "@stylistic/semi"         : ["error", "always"],
      "@stylistic/comma-spacing": ["error", { before: false, after: true }],
      // "@stylistic/quote-props"  : ["error", "as-needed"],
      "@stylistic/key-spacing"  : ["error", { align: "colon"}],
      // "@stylistic/no-multi-spaces": ["error", { exceptions: { Property: true }}],

      "unused-imports/no-unused-imports" : "error",
      "no-unused-vars"                   : "off", // or "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",

      // "require-await"                   : "off",
      // "@typescript-eslint/require-await": "error"
    }
  },
  {
    files          : ["app/tools/**/handler.js"],
    languageOptions: {
      globals: {
        requirePackage: "readonly"
      }
    }
  }
]);
