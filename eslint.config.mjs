import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: configDirectory,
});

const config = [
  {
    ignores: [".next/**", "models/venv/**", "node_modules/**", "out/**"],
  },
  ...compat.extends("next/core-web-vitals"),
];

export default config;
