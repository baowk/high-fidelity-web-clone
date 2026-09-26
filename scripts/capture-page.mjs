#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { waitForPageReady } from './lib/ready.mjs';

function printHelp() {
  console.log(`Usage: node scripts/capture-page.mjs --url <url> [options]

Capture a browser state and its HTML/CSS/JS/assets evidence.

Options:
  --out <dir>                 Output root (default: artifacts/captures)
  --name <name>               Capture name (default: page)
  --width <px>                Viewport width (default: 1440)
  --height <px>               Viewport height (default: 900)
  --dpr <number>              Device scale factor (default: 1)
  --full-page                 Capture the complete page instead of the viewport
  --ready-selector <css>      Optional ready marker selector
  --require-ready-marker     Fail if the ready marker is absent
  --settle-ms <ms>             Wait after readiness (default: 150)
  --inspect <css>             Inspect a selector; may be repeated
  --trace [path]              Save a Playwright trace
  --har [path]                Save a HAR network recording
  --executable-path <path>    Use an existing Chromium/Chrome binary
  --headed                    Show the browser window
  --help                      Show this help

The script uses an existing Playwright installation and does not download a browser.
`);
}

function parseArgs(argv) {
  const options = { inspect: [] };
  const flags = new Set(['full-page', 'require-ready-marker', 'headed']);
  const optionalValue = new Set(['trace', 'har']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    else {
      const key = arg.slice(2);
      if (flags.has(key)) options[key] = true;
      else if (optionalValue.has(key)) {
        const next = argv[index + 1];
        if (next && !next.startsWith('--')) {
          options[key] = next;
          index += 1;
        } else options[key] = true;
      } else {
        const next = argv[index + 1];
        if (!next || next.startsWith('--')) throw new Error(`Missing value for --${key}`);
        if (key === 'inspect') options.inspect.push(next);
        else options[key] = next;
        index += 1;
      }
    }
  }
  return options;
}

function numberOption(options, key, fallback) {
  const value = options[key] === undefined ? fallback : Number(options[key]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${key} must be a positive number`);
  return value;
}

function outputPath(value, fallback) {
  if (value === true) return fallback;
  return path.resolve(String(value));
}

async function getPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    throw new Error('Playwright is required. Use the project\'s existing installation or run npm install in this skill, then retry.', { cause: error });
  }
}

async function inspectPage(page, selectors) {
  return page.evaluate((requestedSelectors) => requestedSelectors.map((selector) => {
    const element = document.querySelector(selector);
    if (!element) return { selector, found: false };
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      selector,
      found: true,
      tag: element.tagName.toLowerCase(),
      text: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 300),
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
      computed: {
        display: style.display,
        position: style.position,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        zIndex: style.zIndex,
      },
    };
  }), selectors);
}

async function sourceInventory(page) {
  return page.evaluate(() => {
    const absolute = (value) => {
      try { return new URL(value, document.baseURI).href; } catch { return value || null; }
    };
    const styleSheets = Array.from(document.styleSheets).map((sheet) => {
      let ruleCount = null;
      try { ruleCount = sheet.cssRules?.length ?? 0; } catch { /* cross-origin stylesheet */ }
      return { href: absolute(sheet.href), disabled: sheet.disabled, ruleCount };
    });
    const links = Array.from(document.querySelectorAll('link')).map((link) => ({
      rel: link.rel,
      href: absolute(link.getAttribute('href')),
      as: link.as || null,
      media: link.media || null,
      crossOrigin: link.crossOrigin || null,
    }));
    const inlineStyles = Array.from(document.querySelectorAll('style')).map((style, index) => ({
      index,
      media: style.media || null,
      length: style.textContent?.length || 0,
    }));
    const scripts = Array.from(document.scripts).map((script, index) => ({
      index,
      src: absolute(script.getAttribute('src')),
      type: script.type || null,
      async: script.async,
      defer: script.defer,
      noModule: script.noModule,
      inlineLength: script.src ? 0 : (script.textContent?.length || 0),
    }));
    const images = Array.from(document.images).map((image) => ({
      src: absolute(image.currentSrc || image.getAttribute('src')),
      srcset: image.getAttribute('srcset'),
      alt: image.alt,
      loading: image.loading,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      complete: image.complete,
    }));
    const fonts = Array.from(document.fonts || []).map((font) => ({
      family: font.family,
      style: font.style,
      weight: font.weight,
      status: font.status,
    }));
    const resourceEntries = performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      duration: entry.duration,
      transferSize: entry.transferSize,
    }));
    return {
      document: {
        url: location.href,
        title: document.title,
        readyState: document.readyState,
        htmlBytes: document.documentElement.outerHTML.length,
        elementCount: document.querySelectorAll('*').length,
      },
      html: { links, images },
      css: { styleSheets, inlineStyles },
      javascript: { scripts },
      fonts,
      resourceEntries,
    };
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  if (!options.url) throw new Error('--url is required');

  const width = numberOption(options, 'width', 1440);
  const height = numberOption(options, 'height', 900);
  const dpr = numberOption(options, 'dpr', 1);
  const settleMs = options['settle-ms'] === undefined ? 150 : Number(options['settle-ms']);
  if (!Number.isFinite(settleMs) || settleMs < 0) throw new Error('--settle-ms must be zero or a positive number');

  const name = String(options.name || 'page').replace(/[^a-zA-Z0-9._-]+/g, '-');
  const captureDir = path.resolve(options.out || 'artifacts/captures', name);
  await fs.mkdir(captureDir, { recursive: true });

  const { chromium } = await getPlaywright();
  const harPath = options.har ? outputPath(options.har, path.join(captureDir, 'network.har')) : undefined;
  const tracePath = options.trace ? outputPath(options.trace, path.join(captureDir, 'trace.zip')) : undefined;
  const browser = await chromium.launch({
    headless: !options.headed,
    executablePath: options['executable-path'] || process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    recordHar: harPath ? { path: harPath, content: 'attach' } : undefined,
  });
  const page = await context.newPage();
  const events = { console: [], pageErrors: [], requestFailed: [], network: [] };
  const requests = new Map();
  page.on('console', (message) => events.console.push({
    type: message.type(),
    text: message.text(),
    location: message.location(),
  }));
  page.on('pageerror', (error) => events.pageErrors.push({ message: error.message, stack: error.stack }));
  page.on('request', (request) => {
    const item = {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
    };
    requests.set(request, item);
    events.network.push(item);
  });
  page.on('response', (response) => {
    const item = requests.get(response.request());
    if (item) item.status = response.status();
  });
  page.on('requestfailed', (request) => {
    const item = requests.get(request);
    const failure = { url: request.url(), errorText: request.failure()?.errorText || 'unknown' };
    events.requestFailed.push(failure);
    if (item) item.failure = failure.errorText;
  });

  if (tracePath) {
    await fs.mkdir(path.dirname(tracePath), { recursive: true });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  }

  let response;
  try {
    response = await page.goto(String(options.url), { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const ready = await waitForPageReady(page, {
      readySelector: options['ready-selector'] || '[data-page-ready="true"]',
      requireReadyMarker: Boolean(options['require-ready-marker']),
      settleMs,
    });
    const screenshot = path.join(captureDir, 'screenshot.png');
    await page.screenshot({ path: screenshot, fullPage: Boolean(options['full-page']) });
    await fs.writeFile(path.join(captureDir, 'page.html'), await page.content());
    const body = page.locator('body');
    let ariaSnapshot = null;
    if (typeof body.ariaSnapshot === 'function') ariaSnapshot = await body.ariaSnapshot().catch(() => null);
    await fs.writeFile(path.join(captureDir, 'aria-snapshot.txt'), ariaSnapshot || 'Unavailable in this Playwright version.\n');
    await fs.writeFile(path.join(captureDir, 'source-inventory.json'), `${JSON.stringify(await sourceInventory(page), null, 2)}\n`);
    await fs.writeFile(path.join(captureDir, 'inspect.json'), `${JSON.stringify(await inspectPage(page, options.inspect), null, 2)}\n`);
    await fs.writeFile(path.join(captureDir, 'events.json'), `${JSON.stringify(events, null, 2)}\n`);
    await fs.writeFile(path.join(captureDir, 'meta.json'), `${JSON.stringify({
      url: page.url(),
      requestedUrl: options.url,
      status: response?.status() ?? null,
      viewport: { width, height, deviceScaleFactor: dpr },
      fullPage: Boolean(options['full-page']),
      ready,
      capturedAt: new Date().toISOString(),
    }, null, 2)}\n`);
    console.log(`Capture written to ${captureDir}`);
  } finally {
    if (tracePath) {
      await context.tracing.stop({ path: tracePath });
    }
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
