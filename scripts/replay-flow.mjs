#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { waitForPageReady } from './lib/ready.mjs';

function printHelp() {
  console.log(`Usage: node scripts/replay-flow.mjs --flow <flow.json> [options]

Replay a recorded interaction flow in an isolated browser context.

Options:
  --flow <file>               Flow JSON file
  --out <dir>                 Output root (default: artifacts/replays)
  --name <name>               Replay name (default: flow file name)
  --executable-path <path>    Use an existing Chromium/Chrome binary
  --headed                    Show the browser window
  --trace                     Save a Playwright trace
  --help                      Show this help

The flow format is documented in references/toolkit.md.
`);
}

function parseArgs(argv) {
  const options = {};
  const flags = new Set(['headed', 'trace']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    else {
      const key = arg.slice(2);
      if (flags.has(key)) options[key] = true;
      else {
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
        options[key] = value;
        index += 1;
      }
    }
  }
  return options;
}

async function getPlaywright() {
  try {
    return await import('playwright');
  } catch (error) {
    throw new Error('Playwright is required. Use the project\'s existing installation or run npm install in this skill, then retry.', { cause: error });
  }
}

function locatorFor(page, target) {
  if (!target) throw new Error('An action target is required');
  return page.locator(target);
}

async function assertAction(page, action) {
  const locator = locatorFor(page, action.target);
  const timeout = action.timeout || 10_000;
  if (action.type === 'assertVisible') await locator.waitFor({ state: 'visible', timeout });
  else if (action.type === 'assertHidden') await locator.waitFor({ state: 'hidden', timeout });
  else if (action.type === 'assertText') {
    const actual = await locator.innerText({ timeout });
    if (!actual.includes(String(action.text))) throw new Error(`Text assertion failed for ${action.target}: expected to include ${JSON.stringify(action.text)}, got ${JSON.stringify(actual)}`);
  } else throw new Error(`Unknown assertion: ${action.type}`);
}

async function performAction(page, action, outputDir, index) {
  const timeout = action.timeout || 10_000;
  switch (action.type) {
    case 'click': await locatorFor(page, action.target).click({ timeout, button: action.button || 'left', clickCount: action.clickCount || 1 }); break;
    case 'dblclick': await locatorFor(page, action.target).dblclick({ timeout }); break;
    case 'fill': await locatorFor(page, action.target).fill(String(action.value ?? ''), { timeout }); break;
    case 'type': await locatorFor(page, action.target).pressSequentially(String(action.value ?? ''), { timeout, delay: action.delay || 0 }); break;
    case 'press': await locatorFor(page, action.target).press(String(action.key), { timeout }); break;
    case 'hover': await locatorFor(page, action.target).hover({ timeout }); break;
    case 'focus': await locatorFor(page, action.target).focus({ timeout }); break;
    case 'check': await locatorFor(page, action.target).check({ timeout }); break;
    case 'uncheck': await locatorFor(page, action.target).uncheck({ timeout }); break;
    case 'selectOption': await locatorFor(page, action.target).selectOption(action.value, { timeout }); break;
    case 'scroll': {
      if (action.target) await locatorFor(page, action.target).scrollIntoViewIfNeeded({ timeout });
      else await page.mouse.wheel(Number(action.x || 0), Number(action.y || 0));
      break;
    }
    case 'wait': await page.waitForTimeout(Number(action.ms || 250)); break;
    case 'screenshot': {
      const screenshotName = String(action.name || `step-${String(index + 1).padStart(2, '0')}`).replace(/[^a-zA-Z0-9._-]+/g, '-');
      await page.screenshot({ path: path.join(outputDir, `${screenshotName}.png`), fullPage: Boolean(action.fullPage) });
      break;
    }
    case 'assertVisible':
    case 'assertHidden':
    case 'assertText': await assertAction(page, action); break;
    case 'assertUrl': {
      const actual = page.url();
      if (action.value instanceof Object && action.value.regex) {
        if (!new RegExp(action.value.regex).test(actual)) throw new Error(`URL assertion failed: ${actual} does not match ${action.value.regex}`);
      } else if (actual !== String(action.value)) throw new Error(`URL assertion failed: expected ${action.value}, got ${actual}`);
      break;
    }
    default: throw new Error(`Unknown action type: ${action.type}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  if (!options.flow) throw new Error('--flow is required');
  const flowPath = path.resolve(options.flow);
  const flow = JSON.parse(await fs.readFile(flowPath, 'utf8'));
  if (!flow.url && !flow.route) throw new Error('Flow must include url or route');
  const startUrl = flow.url || (() => {
    if (!flow.baseUrl) throw new Error('A relative flow.route requires flow.baseUrl');
    return new URL(flow.route, flow.baseUrl).href;
  })();
  const name = String(options.name || path.basename(flowPath, path.extname(flowPath))).replace(/[^a-zA-Z0-9._-]+/g, '-');
  const outputDir = path.resolve(options.out || 'artifacts/replays', name);
  await fs.mkdir(outputDir, { recursive: true });

  const { chromium } = await getPlaywright();
  const browser = await chromium.launch({
    headless: !options.headed,
    executablePath: options['executable-path'] || process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  });
  const context = await browser.newContext({
    viewport: flow.viewport || { width: 1440, height: 900 },
    deviceScaleFactor: flow.viewport?.deviceScaleFactor || 1,
    locale: flow.context?.locale,
    colorScheme: flow.context?.colorScheme,
    reducedMotion: flow.context?.reducedMotion,
  });
  const page = await context.newPage();
  const events = { console: [], pageErrors: [] };
  page.on('console', (message) => events.console.push({ type: message.type(), text: message.text(), location: message.location() }));
  page.on('pageerror', (error) => events.pageErrors.push({ message: error.message, stack: error.stack }));
  if (options.trace) await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const report = {
    name,
    flow: flowPath,
    requestedUrl: startUrl,
    startedAt: new Date().toISOString(),
    actions: [],
    final: null,
    errors: [],
  };
  try {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: flow.timeout || 30_000 });
    const readyOptions = {
      ...(flow.ready || {}),
      readySelector: flow.ready?.selector || flow.ready?.readySelector || '[data-page-ready="true"]',
      requireReadyMarker: Boolean(flow.ready?.requireMarker || flow.ready?.requireReadyMarker),
    };
    await waitForPageReady(page, readyOptions);
    for (const [index, action] of (flow.actions || []).entries()) {
      const started = Date.now();
      try {
        if (action.type !== 'wait' && action.type !== 'screenshot') await waitForPageReady(page, readyOptions);
        await performAction(page, action, outputDir, index);
        report.actions.push({ index, action, ok: true, durationMs: Date.now() - started, url: page.url() });
      } catch (error) {
        report.actions.push({ index, action, ok: false, durationMs: Date.now() - started, error: error.message, url: page.url() });
        throw error;
      }
    }
    if (flow.final) {
      for (const assertion of flow.final) await performAction(page, assertion, outputDir, report.actions.length);
    }
    report.final = { url: page.url(), title: await page.title(), ok: true };
    console.log(`Replay passed: ${outputDir}`);
  } catch (error) {
    report.errors.push({ message: error.message, stack: error.stack });
    report.final = { url: page.url(), title: await page.title().catch(() => ''), ok: false };
    process.exitCode = 1;
    console.error(error.stack || error.message || error);
  } finally {
    report.events = events;
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(outputDir, 'replay-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (options.trace) await context.tracing.stop({ path: path.join(outputDir, 'trace.zip') });
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
