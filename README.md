# High-Fidelity Web Clone

[简体中文](README.zh-CN.md)

A Codex skill for recreating a website's public UI, responsive layouts, and observable interactions with evidence-driven browser validation.

The workflow treats the reference site as a product specification: inventory source when available, capture the browser states that matter, reproduce those states locally, and compare the same routes and input sequences. Source code accelerates the work; runtime browser behavior remains the reference.

## Install

Clone this repository into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
git clone git@github.com:baowk/high-fidelity-web-clone.git \
  ~/.codex/skills/high-fidelity-web-clone
```

Restart or refresh Codex if the skill is not discovered automatically.

## Use

Invoke the skill in a website reconstruction request:

```text
$high-fidelity-web-clone Recreate https://example.com as a local responsive website.
```

The skill is intended for public website routes and observable frontend behavior. Login, payment, private APIs, and server-side business logic need explicit local substitutes and must be documented as scope limits.

## Workflow

1. Define routes, viewport sizes, and the parity boundary.
2. Inventory source as HTML/DOM, CSS, JavaScript, assets/fonts, and data/network behavior when source is available.
3. Capture browser states, screenshots, network activity, console output, and interaction traces.
4. Rebuild structure, styles, responsive rules, and state transitions from the collected evidence.
5. Replay equivalent actions on the reference and clone, then compare screenshots, geometry, URLs, assets, and errors.
6. Report tested states, tolerances, known gaps, and inaccessible or restricted resources.

For repeatable interaction evidence, use the state record in [`references/state-capture.md`](references/state-capture.md). For source-to-clone mapping, use [`references/source-inventory.md`](references/source-inventory.md).

## Validation principles

- Compare the same route, viewport, browser conditions, and input sequence.
- Check intermediate animation and loading states when they affect the experience.
- Record explicit geometry and screenshot-diff tolerances; document exceptions for dynamic content or rendering variance.
- Do not silently replace unavailable fonts, images, APIs, or interactions with placeholders.
- Check source and asset licenses before copying or publishing a reproduction.

## Optional executable toolkit

The repository includes small Node helpers for repeatable evidence collection and validation. They use the project's existing Playwright/browser setup and do not download a browser.

```bash
npm install
npm run capture -- --url https://example.com --name home --full-page
npm run replay -- --flow path/to/home-flow.json --trace
npm run compare -- --reference artifacts/reference/home/screenshot.png \
  --clone artifacts/clone/home/screenshot.png --fail-ratio 0.01
```

See [`references/toolkit.md`](references/toolkit.md) for capture output, flow JSON, ready markers, and comparison thresholds.

## Repository contents

- `SKILL.md` — skill trigger, workflow, acceptance criteria, and operating guidance.
- `references/state-capture.md` — state inventory and replay record format.
- `references/source-inventory.md` — HTML/DOM, CSS, JavaScript, asset, and network mapping template.
- `references/toolkit.md` — executable capture, replay, and screenshot comparison workflow.
- `scripts/` — optional Playwright capture, flow replay, readiness, and pixel-diff helpers.
- `agents/openai.yaml` — Codex skill display metadata.
