#!/usr/bin/env node

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = path.join(ROOT, '_site');
const DEFAULT_OUTPUT_DIR = path.join(ROOT, '_manual', 'css-coverage');
const DEFAULT_WAIT_MS = 180;

const VIEWPORTS = [
  {
    name: 'desktop',
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false
  },
  {
    name: 'mobile',
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  }
];

const THEMES = ['light', 'dark'];

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.pdf', 'application/pdf']
]);

const CUSTOM_SELECTOR_RE =
  /(#toc-bar|#toc-popup|#toc-solo-trigger|#panel-wrapper|#topbar|#sidebar|\.site-home|\.topbar|\.mobile|\.home-|\.writings-|\.row-list|\.essay|\.selected|\.animation|\.project|\.talk|\.about|\.me-(?:maintaining|contributing|active|personal|contributed|past))/i;
const STATEFUL_PSEUDO_RE = /:(hover|focus|focus-visible|active|target|checked|disabled|open|visited)\b/i;

function usage() {
  return `Usage: node tools/css-coverage.mjs [options]

Builds the Jekyll site, serves _site locally, opens Chrome headless, and
collects rule-level CSS coverage across all pages, light/dark themes, and
desktop/mobile viewports. Mobile post visits exercise Chirpy's navbar/TOC
switch, hamburger menu, search trigger, anchor scrolling, and TOC popups.

Options:
  --no-build              Use the existing _site directory.
  --env <name>            Jekyll environment for the build. Default: production.
  --url <path>            Audit one URL path. Repeatable. Example: /posts/foo/
  --limit <n>             Audit only the first n discovered pages.
  --output <dir>          Report directory. Default: _manual/css-coverage
  --chrome <path>         Chrome/Chromium executable. Also supports CHROME_PATH.
  --wait <ms>             Extra wait after page load/interactions. Default: ${DEFAULT_WAIT_MS}
  --help                  Show this help.

Examples:
  node tools/css-coverage.mjs
  node tools/css-coverage.mjs --limit 5
  node tools/css-coverage.mjs --no-build --url /posts/building-beachdb/
`;
}

function parseArgs(argv) {
  const options = {
    build: true,
    env: 'production',
    urls: [],
    limit: Infinity,
    outputDir: DEFAULT_OUTPUT_DIR,
    chromePath: process.env.CHROME_PATH || '',
    waitMs: DEFAULT_WAIT_MS,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--no-build':
        options.build = false;
        break;
      case '--env':
        options.env = readValue(argv, ++i, arg);
        break;
      case '--url':
        options.urls.push(...readValue(argv, ++i, arg).split(',').map((url) => url.trim()).filter(Boolean));
        break;
      case '--limit': {
        const parsed = Number.parseInt(readValue(argv, ++i, arg), 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          throw new Error('--limit must be a positive integer');
        }
        options.limit = parsed;
        break;
      }
      case '--output':
        options.outputDir = resolveRepoPath(readValue(argv, ++i, arg));
        break;
      case '--chrome':
        options.chromePath = readValue(argv, ++i, arg);
        break;
      case '--wait': {
        const parsed = Number.parseInt(readValue(argv, ++i, arg), 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error('--wait must be a non-negative integer');
        }
        options.waitMs = parsed;
        break;
      }
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.urls = options.urls.map(normalizeUrlPath);
  return options;
}

function readValue(argv, index, optionName) {
  if (index >= argv.length || argv[index].startsWith('--')) {
    throw new Error(`${optionName} requires a value`);
  }
  return argv[index];
}

function resolveRepoPath(value) {
  return path.isAbsolute(value) ? value : path.join(ROOT, value);
}

function normalizeUrlPath(urlPath) {
  if (!urlPath.startsWith('/')) {
    return `/${urlPath}`;
  }
  return urlPath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  await fs.mkdir(options.outputDir, { recursive: true });

  if (options.build) {
    await run('bundle', ['exec', 'jekyll', 'build'], {
      cwd: ROOT,
      env: { ...process.env, JEKYLL_ENV: options.env }
    });
  }

  const allPages = options.urls.length > 0 ? options.urls : await discoverHtmlPages(SITE_DIR);
  const pages = allPages.slice(0, options.limit);
  if (pages.length === 0) {
    throw new Error('No HTML pages found to audit');
  }

  const ruleStore = new Map();
  const scenarios = [];
  const errors = [];
  const startedAt = new Date();
  const total = pages.length * VIEWPORTS.length * THEMES.length;
  let current = 0;
  let server;
  let chrome;
  let cdp;

  try {
    server = await startStaticServer(SITE_DIR);
    const chromePath = options.chromePath || await findChrome();
    chrome = await launchChrome(chromePath);
    cdp = await CDP.connect(chrome.port, chrome.wsPath);

    process.stdout.write(`Auditing ${pages.length} page(s), ${VIEWPORTS.length} viewport(s), ${THEMES.length} theme(s)\n`);

    for (const pagePath of pages) {
      for (const viewport of VIEWPORTS) {
        for (const theme of THEMES) {
          current += 1;
          const label = `${pagePath} ${viewport.name}/${theme}`;
          process.stdout.write(`[${current}/${total}] ${label}\n`);

          try {
            const scenario = await auditScenario({
              cdp,
              baseUrl: server.baseUrl,
              pagePath,
              viewport,
              theme,
              waitMs: options.waitMs,
              ruleStore
            });
            scenarios.push(scenario);
          } catch (error) {
            errors.push({
              pagePath,
              viewport: viewport.name,
              theme,
              message: error.message
            });
            process.stderr.write(`  failed: ${error.message}\n`);
          }
        }
      }
    }

    const elapsedMs = Date.now() - startedAt.getTime();
    const report = await writeReports({
      outputDir: options.outputDir,
      pages,
      scenarios,
      errors,
      ruleStore,
      startedAt,
      elapsedMs
    });

    process.stdout.write(`\nWrote ${path.relative(ROOT, report.markdownPath)}\n`);
    process.stdout.write(`Wrote ${path.relative(ROOT, report.jsonPath)}\n`);
  } finally {
    await cdp?.close().catch(() => {});
    await chrome?.close().catch(() => {});
    await server?.close().catch(() => {});
  }

  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

async function run(command, args, options) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function discoverHtmlPages(siteDir) {
  const files = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        files.push(fullPath);
      }
    }
  }

  await walk(siteDir);

  return files
    .map((filePath) => htmlFileToUrlPath(siteDir, filePath))
    .sort((a, b) => {
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b);
    });
}

function htmlFileToUrlPath(siteDir, filePath) {
  const relative = path.relative(siteDir, filePath).split(path.sep).join('/');
  if (relative === 'index.html') {
    return '/';
  }
  if (relative.endsWith('/index.html')) {
    return `/${relative.slice(0, -'index.html'.length)}`;
  }
  return `/${relative}`;
}

async function startStaticServer(rootDir) {
  const server = http.createServer(async (request, response) => {
    try {
      const requested = new URL(request.url || '/', 'http://localhost');
      const pathname = decodeURIComponent(requested.pathname);
      const filePath = await resolveStaticPath(rootDir, pathname);
      const contentType = CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';

      response.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store'
      });
      fsSync.createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(error.statusCode || 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(error.message);
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

async function resolveStaticPath(rootDir, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let candidate = path.join(rootDir, safePath);
  if (!candidate.startsWith(rootDir)) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  try {
    const stat = await fs.stat(candidate);
    if (stat.isDirectory()) {
      candidate = path.join(candidate, 'index.html');
    }
  } catch {
    if (!path.extname(candidate)) {
      candidate = `${candidate}.html`;
    }
  }

  try {
    const stat = await fs.stat(candidate);
    if (!stat.isFile()) {
      throw new Error('Not found');
    }
    return candidate;
  } catch {
    const error = new Error(`Not found: ${pathname}`);
    error.statusCode = 404;
    throw error;
  }
}

async function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium'
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next known location.
    }
  }

  throw new Error('Could not find Chrome/Chromium. Pass --chrome <path> or set CHROME_PATH.');
}

async function launchChrome(chromePath) {
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aalhour-css-coverage-chrome-'));
  const stderrLines = [];
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-features=MediaRouter',
    '--disable-extensions',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ];

  const child = spawn(chromePath, args, {
    stdio: ['ignore', 'ignore', 'pipe']
  });

  child.stderr.on('data', (chunk) => {
    stderrLines.push(chunk.toString('utf8'));
    if (stderrLines.length > 25) {
      stderrLines.shift();
    }
  });

  child.on('error', () => {
    // The active-port polling below will report the launch failure.
  });

  try {
    const { port, wsPath } = await readDevToolsActivePort(profileDir, child, stderrLines);
    return {
      port,
      wsPath,
      close: async () => {
        child.kill('SIGTERM');
        await waitForExit(child, 2500).catch(() => child.kill('SIGKILL'));
        await fs.rm(profileDir, { recursive: true, force: true });
      }
    };
  } catch (error) {
    child.kill('SIGKILL');
    await fs.rm(profileDir, { recursive: true, force: true });
    throw error;
  }
}

async function readDevToolsActivePort(profileDir, child, stderrLines) {
  const activePortPath = path.join(profileDir, 'DevToolsActivePort');
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Chrome exited before DevTools was ready.\n${stderrLines.join('')}`);
    }

    try {
      const content = await fs.readFile(activePortPath, 'utf8');
      const [portLine, wsPath] = content.trim().split('\n');
      const port = Number.parseInt(portLine, 10);
      if (Number.isFinite(port) && wsPath) {
        return { port, wsPath };
      }
    } catch {
      // Chrome has not written the port file yet.
    }

    await sleep(80);
  }

  throw new Error(`Timed out waiting for Chrome DevTools.\n${stderrLines.join('')}`);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for Chrome to exit')), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function auditScenario({ cdp, baseUrl, pagePath, viewport, theme, waitMs, ruleStore }) {
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const attached = await cdp.send('Target.attachToTarget', {
    targetId: target.targetId,
    flatten: true
  });
  const sessionId = attached.sessionId;
  const stylesheetHeaders = new Map();
  const stylesheetTexts = new Map();
  const url = `${baseUrl}${pagePath}`;

  const styleSheetHandler = (message) => {
    if (message.sessionId !== sessionId || message.method !== 'CSS.styleSheetAdded') {
      return;
    }
    stylesheetHeaders.set(message.params.header.styleSheetId, message.params.header);
  };

  cdp.on('event', styleSheetHandler);

  try {
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('DOM.enable', {}, sessionId);
    await cdp.send('CSS.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: viewport.deviceScaleFactor,
      mobile: viewport.mobile,
      screenWidth: viewport.width,
      screenHeight: viewport.height
    }, sessionId);
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-color-scheme', value: theme }]
    }, sessionId);

    await cdp.send('CSS.startRuleUsageTracking', {}, sessionId);

    const loadPromise = cdp.waitForEvent(
      'Page.loadEventFired',
      (message) => message.sessionId === sessionId,
      20000
    ).catch(() => null);

    await cdp.send('Page.navigate', { url }, sessionId);
    await loadPromise;
    await sleep(waitMs);
    await forceTheme(cdp, sessionId, theme);
    await waitForFonts(cdp, sessionId);

    const interactions = await exercisePage(cdp, sessionId, waitMs);
    const coverage = await cdp.send('CSS.stopRuleUsageTracking', {}, sessionId);

    await recordCoverage({
      cdp,
      sessionId,
      baseUrl,
      pagePath,
      viewport: viewport.name,
      theme,
      ruleUsage: coverage.ruleUsage || [],
      stylesheetHeaders,
      stylesheetTexts,
      ruleStore
    });

    return {
      pagePath,
      viewport: viewport.name,
      theme,
      ruleCount: coverage.ruleUsage?.length || 0,
      stylesheetCount: stylesheetHeaders.size,
      interactions
    };
  } finally {
    cdp.off('event', styleSheetHandler);
    await cdp.send('Target.closeTarget', { targetId: target.targetId }).catch(() => {});
  }
}

async function forceTheme(cdp, sessionId, theme) {
  await safeEvaluate(cdp, sessionId, `
    (() => {
      document.documentElement.setAttribute('data-mode', ${JSON.stringify(theme)});
      try { localStorage.setItem('mode', ${JSON.stringify(theme)}); } catch (_) {}
      try { sessionStorage.setItem('mode', ${JSON.stringify(theme)}); } catch (_) {}
      window.dispatchEvent(new Event('storage'));
      return document.documentElement.getAttribute('data-mode');
    })()
  `);
}

async function waitForFonts(cdp, sessionId) {
  await safeEvaluate(cdp, sessionId, `
    (async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      return true;
    })()
  `);
}

async function exercisePage(cdp, sessionId, waitMs) {
  const result = await safeEvaluate(cdp, sessionId, `
    (async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const clicked = {
        hamburger: false,
        search: false,
        tocSolo: false,
        tocMobile: false,
        anchor: false
      };
      const click = (element) => {
        if (!element) return false;
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        element.click();
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        return true;
      };
      const visible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true
      }));

      window.scrollTo(0, 0);
      await wait(${waitMs});

      const hamburger = document.querySelector('#hamburger');
      if (visible(hamburger)) {
        clicked.hamburger = click(hamburger);
        await wait(${waitMs});
        esc();
      }

      const search = document.querySelector('#search-trigger, button[aria-label*="Search" i], a[aria-label*="Search" i]');
      if (visible(search)) {
        clicked.search = click(search);
        await wait(${waitMs});
        const input = document.querySelector('#search-input, input[type="search"], input[aria-label*="search" i]');
        if (input) {
          input.value = 'beach';
          input.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            inputType: 'insertText',
            data: 'beach'
          }));
          await wait(${waitMs});
        }
        esc();
      }

      const tocSolo = document.querySelector('#toc-solo-trigger');
      if (tocSolo) {
        clicked.tocSolo = click(tocSolo);
        await wait(${waitMs});
        const popup = document.querySelector('#toc-popup');
        if (popup && !popup.open && typeof popup.showModal === 'function') {
          popup.showModal();
          await wait(${waitMs});
        }
        esc();
      }

      const heading = document.querySelector('main h2[id], article h2[id], .post-content h2[id], main h3[id], article h3[id]');
      if (heading) {
        heading.scrollIntoView();
        await wait(${waitMs});
        history.replaceState(null, '', '#' + heading.id);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        clicked.anchor = true;
        await wait(${waitMs});
      }

      const maxScroll = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - window.innerHeight;
      const scrollStops = [120, 360, 720, Math.floor(maxScroll / 2), maxScroll].filter((y) => y > 0);
      for (const y of scrollStops) {
        window.scrollTo(0, y);
        window.dispatchEvent(new Event('scroll'));
        await wait(${Math.max(80, Math.floor(waitMs / 2))});
      }

      const tocBar = document.querySelector('#toc-bar');
      if (tocBar) {
        tocBar.classList.remove('invisible');
      }
      const tocMobile = document.querySelector('#toc-bar .toc-trigger, #toc-bar button');
      if (tocMobile) {
        clicked.tocMobile = click(tocMobile);
        await wait(${waitMs});
        const popup = document.querySelector('#toc-popup');
        if (popup && !popup.open && typeof popup.showModal === 'function') {
          popup.showModal();
          await wait(${waitMs});
        }
        esc();
      }

      window.scrollTo(0, 0);
      await wait(${Math.max(80, Math.floor(waitMs / 2))});
      return clicked;
    })()
  `);

  return result || {};
}

async function safeEvaluate(cdp, sessionId, expression) {
  const response = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  }, sessionId);

  if (response.exceptionDetails) {
    return null;
  }

  return response.result?.value ?? null;
}

async function recordCoverage({
  cdp,
  sessionId,
  baseUrl,
  pagePath,
  viewport,
  theme,
  ruleUsage,
  stylesheetHeaders,
  stylesheetTexts,
  ruleStore
}) {
  const parsedRulesBySheet = new Map();
  const scenarioKey = `${pagePath} ${viewport}/${theme}`;

  for (const [styleSheetId, header] of stylesheetHeaders.entries()) {
    let text = stylesheetTexts.get(styleSheetId);
    if (text === undefined) {
      text = await getStyleSheetText(cdp, sessionId, styleSheetId);
      stylesheetTexts.set(styleSheetId, text);
    }

    if (!text) {
      continue;
    }

    const source = normalizeSourceUrl(header.sourceURL, baseUrl);
    const parsedRules = parseCssRules(text).map((rule) => ({
      ...rule,
      source,
      approxLine: offsetToLine(text, rule.startOffset)
    }));
    parsedRulesBySheet.set(styleSheetId, parsedRules);

    for (const rule of parsedRules) {
      touchRule(ruleStore, rule, {
        pagePath,
        viewport,
        theme,
        scenarioKey,
        used: false
      });
    }
  }

  for (const usage of ruleUsage) {
    if (!usage.used) {
      continue;
    }

    const parsedRules = parsedRulesBySheet.get(usage.styleSheetId);
    if (!parsedRules) {
      continue;
    }

    const rule = findRuleForUsage(parsedRules, usage);
    if (!rule) {
      continue;
    }

    touchRule(ruleStore, rule, {
      pagePath,
      viewport,
      theme,
      scenarioKey,
      used: true
    });
  }
}

async function getStyleSheetText(cdp, sessionId, styleSheetId) {
  try {
    const response = await cdp.send('CSS.getStyleSheetText', { styleSheetId }, sessionId);
    return response.text || '';
  } catch {
    return '';
  }
}

function touchRule(ruleStore, rule, { pagePath, viewport, theme, scenarioKey, used }) {
  const key = `${rule.source}:${rule.startOffset}:${rule.endOffset}`;
  const record = ruleStore.get(key) || {
    key,
    source: rule.source,
    selector: rule.selector,
    snippet: rule.snippet,
    startOffset: rule.startOffset,
    endOffset: rule.endOffset,
    approxLine: rule.approxLine,
    used: false,
    hits: 0,
    seen: 0,
    scenarios: [],
    pages: new Set(),
    viewports: new Set(),
    themes: new Set(),
    seenScenarios: new Set(),
    hitScenarios: new Set(),
    customLooking: CUSTOM_SELECTOR_RE.test(rule.selector),
    statefulPseudo: STATEFUL_PSEUDO_RE.test(rule.selector)
  };

  if (!record.seenScenarios.has(scenarioKey)) {
    record.seenScenarios.add(scenarioKey);
    record.seen += 1;
    record.pages.add(pagePath);
    record.viewports.add(viewport);
    record.themes.add(theme);
  }

  if (used && !record.hitScenarios.has(scenarioKey)) {
    record.hitScenarios.add(scenarioKey);
    record.used = true;
    record.hits += 1;
    if (record.scenarios.length < 12) {
      record.scenarios.push(scenarioKey);
    }
  }

  ruleStore.set(key, record);
}

function findRuleForUsage(parsedRules, usage) {
  return parsedRules.find((rule) => (
    usage.startOffset >= rule.startOffset &&
    usage.endOffset <= rule.endOffset
  ));
}

function parseCssRules(text) {
  const rules = [];

  function walk(start, end) {
    let index = start;

    while (index < end) {
      const blockStart = findNextOpenBrace(text, index, end);
      if (blockStart < 0) {
        break;
      }

      const preludeStart = findPreludeStart(text, index, blockStart);
      const prelude = compact(text.slice(preludeStart, blockStart), 180);
      const blockEnd = findMatchingCloseBrace(text, blockStart, end);
      if (blockEnd < 0) {
        break;
      }

      const lowerPrelude = prelude.toLowerCase();
      if (isRuleContainer(lowerPrelude)) {
        walk(blockStart + 1, blockEnd);
      } else if (isStyleRule(lowerPrelude)) {
        rules.push({
          selector: prelude,
          snippet: compact(text.slice(preludeStart, blockEnd + 1), 240),
          startOffset: preludeStart,
          endOffset: blockEnd + 1
        });
      }

      index = blockEnd + 1;
    }
  }

  walk(0, text.length);
  return rules;
}

function isRuleContainer(prelude) {
  return (
    prelude.startsWith('@media') ||
    prelude.startsWith('@supports') ||
    prelude.startsWith('@container') ||
    prelude.startsWith('@layer') ||
    prelude.startsWith('@scope') ||
    prelude.startsWith('@document') ||
    prelude.startsWith('@starting-style')
  );
}

function isStyleRule(prelude) {
  if (!prelude || prelude.startsWith('@')) {
    return false;
  }
  return true;
}

function findPreludeStart(text, start, blockStart) {
  let index = blockStart - 1;
  while (index >= start) {
    const char = text[index];
    if (char === '}' || char === ';') {
      return index + 1;
    }
    index -= 1;
  }
  return start;
}

function findNextOpenBrace(text, start, end) {
  for (let index = start; index < end; index += 1) {
    const next = skipCssNoise(text, index, end);
    if (next !== index) {
      index = next - 1;
      continue;
    }
    if (text[index] === '{') {
      return index;
    }
  }
  return -1;
}

function findMatchingCloseBrace(text, openIndex, end) {
  let depth = 0;
  for (let index = openIndex; index < end; index += 1) {
    const next = skipCssNoise(text, index, end);
    if (next !== index) {
      index = next - 1;
      continue;
    }

    if (text[index] === '{') {
      depth += 1;
    } else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function skipCssNoise(text, index, end) {
  const char = text[index];
  const next = text[index + 1];

  if (char === '/' && next === '*') {
    const close = text.indexOf('*/', index + 2);
    return close < 0 ? end : close + 2;
  }

  if (char === '"' || char === "'") {
    return skipCssString(text, index, end, char);
  }

  return index;
}

function skipCssString(text, index, end, quote) {
  for (let cursor = index + 1; cursor < end; cursor += 1) {
    if (text[cursor] === '\\') {
      cursor += 1;
      continue;
    }
    if (text[cursor] === quote) {
      return cursor + 1;
    }
  }
  return end;
}

function normalizeSourceUrl(sourceURL, baseUrl) {
  if (!sourceURL) {
    return '(inline)';
  }
  try {
    const parsed = new URL(sourceURL);
    if (parsed.origin === baseUrl) {
      return parsed.pathname;
    }
  } catch {
    // Not all stylesheet source URLs are absolute.
  }
  return sourceURL;
}

function offsetToLine(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function compact(value, maxLength = 160) {
  const compacted = value.replace(/\s+/g, ' ').trim();
  if (compacted.length <= maxLength) {
    return compacted;
  }
  return `${compacted.slice(0, maxLength - 3)}...`;
}

async function writeReports({ outputDir, pages, scenarios, errors, ruleStore, startedAt, elapsedMs }) {
  const rules = [...ruleStore.values()].map((record) => {
    const { seenScenarios, hitScenarios, ...serializable } = record;
    return {
      ...serializable,
      pages: [...record.pages].sort(),
      viewports: [...record.viewports].sort(),
      themes: [...record.themes].sort()
    };
  });

  const byStylesheet = summarizeByStylesheet(rules);
  const unusedRules = rules.filter((rule) => !rule.used);
  const unusedCustomRules = unusedRules.filter((rule) => rule.customLooking);
  const unusedStatefulRules = unusedRules.filter((rule) => rule.statefulPseudo);
  const markdownPath = path.join(outputDir, 'latest.md');
  const jsonPath = path.join(outputDir, 'latest.json');
  const summary = {
    generatedAt: startedAt.toISOString(),
    elapsedMs,
    pages: pages.length,
    scenarios: scenarios.length,
    errors: errors.length,
    rules: rules.length,
    usedRules: rules.length - unusedRules.length,
    unusedRules: unusedRules.length,
    unusedCustomLookingRules: unusedCustomRules.length,
    unusedStatefulPseudoRules: unusedStatefulRules.length
  };

  const markdown = buildMarkdownReport({
    summary,
    byStylesheet,
    unusedCustomRules,
    unusedRules,
    unusedStatefulRules,
    scenarios,
    errors
  });

  await fs.writeFile(markdownPath, markdown, 'utf8');
  await fs.writeFile(jsonPath, JSON.stringify({
    summary,
    byStylesheet,
    scenarios,
    errors,
    rules
  }, null, 2), 'utf8');

  return { markdownPath, jsonPath };
}

function summarizeByStylesheet(rules) {
  const map = new Map();
  for (const rule of rules) {
    const record = map.get(rule.source) || {
      source: rule.source,
      rules: 0,
      used: 0,
      unused: 0,
      customLookingUnused: 0
    };
    record.rules += 1;
    if (rule.used) {
      record.used += 1;
    } else {
      record.unused += 1;
      if (rule.customLooking) {
        record.customLookingUnused += 1;
      }
    }
    map.set(rule.source, record);
  }

  return [...map.values()].sort((a, b) => b.unused - a.unused);
}

function buildMarkdownReport({
  summary,
  byStylesheet,
  unusedCustomRules,
  unusedRules,
  unusedStatefulRules,
  scenarios,
  errors
}) {
  const lines = [];
  lines.push('# CSS Coverage Audit');
  lines.push('');
  lines.push(`Generated: ${summary.generatedAt}`);
  lines.push('');
  lines.push('This report is a suspicion list, not a delete list. It captures what Chrome applied while rendering the configured page/theme/viewport matrix and scripted interactions. Hover, focus, rare content states, third-party widgets, and future posts can still make a rule legitimate.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Pages: ${summary.pages}`);
  lines.push(`- Successful scenarios: ${summary.scenarios}`);
  lines.push(`- Failed scenarios: ${summary.errors}`);
  lines.push(`- Rules seen: ${summary.rules}`);
  lines.push(`- Rules used at least once: ${summary.usedRules}`);
  lines.push(`- Rules never used in this run: ${summary.unusedRules}`);
  lines.push(`- Unused custom-looking rules: ${summary.unusedCustomLookingRules}`);
  lines.push(`- Unused stateful pseudo-class rules: ${summary.unusedStatefulPseudoRules}`);
  lines.push(`- Runtime: ${(summary.elapsedMs / 1000).toFixed(1)}s`);
  lines.push('');

  lines.push('## Stylesheets');
  lines.push('');
  lines.push('| Stylesheet | Rules | Used | Unused | Used % | Custom-looking unused |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: |');
  for (const sheet of byStylesheet) {
    const usedPct = sheet.rules === 0 ? 0 : (sheet.used / sheet.rules) * 100;
    lines.push(`| ${escapePipes(sheet.source)} | ${sheet.rules} | ${sheet.used} | ${sheet.unused} | ${usedPct.toFixed(1)} | ${sheet.customLookingUnused} |`);
  }
  lines.push('');

  lines.push('## Unused Custom-Looking Rules');
  lines.push('');
  appendRuleTable(lines, unusedCustomRules, 80);

  lines.push('## Top Unused Rules');
  lines.push('');
  appendRuleTable(lines, unusedRules, 120);

  lines.push('## Unused Stateful Rules');
  lines.push('');
  lines.push('These often need manual verification because scripted coverage does not meaningfully exercise every hover, focus, active, target, or checked state.');
  lines.push('');
  appendRuleTable(lines, unusedStatefulRules, 80);

  lines.push('## Interaction Coverage');
  lines.push('');
  const interactionCounts = countInteractions(scenarios);
  for (const [name, count] of Object.entries(interactionCounts)) {
    lines.push(`- ${name}: ${count}`);
  }
  lines.push('');

  if (errors.length > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const error of errors) {
      lines.push(`- ${error.pagePath} ${error.viewport}/${error.theme}: ${error.message}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function appendRuleTable(lines, rules, limit) {
  if (rules.length === 0) {
    lines.push('None found.');
    lines.push('');
    return;
  }

  lines.push('| Source | Selector | Seen | Approx line |');
  lines.push('| --- | --- | ---: | ---: |');

  for (const rule of rules
    .slice()
    .sort((a, b) => b.seen - a.seen || a.source.localeCompare(b.source))
    .slice(0, limit)) {
    lines.push(`| ${escapePipes(rule.source)} | \`${escapeCode(rule.selector)}\` | ${rule.seen} | ${rule.approxLine} |`);
  }

  if (rules.length > limit) {
    lines.push('');
    lines.push(`Showing ${limit} of ${rules.length}. See latest.json for the full rule list.`);
  }
  lines.push('');
}

function countInteractions(scenarios) {
  const counts = {
    hamburger: 0,
    search: 0,
    tocSolo: 0,
    tocMobile: 0,
    anchor: 0
  };

  for (const scenario of scenarios) {
    for (const key of Object.keys(counts)) {
      if (scenario.interactions?.[key]) {
        counts[key] += 1;
      }
    }
  }

  return counts;
}

function escapePipes(value) {
  return String(value).replace(/\|/g, '\\|');
}

function escapeCode(value) {
  return String(value).replace(/`/g, '\\`');
}

class CDP extends EventEmitter {
  constructor(webSocket) {
    super();
    this.webSocket = webSocket;
    this.nextId = 1;
    this.pending = new Map();

    this.webSocket.on('message', (message) => this.handleMessage(message));
    this.webSocket.on('close', () => this.rejectAll(new Error('Chrome DevTools connection closed')));
  }

  static async connect(port, wsPath) {
    const webSocket = await RawWebSocket.connect(port, wsPath);
    return new CDP(webSocket);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId;
    this.nextId += 1;
    const message = { id, method, params };
    if (sessionId) {
      message.sessionId = sessionId;
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}`));
      }, 30000);

      this.pending.set(id, { resolve, reject, timer, method });
      this.webSocket.send(JSON.stringify(message));
    });
  }

  waitForEvent(method, predicate = () => true, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const listener = (message) => {
        if (message.method === method && predicate(message)) {
          cleanup();
          resolve(message);
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        this.off('event', listener);
      };

      this.on('event', listener);
    });
  }

  handleMessage(rawMessage) {
    let message;
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      clearTimeout(pending.timer);

      if (message.error) {
        pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      } else {
        pending.resolve(message.result || {});
      }
      return;
    }

    if (message.method) {
      this.emit('event', message);
    }
  }

  rejectAll(error) {
    for (const [id, pending] of this.pending.entries()) {
      this.pending.delete(id);
      clearTimeout(pending.timer);
      pending.reject(error);
    }
  }

  async close() {
    this.webSocket.close();
  }
}

class RawWebSocket extends EventEmitter {
  constructor(socket, initialBuffer = Buffer.alloc(0)) {
    super();
    this.socket = socket;
    this.buffer = initialBuffer;
    this.closed = false;

    this.socket.on('data', (chunk) => this.handleData(chunk));
    this.socket.on('close', () => {
      this.closed = true;
      this.emit('close');
    });
    this.socket.on('error', (error) => this.emit('error', error));

    if (initialBuffer.length > 0) {
      this.parseFrames();
    }
  }

  static async connect(port, wsPath) {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('error', reject);
    });

    const key = crypto.randomBytes(16).toString('base64');
    const request = [
      `GET ${wsPath} HTTP/1.1`,
      `Host: 127.0.0.1:${port}`,
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Key: ${key}`,
      'Sec-WebSocket-Version: 13',
      '',
      ''
    ].join('\r\n');

    socket.write(request);
    const { header, rest } = await readHandshake(socket);
    if (!/^HTTP\/1\.[01] 101\b/.test(header)) {
      throw new Error(`Chrome refused WebSocket upgrade:\n${header}`);
    }

    return new RawWebSocket(socket, rest);
  }

  send(text) {
    if (this.closed) {
      throw new Error('WebSocket is closed');
    }
    this.socket.write(encodeWebSocketFrame(Buffer.from(text, 'utf8')));
  }

  close() {
    if (!this.closed) {
      this.socket.end(encodeCloseFrame());
      this.closed = true;
    }
  }

  handleData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.parseFrames();
  }

  parseFrames() {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let payloadLength = second & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < offset + 2) return;
        payloadLength = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (this.buffer.length < offset + 8) return;
        const bigLength = this.buffer.readBigUInt64BE(offset);
        if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error('WebSocket frame is too large');
        }
        payloadLength = Number(bigLength);
        offset += 8;
      }

      let mask;
      if (masked) {
        if (this.buffer.length < offset + 4) return;
        mask = this.buffer.slice(offset, offset + 4);
        offset += 4;
      }

      if (this.buffer.length < offset + payloadLength) {
        return;
      }

      let payload = this.buffer.slice(offset, offset + payloadLength);
      this.buffer = this.buffer.slice(offset + payloadLength);

      if (masked) {
        payload = unmask(payload, mask);
      }

      if (opcode === 0x1) {
        this.emit('message', payload.toString('utf8'));
      } else if (opcode === 0x8) {
        this.close();
        this.emit('close');
      } else if (opcode === 0x9) {
        this.socket.write(encodePongFrame(payload));
      }
    }
  }
}

function readHandshake(socket) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd >= 0) {
        cleanup();
        resolve({
          header: buffer.slice(0, headerEnd).toString('utf8'),
          rest: buffer.slice(headerEnd + 4)
        });
      }
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
    };

    socket.on('data', onData);
    socket.on('error', onError);
  });
}

function encodeWebSocketFrame(payload) {
  const mask = crypto.randomBytes(4);
  let headerLength = 2;
  if (payload.length >= 126 && payload.length <= 65535) {
    headerLength += 2;
  } else if (payload.length > 65535) {
    headerLength += 8;
  }

  const frame = Buffer.alloc(headerLength + 4 + payload.length);
  frame[0] = 0x81;

  let offset = 2;
  if (payload.length < 126) {
    frame[1] = 0x80 | payload.length;
  } else if (payload.length <= 65535) {
    frame[1] = 0x80 | 126;
    frame.writeUInt16BE(payload.length, offset);
    offset += 2;
  } else {
    frame[1] = 0x80 | 127;
    frame.writeBigUInt64BE(BigInt(payload.length), offset);
    offset += 8;
  }

  mask.copy(frame, offset);
  offset += 4;

  for (let i = 0; i < payload.length; i += 1) {
    frame[offset + i] = payload[i] ^ mask[i % 4];
  }

  return frame;
}

function encodeCloseFrame() {
  return Buffer.from([0x88, 0x00]);
}

function encodePongFrame(payload) {
  const frame = Buffer.alloc(2 + payload.length);
  frame[0] = 0x8a;
  frame[1] = payload.length;
  payload.copy(frame, 2);
  return frame;
}

function unmask(payload, mask) {
  const output = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i += 1) {
    output[i] = payload[i] ^ mask[i % 4];
  }
  return output;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
