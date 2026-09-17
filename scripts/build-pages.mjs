#!/usr/bin/env node
/*
  Study OS - GitHub Pages build
  ينسخ ملفات الموقع الثابتة فقط إلى مجلد _site (بدون mobile/ أو supabase/ أو ملفات SQL).
  لا يوجد bundling: الموقع HTML/CSS/JS خام، والـ routing عبر hash (#/route).
  كل المسارات داخل الموقع نسبية، لذا يعمل تحت أي base مثل /study-os/.
*/
import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(rootDir, "_site");

const FILES = ["index.html", "404.html", "sw.js", ".nojekyll"];
const DIRS = ["css", "js", "img"];
const SKIP = /(^|[\\/])(\.DS_Store|Thumbs\.db)$|\.bak$|\.log$/i;

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const missing = [];
for (const name of FILES) {
  const src = join(rootDir, name);
  if (!existsSync(src)) { missing.push(name); continue; }
  cpSync(src, join(outDir, name));
}
for (const name of DIRS) {
  const src = join(rootDir, name);
  if (!existsSync(src)) { missing.push(name + "/"); continue; }
  cpSync(src, join(outDir, name), { recursive: true, filter: (s) => !SKIP.test(s) });
}

if (missing.length) {
  console.error("ERROR: required site paths missing: " + missing.join(", "));
  process.exit(1);
}

let count = 0;
let bytes = 0;
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else { count++; bytes += st.size; }
  }
})(outDir);

console.log("OK: built _site/ - " + count + " files, " + (bytes / 1024).toFixed(1) + " KB");
console.log("Upload this folder to GitHub Pages (or rely on the deploy workflow).");
