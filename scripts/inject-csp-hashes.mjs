#!/usr/bin/env node
// Angular's build inlines a handful of <script>/<style> blocks (critical CSS, the hydration
// event-dispatch contract, jsaction bootstrap) whose exact bytes vary by Angular version and by
// what the app's templates/styles look like. Hardcoding CSP hashes for those in source would go
// stale on the next `ng build`. Instead, after every build, this walks the emitted HTML files,
// hashes each inline <script>/<style> it actually finds, and rewrites the CSP meta tag's
// script-src/style-src to match exactly what shipped. `<script src=...>` (external, already
// covered by 'self') and non-executable inline scripts (e.g. type="application/json" for
// Angular's ng-state transfer cache) are left alone.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const NON_EXECUTABLE_SCRIPT_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'importmap',
]);

function findHtmlFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...findHtmlFiles(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

function findBrowserOutputDirs(distDir) {
  const dirs = [];
  let projects;
  try {
    projects = readdirSync(distDir);
  } catch {
    return dirs;
  }
  for (const project of projects) {
    const browserDir = join(distDir, project, 'browser');
    try {
      if (statSync(browserDir).isDirectory()) dirs.push(browserDir);
    } catch {
      /* no browser subdir for this project — skip */
    }
  }
  return dirs;
}

function sha256(text) {
  return 'sha256-' + createHash('sha256').update(text, 'utf8').digest('base64');
}

function attrsHaveType(attrString, predicate) {
  const m = attrString.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const type = (m ? m[1] ?? m[2] : '').trim().toLowerCase();
  return predicate(type);
}

function hasSrcAttr(attrString) {
  return /\bsrc\s*=/i.test(attrString);
}

function collectHashes(html) {
  const scriptHashes = new Set();
  const styleHashes = new Set();

  // Strip HTML comments first — a naive tag regex can't tell a real <script>/<style> open tag
  // from the same literal text mentioned inside a comment (e.g. this file's own header comment).
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '');

  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(stripped))) {
    const [, attrs, body] = m;
    if (hasSrcAttr(attrs)) continue; // external — governed by script-src host list
    if (!body.trim()) continue;
    if (attrsHaveType(attrs, (t) => t !== '' && NON_EXECUTABLE_SCRIPT_TYPES.has(t))) continue;
    scriptHashes.add(sha256(body));
  }

  const styleRe = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
  while ((m = styleRe.exec(stripped))) {
    const [, , body] = m;
    if (!body.trim()) continue;
    styleHashes.add(sha256(body));
  }

  // Inline event-handler attributes (Angular's build emits one: the media=print/onload swap trick
  // used to defer non-critical CSS without render-blocking). 'unsafe-hashes' + a value hash covers
  // just that specific handler, instead of allowing all inline event handlers site-wide.
  const handlerHashes = new Set();
  const handlerRe = /\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  while ((m = handlerRe.exec(stripped))) {
    const value = m[1] ?? m[2] ?? '';
    if (!value.trim()) continue;
    handlerHashes.add(sha256(value));
  }

  return { scriptHashes: [...scriptHashes], styleHashes: [...styleHashes], handlerHashes: [...handlerHashes] };
}

function rewriteDirective(csp, directive, baseSources, hashes) {
  const tokens = [...baseSources, ...hashes.map((h) => `'${h}'`)];
  const replacement = `${directive} ${tokens.join(' ')}`;
  // Anchored so "style-src" can't match inside "style-src-elem"/"style-src-attr".
  const re = new RegExp(`(^|;\\s*)${directive}\\s+[^;]*`, 'i');
  if (!re.test(csp)) {
    throw new Error(`CSP meta tag has no "${directive}" directive to update — check src/index.html`);
  }
  return csp.replace(re, (_match, lead) => lead + replacement);
}

function processFile(path) {
  let html = readFileSync(path, 'utf8');
  const cspMatch = html.match(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i);
  if (!cspMatch) return false; // no CSP meta in this file — nothing to do

  const { scriptHashes, styleHashes, handlerHashes } = collectHashes(html);
  let csp = cspMatch[2];
  csp = rewriteDirective(csp, 'script-src', ["'self'"], scriptHashes);
  // style-src-elem covers <style>/<link> tags; style-src-attr (inline style="" attrs, left as
  // 'unsafe-inline' — see comment in src/index.html) and the style-src fallback for older browsers
  // are static and untouched here.
  csp = rewriteDirective(csp, 'style-src-elem', ["'self'", 'https://fonts.googleapis.com'], styleHashes);
  csp = rewriteDirective(csp, 'script-src-attr', ["'unsafe-hashes'"], handlerHashes);

  html = html.slice(0, cspMatch.index) + cspMatch[1] + csp + cspMatch[3] + html.slice(cspMatch.index + cspMatch[0].length);
  writeFileSync(path, html);
  console.log(
    `  ${path}: ${scriptHashes.length} script hash(es), ${styleHashes.length} style hash(es), ${handlerHashes.length} event-handler hash(es)`
  );
  return true;
}

const distDir = process.argv[2] ?? 'dist';
const browserDirs = findBrowserOutputDirs(distDir);
if (browserDirs.length === 0) {
  console.error(`No */browser output directory found under "${distDir}" — did the build run?`);
  process.exit(1);
}

console.log('Injecting CSP hashes:');
let touched = 0;
for (const dir of browserDirs) {
  for (const file of findHtmlFiles(dir)) {
    if (processFile(file)) touched++;
  }
}
if (touched === 0) {
  console.error('No HTML file contained a Content-Security-Policy meta tag — check src/index.html');
  process.exit(1);
}
