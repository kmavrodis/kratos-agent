#!/usr/bin/env node
// render.mjs — inject a captured walkthrough JSON into report-template.html.
//
//   node render.mjs <capture.json> <output.html>
//
// The template contains the literal token __WALKTHROUGH_DATA__ which is replaced
// with the JSON (so the page works with zero network / fully self-contained and
// shareable). A live page may also set window.__WALKTHROUGH__ to override.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const [, , dataPath, outPath] = process.argv;
if (!dataPath || !outPath) {
  console.error("usage: node render.mjs <capture.json> <output.html>");
  process.exit(2);
}
const template = readFileSync(resolve(here, "report-template.html"), "utf8");
const data = readFileSync(resolve(dataPath), "utf8");
JSON.parse(data); // validate
const html = template.replace("__WALKTHROUGH_DATA__", () => data);
writeFileSync(resolve(outPath), html);
console.log(`[render] wrote ${outPath} (${html.length} bytes)`);
