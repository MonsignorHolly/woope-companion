// Copies renderer files tsc doesn't touch (HTML/CSS) into dist/, alongside
// the compiled JS they sit next to. Run as part of `build`/`dev`.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const STATIC_FILES = [
  ["src/renderer/pairing/index.html", "dist/renderer/pairing/index.html"],
  ["src/renderer/pairing/pairing.css", "dist/renderer/pairing/pairing.css"],
];

for (const [from, to] of STATIC_FILES) {
  const src = path.join(ROOT, from);
  const dest = path.join(ROOT, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

console.log(`Copied ${STATIC_FILES.length} static renderer file(s) to dist/.`);
