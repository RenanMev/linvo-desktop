#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const nextVersion = process.argv[2];
if (!nextVersion || !/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  console.error("Uso: pnpm bump <versão semver, ex: 0.2.0>");
  process.exit(1);
}

function bumpJson(path) {
  const full = resolve(root, path);
  const json = JSON.parse(readFileSync(full, "utf8"));
  const previous = json.version;
  json.version = nextVersion;
  writeFileSync(full, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`${path}: ${previous} → ${nextVersion}`);
}

function bumpCargoToml(path) {
  const full = resolve(root, path);
  const content = readFileSync(full, "utf8");
  const match = content.match(/^version = "(.+)"$/m);
  if (!match) {
    throw new Error(`Não encontrei "version = ..." em ${path}`);
  }
  const updated = content.replace(
    /^version = "(.+)"$/m,
    `version = "${nextVersion}"`,
  );
  writeFileSync(full, updated);
  console.log(`${path}: ${match[1]} → ${nextVersion}`);
}

bumpJson("package.json");
bumpJson("apps/desktop/package.json");
bumpJson("apps/desktop/src-tauri/tauri.conf.json");
bumpCargoToml("apps/desktop/src-tauri/Cargo.toml");

console.log(`\nPróximos passos:`);
console.log(
  `  git add -A && git commit -m "chore(desktop): bump version to ${nextVersion}"`,
);
console.log(`  git tag v${nextVersion} && git push origin HEAD v${nextVersion}`);
console.log(
  `  Atualize DESKTOP_LATEST_VERSION (e MIN_SUPPORTED se necessário) na linvo-api.`,
);
