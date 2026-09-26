# Source inventory

Use this table while inspecting a source tree. Keep original files immutable when possible and record the clone mapping separately.

| Reference | Layer | Symbol/selector | Inputs | Outputs/state | Clone location | Evidence |
|---|---|---|---|---|---|---|
| `src/...` | HTML/DOM | `.hero` | route data | hero subtree | `src/components/Hero.*` | screenshot + DOM |
| `src/...` | CSS | `--surface`, `@media ...` | viewport/theme | geometry/color | `src/styles/...` | computed style |
| `src/...` | JS | `openMenu()` | click + viewport | menu/focus state | `src/...` | trace + console |

For each route, identify the page shell, shared navigation/footer, repeated content blocks, and stateful controls. For each control, record the event source, state transition, DOM mutation, focus target, URL change, network call, and animation. Use browser evidence to resolve cases where bundled code, hydration, CSS-in-JS, shadow DOM, or server data differs from the readable source.
