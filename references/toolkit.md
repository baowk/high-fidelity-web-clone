# Optional executable toolkit

The scripts in `scripts/` turn the workflow in `SKILL.md` into repeatable artifacts. They are intentionally small and use an existing Playwright/browser setup. Install the Node dependencies only when the project does not already provide them:

```bash
npm install
```

Do not download another browser just for this skill. Reuse the project's Playwright browser, an already installed Chromium, or the configured browser/CDP connector.

## Capture

```bash
npm run capture -- \
  --url https://example.com \
  --out artifacts/reference \
  --name home \
  --width 1440 \
  --height 900 \
  --full-page \
  --inspect '.hero' \
  --inspect 'nav'
```

If Playwright's managed browser is unavailable, point the helper at an existing Chrome/Chromium binary instead of downloading one:

```bash
npm run capture -- --url https://example.com \
  --executable-path '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```

`PLAYWRIGHT_EXECUTABLE_PATH` can be used as the equivalent environment variable for capture and replay.

The capture folder contains:

- `screenshot.png`, `page.html`, and `aria-snapshot.txt`;
- `source-inventory.json` grouped as HTML/assets, CSS, JavaScript, fonts, and resource timing;
- `inspect.json` with bounds and computed typography for requested selectors;
- `events.json` with console, page error, failed request, and request/response evidence;
- `meta.json`, plus optional `trace.zip` and `network.har`.

The ready checkpoint waits for `document.readyState`, fonts, rendered images, and a short settling period. A reference page may not have a marker, so the marker is optional during capture. A clone should expose one after its own data and UI are ready:

```html
<body data-page-ready="true">
```

Use `--require-ready-marker` for clone validation when the marker is part of the contract.

## Replay

Create one JSON file per meaningful flow. Use stable selectors, roles, labels, or test IDs; reserve coordinates for canvas and hit-testing behavior.

```json
{
  "name": "mobile menu",
  "url": "http://127.0.0.1:4173/",
  "viewport": { "width": 390, "height": 844, "deviceScaleFactor": 2 },
  "context": { "locale": "en-US", "colorScheme": "light", "reducedMotion": false },
  "ready": { "selector": "[data-page-ready=\"true\"]", "requireMarker": true },
  "actions": [
    { "type": "click", "target": "button[aria-label=\"Menu\"]" },
    { "type": "assertVisible", "target": "nav.mobile-panel" },
    { "type": "screenshot", "name": "menu-open" },
    { "type": "press", "target": "button[aria-label=\"Menu\"]", "key": "Escape" }
  ],
  "final": [
    { "type": "assertHidden", "target": "nav.mobile-panel" },
    { "type": "assertUrl", "value": "http://127.0.0.1:4173/" }
  ]
}
```

Supported actions include `click`, `dblclick`, `fill`, `type`, `press`, `hover`, `focus`, `check`, `uncheck`, `selectOption`, `scroll`, `wait`, `screenshot`, `assertVisible`, `assertHidden`, `assertText`, and `assertUrl`.

```bash
npm run replay -- --flow flows/home-menu.json --out artifacts/clone --trace
```

The replay writes screenshots, `replay-report.json`, console/page errors, and (when requested) a trace. It waits for the ready checkpoint before each interaction so a slow clone cannot be judged from a partial state.

## Compare

```bash
npm run compare -- \
  --reference artifacts/reference/home/screenshot.png \
  --clone artifacts/clone/home-menu/menu-open.png \
  --diff artifacts/diffs/home-menu.png \
  --json artifacts/diffs/home-menu.json \
  --fail-ratio 0.01
```

The result records image dimensions, mismatched pixels, and the mismatch ratio. Keep a threshold appropriate to the browser and dynamic content, and record every exception in the parity report.
