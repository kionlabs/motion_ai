import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, "dist");
const files = [
  "index.html",
  "styles.css",
  "app.js",
  "career.html",
  "career.css",
  "career.js",
  "manifest.webmanifest",
  "service-worker.js"
];
const directories = ["icons", "models", "vendor"];

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const file of files) {
  const source = join(projectRoot, file);
  if (!existsSync(source)) throw new Error(`필수 파일이 없습니다: ${file}`);
  cpSync(source, join(outputRoot, file));
}

for (const directory of directories) {
  const source = join(projectRoot, directory);
  if (!existsSync(source)) throw new Error(`필수 폴더가 없습니다: ${directory}`);
  cpSync(source, join(outputRoot, directory), { recursive: true });
}

writeFileSync(join(outputRoot, ".nojekyll"), "");
console.log(`GitHub Pages 배포 파일 준비 완료: ${outputRoot}`);
