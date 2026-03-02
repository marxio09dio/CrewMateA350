import js from "@eslint/js"
import tseslint from "typescript-eslint"
import importPlugin from "eslint-plugin-import"

export default [
  {
    ignores: [
      "dist",
      "target",
      "node_modules",
      "src-tauri",
      "eslint.config.js",
      "tailwind.config.js",
      ".github",
      "actions-runner"
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: {
      import: importPlugin
    },
    rules: {
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          pathGroups: [
            {
              pattern: "@/**",
              group: "internal"
            }
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true
          }
        }
      ]
    },
    settings: {
      "import/resolver": {
        typescript: true
      }
    }
  }
]
