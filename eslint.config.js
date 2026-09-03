import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "data/images/**",
      "coverage/**",
      "dist/**"
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: globals.node
    }
  },
  js.configs.recommended
];
