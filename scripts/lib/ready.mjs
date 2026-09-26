/**
 * Wait for the browser state that is safe for a deterministic interaction.
 * The marker is optional because third-party reference pages usually do not
 * expose data-page-ready themselves; clones should add it when possible.
 */
export async function waitForPageReady(page, options = {}) {
  const {
    timeout = 15_000,
    readySelector = '[data-page-ready="true"]',
    requireReadyMarker = false,
    settleMs = 150,
    imageTimeout = Math.min(timeout, 5_000),
  } = options;

  await page.waitForLoadState('domcontentloaded', { timeout }).catch(() => {});
  await page.waitForLoadState('load', { timeout }).catch(() => {});

  await page.evaluate(async (maxWait) => {
    const waitForImages = async () => {
      const images = Array.from(document.images);
      await Promise.all(images.map((image) => {
        if (image.complete) {
          return image.decode?.().catch(() => undefined);
        }
        return new Promise((resolve) => {
          const finish = () => resolve();
          image.addEventListener('load', finish, { once: true });
          image.addEventListener('error', finish, { once: true });
        });
      }));
    };

    const tasks = [waitForImages()];
    if (document.fonts?.ready) tasks.push(document.fonts.ready.catch(() => undefined));
    await Promise.race([
      Promise.all(tasks),
      new Promise((resolve) => setTimeout(resolve, maxWait)),
    ]);
  }, imageTimeout);

  let markerFound = false;
  if (readySelector) {
    const marker = page.locator(readySelector).first();
    if (requireReadyMarker) {
      await marker.waitFor({ state: 'attached', timeout });
      markerFound = true;
    } else {
      markerFound = await marker.count() > 0;
    }
  }
  if (requireReadyMarker && !markerFound) {
    throw new Error(`Required ready marker was not found: ${readySelector}`);
  }

  if (settleMs > 0) await page.waitForTimeout(settleMs);

  return {
    readyState: await page.evaluate(() => document.readyState),
    marker: readySelector,
    markerFound,
    settledMs: settleMs,
  };
}
