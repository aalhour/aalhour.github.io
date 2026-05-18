#!/usr/bin/env node
// Generate per-post Open Graph cards (1200x630 PNG) for all _posts/*.md.
//
// Output: assets/og/<slug>.png  (slug = post filename minus YYYY-MM-DD- and .md)
// Template: tools/og-template.html (placeholders __TITLE__, __SUBTITLE__,
//   __CATEGORY__, __DATE__, __DOMAIN__, __FONTS_BASE__)
//
// Skips posts whose PNG already exists and is newer than both the post file
// and the template — so reruns are cheap.
//
// Renders headless via local Chrome (--screenshot CLI flag). Same Chrome
// candidates list as tools/css-coverage.mjs. No npm dependencies.
//
// Usage:
//   node tools/og-render.mjs              # all posts, skip up-to-date
//   node tools/og-render.mjs --force      # regenerate all
//   node tools/og-render.mjs --post <slug> [--post <slug> ...]
//   node tools/og-render.mjs --dry-run    # list what would render

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, '_posts');
const TEMPLATE_PATH = path.join(ROOT, 'tools', 'og-template.html');
const OUTPUT_DIR = path.join(ROOT, 'assets', 'og');
const FONTS_DIR = path.join(ROOT, 'assets', 'fonts');
const DOMAIN = 'aalhour.com';

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium'
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseArgs(argv) {
  const opts = { force: false, dryRun: false, only: new Set() };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') opts.force = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--post') opts.only.add(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node tools/og-render.mjs [--force] [--dry-run] [--post <slug>]...`);
      process.exit(0);
    } else throw new Error(`unknown arg: ${a}`);
  }
  return opts;
}

async function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const candidate of CHROME_CANDIDATES) {
    try { await fs.access(candidate); return candidate; } catch {}
  }
  throw new Error('Chrome/Chromium not found. Install Google Chrome or set CHROME_PATH=/path/to/chrome.');
}

// Minimal frontmatter reader: extracts `title`, `subtitle`, `date`,
// `categories` (first entry). Avoids a YAML dep; posts here always use the
// inline form `field: "value"` and bracketed arrays.
function readFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]+?)\n---\n/);
  if (!m) return null;
  const fm = m[1];
  const grab = (field) => {
    const r = new RegExp(`^${field}:\\s*(.+)$`, 'm');
    const hit = fm.match(r);
    if (!hit) return null;
    return hit[1].trim().replace(/^["']|["']$/g, '');
  };
  const categoriesRaw = grab('categories');
  let category = null;
  if (categoriesRaw) {
    // Either `[Databases]` or `[Databases, Foo]` or `Databases`.
    const arr = categoriesRaw.match(/\[([^\]]+)\]/);
    category = (arr ? arr[1].split(',')[0] : categoriesRaw).trim();
  }
  return {
    title: grab('title'),
    subtitle: grab('subtitle'),
    date: grab('date'),
    category
  };
}

function slugFromFilename(filename) {
  // 2026-02-12-beachdb-wal-v1-milestone.md → beachdb-wal-v1-milestone
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
}

function dateFromFilename(filename) {
  // fallback for posts whose frontmatter omits date:
  const m = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function formatDate(isoDate) {
  // 2026-02-12 → "Feb 12, 2026"
  if (!isoDate) return '';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function escapeHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderHtml(template, post) {
  const fontsUrl = 'file://' + FONTS_DIR;
  return template
    .replaceAll('__TITLE__', escapeHtml(post.title))
    .replaceAll('__SUBTITLE__', escapeHtml(post.subtitle || ''))
    .replaceAll('__CATEGORY__', escapeHtml((post.category || 'notes').toLowerCase()))
    .replaceAll('__DATE__', escapeHtml(formatDate(post.date)))
    .replaceAll('__DOMAIN__', DOMAIN)
    .replaceAll('__FONTS_BASE__', fontsUrl);
}

function screenshot(chromePath, htmlPath, outPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-sandbox',
      '--force-device-scale-factor=1',
      '--window-size=1200,630',
      '--virtual-time-budget=3000',
      '--run-all-compositor-stages-before-draw',
      `--screenshot=${outPath}`,
      `file://${htmlPath}`
    ];
    const child = spawn(chromePath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`chrome exit ${code}: ${stderr.slice(0, 500)}`));
      else resolve();
    });
  });
}

async function needsRender(post, pngPath, templateMtime, force) {
  if (force) return true;
  try {
    const [pngStat, postStat] = await Promise.all([
      fs.stat(pngPath),
      fs.stat(post.sourcePath)
    ]);
    return pngStat.mtimeMs < Math.max(postStat.mtimeMs, templateMtime);
  } catch {
    return true; // png missing
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const chrome = await findChrome();
  console.log(`chrome: ${chrome}`);

  const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
  const templateStat = await fs.stat(TEMPLATE_PATH);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const filenames = (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith('.md')).sort();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-render-'));

  let rendered = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of filenames) {
    const slug = slugFromFilename(filename);
    if (opts.only.size && !opts.only.has(slug)) continue;

    const sourcePath = path.join(POSTS_DIR, filename);
    const content = await fs.readFile(sourcePath, 'utf8');
    const fm = readFrontmatter(content);
    if (!fm || !fm.title) {
      console.warn(`  ! skip (no title): ${filename}`);
      continue;
    }
    if (!fm.date) fm.date = dateFromFilename(filename);

    const post = { ...fm, sourcePath, slug };
    const pngPath = path.join(OUTPUT_DIR, `${slug}.png`);

    const needs = await needsRender(post, pngPath, templateStat.mtimeMs, opts.force);
    if (!needs) { skipped += 1; continue; }

    const htmlPath = path.join(tmpDir, `${slug}.html`);
    await fs.writeFile(htmlPath, await renderHtml(template, post));

    if (opts.dryRun) {
      console.log(`  would render: ${slug}.png`);
      continue;
    }

    try {
      await screenshot(chrome, htmlPath, pngPath);
      const stat = await fs.stat(pngPath);
      console.log(`  ✓ ${slug}.png (${Math.round(stat.size / 1024)}KB)`);
      rendered += 1;
    } catch (err) {
      console.error(`  ✗ ${slug}.png — ${err.message}`);
      failed += 1;
    }
  }

  await fs.rm(tmpDir, { recursive: true, force: true });

  console.log(`\ndone — rendered: ${rendered}, skipped: ${skipped}, failed: ${failed}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`fatal: ${err.message}`);
  process.exit(1);
});
