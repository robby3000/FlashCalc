// Stamps the service worker cache name with a hash of everything it caches,
// so a shipped change can never be served from a stale cache.
//
//   node scripts/stamp-sw.mjs           rewrite sw.js in place
//   node scripts/stamp-sw.mjs --check   exit 1 if the stamp is out of date
//
// Zero dependencies.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SW = join(ROOT, 'sw.js');

// Non-shipped directories and files are excluded from the hash
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'scripts', 'docs']);
const EXCLUDE_FILES = new Set([
  'sw.js',
  '.DS_Store',
  'package.json',
  'package-lock.json',
  'README.md',
  'AGENTS.md',
  '.gitignore',
  'flashcalc2.html',
]);

/** Every shipped file under ROOT, as paths relative to ROOT, sorted. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const rel = relative(ROOT, abs);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry)) {
        out.push(...walk(abs));
      }
    } else if (!EXCLUDE_FILES.has(entry) && !EXCLUDE_FILES.has(rel)) {
      out.push(abs);
    }
  }
  return out.sort();
}

/** Hash of the whole shell: paths as well as bytes, so a rename counts. */
function fingerprint() {
  const h = createHash('sha256');
  for (const abs of walk(ROOT)) {
    h.update(relative(ROOT, abs).split(sep).join('/'));
    h.update('\0');
    h.update(readFileSync(abs));
    h.update('\0');
  }
  return h.digest('hex').slice(0, 8);
}

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const wanted = `flashcalc-v${version}-${fingerprint()}`;

const src = readFileSync(SW, 'utf8');
const LINE = /^const CACHE = '(.*)';$/m;
const found = src.match(LINE);
if (!found) {
  console.error("stamp-sw: no `const CACHE = '...';` line in sw.js");
  process.exit(2);
}

if (found[1] === wanted) {
  console.log(`stamp-sw: up to date (${wanted})`);
  process.exit(0);
}

if (process.argv.includes('--check')) {
  console.error(`stamp-sw: cache name is stale.\n  is:     ${found[1]}\n  should: ${wanted}\nRun \`npm run stamp\` and commit the result.`);
  process.exit(1);
}

writeFileSync(SW, src.replace(LINE, `const CACHE = '${wanted}';`));
console.log(`stamp-sw: ${found[1]} -> ${wanted}`);
