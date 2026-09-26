#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function printHelp() {
  console.log(`Usage: node scripts/compare-screenshots.mjs --reference <png> --clone <png> [options]

Create a pixel diff and report the mismatch ratio.

Options:
  --reference <png>           Reference screenshot
  --clone <png>               Clone screenshot
  --diff <png>                Diff output (default: artifacts/diff.png)
  --json <file>               Write metrics JSON
  --threshold <0..1>          Pixelmatch threshold (default: 0.1)
  --fail-ratio <0..1>         Exit 1 when mismatch ratio exceeds this value
  --help                      Show this help

Requires the existing pngjs and pixelmatch packages; it does not download a browser.
`);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    else {
      const key = arg.slice(2);
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`);
      options[key] = value;
      index += 1;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  if (!options.reference || !options.clone) throw new Error('--reference and --clone are required');
  const threshold = options.threshold === undefined ? 0.1 : Number(options.threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('--threshold must be between 0 and 1');
  const failRatio = options['fail-ratio'] === undefined ? null : Number(options['fail-ratio']);
  if (failRatio !== null && (!Number.isFinite(failRatio) || failRatio < 0 || failRatio > 1)) throw new Error('--fail-ratio must be between 0 and 1');

  let PNG;
  let pixelmatch;
  try {
    ({ PNG } = await import('pngjs'));
    ({ default: pixelmatch } = await import('pixelmatch'));
  } catch (error) {
    throw new Error('pngjs and pixelmatch are required. Use the project\'s existing installation or run npm install in this skill, then retry.', { cause: error });
  }

  const [referenceBuffer, cloneBuffer] = await Promise.all([
    fs.readFile(path.resolve(options.reference)),
    fs.readFile(path.resolve(options.clone)),
  ]);
  const reference = PNG.sync.read(referenceBuffer);
  const clone = PNG.sync.read(cloneBuffer);
  if (reference.width !== clone.width || reference.height !== clone.height) {
    throw new Error(`Screenshot dimensions differ: reference ${reference.width}x${reference.height}, clone ${clone.width}x${clone.height}`);
  }
  const diff = new PNG({ width: reference.width, height: reference.height });
  const mismatchedPixels = pixelmatch(reference.data, clone.data, diff.data, reference.width, reference.height, {
    threshold,
    includeAA: false,
  });
  const totalPixels = reference.width * reference.height;
  const mismatchRatio = totalPixels ? mismatchedPixels / totalPixels : 0;
  const metrics = {
    reference: path.resolve(options.reference),
    clone: path.resolve(options.clone),
    width: reference.width,
    height: reference.height,
    mismatchedPixels,
    totalPixels,
    mismatchRatio,
    threshold,
    pass: failRatio === null ? true : mismatchRatio <= failRatio,
  };
  const diffPath = path.resolve(options.diff || 'artifacts/diff.png');
  await fs.mkdir(path.dirname(diffPath), { recursive: true });
  await fs.writeFile(diffPath, PNG.sync.write(diff));
  if (options.json) {
    const jsonPath = path.resolve(options.json);
    await fs.mkdir(path.dirname(jsonPath), { recursive: true });
    await fs.writeFile(jsonPath, `${JSON.stringify(metrics, null, 2)}\n`);
  }
  console.log(JSON.stringify(metrics, null, 2));
  if (!metrics.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});

