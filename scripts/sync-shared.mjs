import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "shared", "src", "index.js");
const targetPath = path.join(rootDir, "frontend", "public", "features", "shared", "plotconnect-shared.js");

const source = await readFile(sourcePath, "utf8");
await mkdir(path.dirname(targetPath), { recursive: true });
await writeFile(
  targetPath,
  `// This file is generated from shared/src/index.js.\n// Run \`npm run sync:shared\` from the repo root after editing shared helpers.\n\n${source}`,
  "utf8"
);

console.log(`Synced shared helpers to ${path.relative(rootDir, targetPath)}`);
