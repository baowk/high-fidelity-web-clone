# State capture and replay record

Use one record per meaningful interaction state. JSON is convenient, but Markdown tables are acceptable if they preserve the same fields.

```json
{
  "id": "home.nav.open.mobile",
  "route": "/",
  "viewport": {"width": 390, "height": 844, "deviceScaleFactor": 2},
  "context": {"locale": "zh-CN", "colorScheme": "light", "reducedMotion": false},
  "preconditions": ["fresh context", "scrollY=0"],
  "actions": [{"type": "click", "target": "button[aria-label='Menu']"}],
  "assertions": {"url": "/", "scrollY": 0, "visible": ["nav.mobile-panel"], "focused": "button[aria-label='Close menu']"},
  "artifacts": {"screenshot": "states/home.nav.open.mobile.png", "trace": "traces/home-nav-open.zip", "dom": "states/home.nav.open.mobile.html", "console": "states/home.nav.open.mobile.console.json", "network": "states/home.nav.open.mobile.har"},
  "tolerance": {"geometryPx": 2, "pixelDiffRatio": 0.01}
}
```

Capture intermediate states for transitions that matter: menu opening, modal animation, lazy loading, sticky header thresholds, validation errors, drag position, and scroll-triggered reveals. For nondeterministic content, freeze the clock/data or compare stable regions and document the exception.

Replay should start from an isolated browser context and execute the recorded actions rather than clicking by screen coordinates when a stable role, label, or test id exists. Keep coordinate actions for canvas, drag surfaces, and cases where hit-testing itself is part of the behavior.
