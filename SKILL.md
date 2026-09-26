---
name: high-fidelity-web-clone
description: Rebuild a website with high-fidelity UI, responsive behavior, and interaction parity from a reference URL. Use when the user asks to clone, reproduce, or recreate a site at 1:1 visual and interaction fidelity. Focuses on black-box browser evidence, state capture, replay, and visual regression; it does not promise private backend or account functionality.
metadata:
  short-description: High-fidelity website UI and interaction cloning
---

# High-Fidelity Web Clone

Treat the reference site as a black-box product specification. The goal is behavioral and visual parity across observable states, not a similar landing page.

## Operating rules

- Inspect the site before implementing it. Prefer original source when it is available and licensed, but do not block on finding source code.
- Use a real browser for rendering, lazy-loaded assets, fonts, canvas, and interaction evidence. Do not infer behavior from a screenshot alone.
- Keep a fixed test environment: browser/version, viewport, device scale factor, locale, reduced-motion setting, color scheme, and network fixtures.
- Capture the same input sequence against the reference and clone. Every meaningful state needs evidence: screenshot, URL, scroll position, DOM/accessibility snapshot, console output, and relevant network activity.
- Reproduce timing and intermediate states for menus, modals, loading, errors, scroll-triggered effects, drag gestures, and animation. Do not validate only the final frame.
- Before every interaction replay, wait for the clone readiness checkpoint: `document.readyState === "complete"`, `document.fonts.ready`, all currently rendered images decoded, and `[data-page-ready="true"]`. Capture the loading state once, then only click after the ready marker is present.
- Use real fonts and assets when accessible. Record any unavailable or restricted asset and its replacement; never silently substitute it.
- Check the reference site's license and terms before copying source, text, branding, or media. Local learning and public deployment have different permissions.

## Workflow

### 1. Define the parity boundary

Clarify the reference URL, routes, supported viewport matrix, authenticated scope, and whether the deliverable is a local clone or deployable product. If the user does not specify, target public routes and desktop/tablet/mobile layouts, and document exclusions.

### 2. Discover and capture

Use Playwright or the available browser/CDP tools to:

- enumerate internal routes and meaningful query/hash states;
- capture full-page and viewport screenshots at representative widths;
- record DOM structure, accessibility tree, computed styles, fonts, CSS variables, and element bounding boxes;
- record console errors, network requests, API responses/HAR, media, and lazy-loaded resources;
- execute safe hover, focus, click, keyboard, scroll, touch, and drag probes;
- save Playwright traces for difficult flows.

Create a state inventory before coding. Use [references/state-capture.md](references/state-capture.md) for the suggested schema and replay format.

Do not begin implementation from a screenshot alone. For every route, record a state row before coding with: URL, viewport, scroll position, visible regions, interactive targets, expected action sequence, and screenshot/DOM/accessibility evidence. Treat this inventory as the test plan; add a row whenever exploration reveals a new menu, modal, empty state, loading state, or intermediate state.

When source is available, make a source inventory before writing replacement code. Classify each relevant item as:

| Layer | Record | Why it matters |
|---|---|---|
| HTML/DOM | semantic structure, IDs/classes, repeated blocks, slots, accessibility attributes, route shells | preserves hierarchy, selectors, focus order, and layout ownership |
| CSS | stylesheets, custom properties, media queries, container queries, pseudo-elements, transitions, keyframes, stacking contexts | preserves geometry, responsive rules, layering, and motion |
| JavaScript | event listeners, state variables, route transitions, DOM mutations, observers, timers, gesture handlers, animation drivers | preserves interaction sequence and timing |
| Assets/fonts | exact URLs, intrinsic dimensions, preload/lazy rules, font weights and loading behavior | prevents visual drift caused by substitutes |
| Data/network | API calls, request parameters, response shapes, loading/error/empty states | preserves dynamic behavior and state transitions |

Follow references from HTML to CSS and JavaScript rather than copying files blindly. Map each visible interaction to the source symbol or handler that implements it, then verify it in the browser. Source classification is the implementation shortcut; browser capture remains the authority for computed styles, lazy assets, event ordering, and behavior introduced by build output or runtime data.

### 3. Choose the implementation path

- Static HTML/CSS: mirror assets, then preserve structure and behavior.
- React/Vue/Next content site: rebuild the component tree and feed captured content/data.
- SPA or SaaS: replay captured API fixtures or create a local mock server; preserve loading, empty, error, and success states.
- WebGL/Canvas/media-heavy UI: capture runtime behavior and frame baselines first. Rebuild only after the observable states are reproducible.
- Login, payment, permissions, or proprietary server logic: clone the observable frontend contract with explicit local substitutes and document the boundary.

Do not prematurely abstract components when the abstraction changes layout, event order, focus behavior, or animation timing.

### 4. Implement in evidence order

Match structural geometry, typography, assets, colors, responsive breakpoints, and stacking context first. Then implement event handlers and state transitions. Finally match animation timing, easing, scroll physics, canvas/WebGL, and media synchronization. Preserve URLs, focus movement, keyboard behavior, and scroll restoration where observable.

### 5. Replay and compare

Run each captured flow on both sites from a clean context. Capture the reference first, then replay the identical actions on the clone. Do not compare pages captured at different viewport sizes, scroll positions, fonts, or interaction states.

For each checkpoint, produce four artifacts:

1. reference screenshot;
2. clone screenshot;
3. 50% alpha overlay or blink comparison;
4. pixel-diff image plus a geometry/style table for key elements.

Use screenshot comparison to locate visual drift, then inspect bounding boxes and computed styles to identify the cause. Compare at minimum: page shell bounds, navigation widths, headings, text baselines, buttons, cards, overlays, and scroll containers. A screenshot that looks close by eye is not sufficient evidence.

Compare:

- route/URL and state transitions;
- element geometry and scroll position;
- font loading, image identity, computed colors, and key CSS properties;
- screenshots at initial, intermediate, and final states;
- console errors and network contract;
- responsive behavior at every selected viewport.

Fix the earliest divergent state, then replay downstream states. A later visual tweak must not conceal an earlier timing or coordinate error.

### 6. Report honestly

Deliver a parity report listing tested routes, viewport matrix, flows, evidence paths, known gaps, inaccessible assets, and license notes. Separate measured matches from approximations. Do not claim an interaction worked if the browser could not trigger the same event (for example, an untrusted synthetic pointer event).

## Acceptance gate

A flow is complete only when all of the following are true:

- the state inventory row exists and has been replayed on both sites;
- the same input sequence reaches the same URL, scroll position, focus state, menus, dialogs, and intermediate states;
- key element geometry is within an explicit tolerance, normally 1–2 px;
- screenshot overlay and pixel diff are reviewed at every checkpoint, with a documented threshold;
- fonts, icons, assets, colors, and computed typography match or have a recorded reason for substitution;
- there are no new console errors or unexplained missing network/assets;
- the interaction works through the browser, rather than only through synthetic state or static markup.

`npm run build`, a successful page load, or a single manually inspected screenshot is never an acceptance signal by itself. Do not claim completion while any required checkpoint lacks a reference screenshot, clone screenshot, diff, or replay result. Relax thresholds only for nondeterministic media, remote data, or platform rendering differences, and record the reason in the parity report.

For every unresolved mismatch, record: reference state, clone state, reproduction steps, evidence, likely cause, and next action. Do not replace a missing asset, font, API, or interaction with a silent placeholder.

## Useful tools

Prefer Playwright screenshots, Trace Viewer, HAR recording, browser context isolation, and a pixel-diff tool. Use CDP when Playwright does not expose the needed runtime, network, canvas, or performance evidence. Existing project tooling takes precedence over adding dependencies; do not install a browser merely to run this skill.

## Executable toolkit

This repository includes optional Node helpers for the repeatable parts of the workflow. Read [references/toolkit.md](references/toolkit.md) when the task needs automated evidence rather than a one-off browser inspection.

- `scripts/capture-page.mjs` opens a URL at a fixed viewport, waits for fonts and images, records HTML/ARIA/source inventory/console/network evidence, and writes a screenshot.
- `scripts/replay-flow.mjs` replays a JSON action sequence in an isolated context and waits for the clone ready checkpoint before each interaction.
- `scripts/compare-screenshots.mjs` writes a pixel diff and a mismatch ratio that can be checked in CI.
- `scripts/lib/ready.mjs` is the shared readiness contract. A clone should set `data-page-ready="true"` only after its data and visible UI are ready; the marker remains optional for third-party reference pages.

Use these helpers to create evidence artifacts and reports. They do not replace browser judgment: inspect intermediate states, check geometry and accessibility, and document dynamic or inaccessible resources.
