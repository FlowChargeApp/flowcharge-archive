---
id: PLN-60-f7jh0n
type: plan
workstream: WS-71-0ca13u
slug: flowcharge-theme-palette-and-toggle
title: "FlowCharge palette for the Dashboard, with a three-state theme toggle"
status: done
created: 2026-08-28
updated: 2026-08-28
depends_on: []
links: []
---

# FlowCharge palette and theme toggle

## Summary

The Dashboard keeps its own arbitrary teal-and-grey light and dark colours, and it
has no theme control. This plan does two things. First, it gives the app a real
theme mechanism: one stored mode (`system` / `light` / `dark`), resolved to a
concrete `data-theme` attribute on `:root` by a small synchronous script in
`<head>`, with dark as the default when nothing is stored. Second, it replaces the
values of the chrome tokens (`--ink*`, `--paper*`, `--line*`, `--accent*`,
`--shadow`) with values derived from the FlowCharge website's own theme file,
`/Users/akoukoullis/Work/AK/Praxis-Website/app/steel-theme.css`.

The chosen approach resolves `system` in JavaScript instead of in CSS. That lets
`src/public/styles.css` carry exactly **two** palette blocks — `:root` for light and
`:root[data-theme="dark"]` for dark — instead of the **four** it carries today
(`:root`, `@media (prefers-color-scheme: dark)`, `:root[data-theme="dark"]`,
`:root[data-theme="light"]`), where every status and severity value is written out
four times and can drift.

The mechanism ships first, on the current colours. The palette swap follows as a
separate phase. Neither phase can leave the app without a working dark mode.

## Scope

### In scope, as acceptance criteria

1. On first launch, with nothing in storage, the app renders in dark mode.
2. A three-button control appears on the home page and on the board page. The three
   buttons are icon-only — a monitor for `system`, a sun for `light`, a moon for
   `dark` — and each carries `aria-label` and `title` reading `Match system theme`,
   `Light theme` and `Dark theme`. The button matching the stored mode is marked
   active.
3. Clicking `Light` repaints the page in the light palette immediately, with no
   reload. Clicking `Dark` does the same for dark.
4. Clicking `System` makes the page follow the operating system's setting, and the
   page repaints when the operating system's setting changes while the app is open.
5. The chosen mode survives a reload and a full app restart.
6. No light-to-dark or dark-to-light flash is visible at load for the stored mode.
7. In the packaged Electron app, choosing `Light` or `Dark` also changes the native
   chrome: the folder-picker dialog opened by `Choose folder` matches the choice.
8. In a plain browser tab (`npm start`, no Electron), every one of points 1 to 6
   still holds and nothing logs an error.
9. The page background, the board columns, the workstream cards (head, body and
   foot) and the four KPI panels are painted in the FlowCharge palette in both
   modes. Light mode's page background is the warm cream `#E9E1D5`. Dark mode's is
   `#22252E`.
10. The board's status colours (`--st-*`) and severity colours (`--sev-*`) render
    exactly the same hex values before and after this work, in both modes.
11. Body text meets 4.5:1 against the surface behind it, and every border or
    control edge that carries meaning meets 3:1, in both modes.
12. `npm run build` and `npm run build:release` both succeed, and the eval guard in
    `tools/bundle-public.mjs` stays clean.

### Out of scope

- The masthead, header and footer redesign. That is WS-70.
- Any change to `--st-*` or `--sev-*` values, in either mode.
- The favicon and app-icon work, still blocked in WS-70.
- The website's body radial gradient. It is not ported.
- A settings screen. The toggle is the whole of the user interface.

### Assumptions

These are taken as the most reasonable reading. They are not confirmed.

- **Release constraints.** The app is private, single-user, unsigned, and ships no
  server-side state. There is no production data and no live user population to
  protect. So this feature needs no flag, no dark launch and no staged rollout. It
  lands whole.
- **Rollback.** Every phase is reverted by reverting its own commit. There is no
  migration to reverse. A stale `praxis-theme` key left in `localStorage` after a
  revert is inert.
- **Browser support.** The renderer is Chromium only, from Electron 43 or the
  author's own browser. `matchMedia`, `localStorage`, `color-mix()` and
  `:root[data-theme]` are all already relied on by the shipped
  `src/public/styles.css` and bundles, so no fallback is planned.
- **The `.seg` component is the right control.** `src/public/styles.css:260-274`
  already defines a three-state joined segmented control, used twice in
  `src/public/board.html:44-54`. The toggle reuses it rather than introducing a new
  control shape.

## Design

### Verified constraints found during reconnaissance

These four facts each change the design, and each was checked in the code.

- **Inline scripts are refused.** `src/server.ts:32` sets
  `script-src 'self'` with no `'unsafe-inline'`, and that header is attached to
  every static response at `src/server.ts:456`. The pre-paint theme script
  therefore **cannot** be an inline `<head>` script, as the workstream record
  suggested. It must be its own same-origin file, `theme-init.js`, loaded with a
  plain synchronous `<script src>` in `<head>`. A same-origin file satisfies
  `'self'` and needs no CSP change.
- **A new script file needs a new bundle entry point.**
  `tools/bundle-public.mjs:62-66` declares exactly two entry points, `home` and
  `app`, and its comment says so explicitly. `theme-init.ts` is a third, because it
  must load and run before the page's own bundle. `src/public/tsconfig.json`'s
  `include` array also lists every renderer source file by name and must gain the
  new ones.
- **The dead `:root[data-theme="light"]` block becomes redundant, not reusable.**
  `src/public/styles.css:106-118` duplicates the light `:root` values at
  lines 9-51 verbatim. Once the `@media (prefers-color-scheme: dark)` block at
  lines 53-92 is deleted, plain `:root` is already the light theme for every case
  where `data-theme` is not `"dark"`. The light attribute block is deleted. The
  dark attribute block at lines 93-105 is the one that gets wired up and repointed,
  as the workstream record expected.
- **Three hardcoded `#fff` values will break in dark mode.**
  `src/public/styles.css:131` (`::selection`), `:272` (`.seg button.active`) and
  `:294` (`.filter-chips button.active`) paint white on `var(--accent)`. Today's
  dark `--accent` is `#4FB8B0`; the new dark `--accent` is `#95AABB`, and white on
  `#95AABB` is 2.4:1 — a real regression. A new token `--accent-on` carries the
  correct foreground for `--accent` per mode, and those three rules point at it.
  The fourth consumer, `.add-form button` at `:682-690`, already uses
  `var(--paper-raised)` and is repointed to `--accent-on` for one rule rather than
  two.

### Contract 1 — the stored theme

One key, three values, owned by the renderer.

```
localStorage key:  "praxis-theme"
stored values:     "system" | "light" | "dark"
absent or unknown: treated as "dark"
```

`localStorage` is the single source of truth. Nothing else persists the mode. The
main process is *told* the current mode each load so it can align native chrome for
that session, and it stores nothing.

### Contract 2 — `src/public/theme.ts` (new)

The whole of the theme logic, as pure functions plus one DOM write. No DOM query,
no event binding, no storage write beyond `setMode`.

```ts
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'praxis-theme';
export const DEFAULT_MODE: ThemeMode = 'dark';

// Reads and validates. Any absent, unparseable or unrecognised value → DEFAULT_MODE.
// Must not throw: localStorage access throws in some privacy modes.
export function readMode(): ThemeMode;

// 'system' → the OS preference now; 'light'/'dark' → themselves.
export function resolveMode(mode: ThemeMode): ResolvedTheme;

// Writes data-theme on documentElement. Never removes the attribute:
// the attribute always holds a resolved 'light' or 'dark'.
export function applyResolved(resolved: ResolvedTheme): void;

// Persists the mode, applies it, and returns the resolved value.
export function setMode(mode: ThemeMode): ResolvedTheme;

// Registers a matchMedia change listener that re-applies while mode === 'system'.
// Called once per page, by theme-init.ts.
export function watchSystemPreference(): void;
```

What this module knows about: `localStorage`, `matchMedia`,
`document.documentElement`. What it must **not** know about: any page's markup, the
`.seg` control, Electron, and `window.praxisThemeAPI`.

### Contract 3 — `src/public/theme-init.ts` (new, third bundle entry point)

Four lines of body. It imports `theme.ts`, calls
`applyResolved(resolveMode(readMode()))` and then `watchSystemPreference()`. It is
loaded synchronously in `<head>` of both pages, so `data-theme` is on the root
element before the first paint. It touches no other element and wires no control.

### Contract 4 — `src/public/theme-toggle.ts` (new, side-effect import)

The renderer half of the control, following the precedent
`src/public/update-banner.ts` sets exactly: the markup ships in both HTML files, and
this module only wires it and reflects state. Pulled into both bundles by a
side-effect `import './theme-toggle';` in `src/public/app.ts:8` and
`src/public/home.ts:20`, beside the two that are already there. It has no entry
point and no output file of its own.

It queries `#theme-seg`, returns silently when absent, delegates one `click`
listener on the container (the same delegated pattern `app.ts` already uses for
`#sort-key-seg`), resolves the button with `closest('button[data-mode]')` because
Contract 5's buttons are icon-only and most clicks land on the inner `<svg>`,
calls `setMode` from `theme.ts`, moves the `active` class, and
then calls `window.praxisThemeAPI?.setThemeSource(mode)` as fire-and-forget. In a
plain browser tab that global is absent and the call is skipped, exactly as
`update-banner.ts` guards `window.praxisUpdateAPI`.

### Contract 5 — the control's markup

Identical in `src/public/index.html` and `src/public/board.html`, added as the last
child of `<header class="masthead">`. It reuses `.seg` and `.seg button` verbatim
and adds **no** CSS.

The three buttons are icon-only. A monitor glyph is `system`, mirroring the sibling
website's own light/dark control, with a third glyph added because the website's
control has only two states. A sun is `light` and a moon is `dark`. Each button
carries `aria-label` and `title` with the text that used to be the visible label,
so the accessible name and the tooltip are unchanged by going icon-only. This markup
is taken verbatim from the hand-approved mockups at `mockups/home-toolbar-mockup.html`
and `mockups/board-toolbar-mockup.html`.

```html
<div class="seg" id="theme-seg" role="group" aria-label="Theme">
  <button type="button" data-mode="system" aria-label="Match system theme" title="System">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
  </button>
  <button type="button" data-mode="light" aria-label="Light theme" title="Light">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
  </button>
  <button type="button" data-mode="dark" aria-label="Dark theme" title="Dark">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>
  </button>
</div>
```

The glyphs inherit their colour from `currentColor`, so `.seg button` and
`.seg button.active` already paint them correctly in both modes. They carry no
`width` or `height` attribute. In the mockups their size comes from one rule,
`.toolbar .seg button svg { width: 13px; height: 13px; }`, which sits inside the
toolbar-scoped block that **WS-70 owns**. This plan still adds no CSS. See Open
question 3.

No button carries `class="active"` in the markup. `theme-toggle.ts` sets it from
storage on load, so the served HTML never contradicts the stored mode.

### Contract 6 — the Electron channel

A fourth preload global, following the precedent the three existing ones set in
`electron/preload.cts` — kept separate rather than folded into `praxisAPI`.

```ts
// electron/preload.cts
contextBridge.exposeInMainWorld('praxisThemeAPI', {
  setThemeSource: (mode: string): Promise<void> =>
    ipcRenderer.invoke('setThemeSource', mode),
});
```

`electron/theme-ipc-handlers.cts` (new) registers `setThemeSource`. It validates the
argument against the three literals at the boundary and ignores anything else — the
renderer cannot set an arbitrary value. On a valid value it assigns
`nativeTheme.themeSource`. Electron's own values are the same three strings, so no
mapping table is needed. The handler returns nothing, reads nothing, and persists
nothing.

`electron/main.cts` registers it beside the three existing `register*IpcHandlers()`
calls at lines 95-97, and gains one property on the `BrowserWindow` options at
line 22: `backgroundColor: '#22252E'`, the dark page background. Without it the
native window paints white before the first frame, which is the flash the pre-paint
script exists to prevent.

### Contract 7 — the palette

Every value below is either taken from `/Users/akoukoullis/Work/AK/Praxis-Website/app/steel-theme.css`
verbatim, or derived by the same two operations that file permits: a straight-line
sRGB mix of a palette colour toward black or white, or toward that block's own
background. No third operation is introduced. The five source swatches are
`#434A5B` slate, `#D5E0E9` powder, `#5C7C96` steel, `#A2805B` bronze and
`#D2C2AA` oak.

**Light — `:root`**

| Dashboard token | Value | Derivation | Website role |
|---|---|---|---|
| `--paper` | `#E9E1D5` | oak mixed 50% toward white | `--background` |
| `--paper-raised` | `#EFEAE1` | oak mixed 65% toward white | `--card` |
| `--paper-sunken` | `#DED2C0` | oak mixed 50% toward `--paper` | `--muted` |
| `--ink` | `#434A5B` | slate, verbatim | `--foreground` |
| `--ink-soft` | `#545967` | slate mixed 10% toward `--paper` | `--muted-foreground` |
| `--ink-faint` | `#5C616D` | slate mixed 15% toward `--paper` | none — new tier |
| `--line` | `#D2C2AA` | oak, verbatim | `--secondary` |
| `--line-strong` | `#7D7F86` | slate mixed 35% toward `--paper` | `--border` |
| `--accent` | `#455D71` | steel mixed 25% toward black | `--primary` |
| `--accent-ink` | `#2F3440` | slate mixed 30% toward black | `--accent-foreground` |
| `--accent-soft` | `#DBE0E3` | powder mixed 30% toward `--paper` | none — new tier |
| `--accent-on` | `#FFFFFF` | white | `--primary-foreground` |
| `--rule-strong` | `#9A7A56` | bronze mixed 5% toward black | `--rule-strong` |
| `--shadow` | `0 1px 2px rgba(67,74,91,0.10), 0 1px 1px rgba(67,74,91,0.06)` | slate at low alpha | `--shadow-ambient` |

**Dark — `:root[data-theme="dark"]`**

| Dashboard token | Value | Derivation | Website role |
|---|---|---|---|
| `--paper` | `#22252E` | slate with each channel halved | `--background` |
| `--paper-raised` | `#2A2E39` | slate mixed 75% toward `--paper` | `--card` |
| `--paper-sunken` | `#16181E` | `--paper` mixed 35% toward black | none — new tier |
| `--ink` | `#D5E0E9` | powder, verbatim | `--foreground` |
| `--ink-soft` | `#9FA8B1` | powder mixed 30% toward `--paper` | `--muted-foreground` |
| `--ink-faint` | `#8D959E` | powder mixed 40% toward `--paper` | none — new tier |
| `--line` | `#3B3F46` | powder mixed 75% toward `--paper`, then 25% toward black | none — new tier |
| `--line-strong` | `#6A7079` | powder mixed 60% toward `--paper` | `--border` |
| `--accent` | `#95AABB` | steel mixed 35% toward white | `--primary` |
| `--accent-ink` | `#D5E0E9` | powder, verbatim | `--accent-foreground` |
| `--accent-soft` | `#333845` | slate mixed 50% toward `--paper` | `--muted` |
| `--accent-on` | `#22252E` | `= --paper` | `--primary-foreground` |
| `--rule-strong` | `#A2805B` | bronze, verbatim | `--rule-strong` |
| `--shadow` | `0 1px 3px rgba(0,0,0,0.35)` | unchanged — black, not a palette colour | `--shadow-ambient` |

**Why dark `--line` is derived from powder, not from slate**

An earlier draft of this table derived dark `--line` from slate, as
`#2F3440` — slate mixed 60% toward `--paper`. Live review of the two mockups rejected
that value. Slate is itself a dark swatch, so mixing it toward an already-dark
background can never climb far above the panel tones the border has to outline.
`#2F3440` landed only 5 to 7 units per channel from `--paper-raised` (`#2A2E39`), so
the border read as flat rather than as a visible hairline.

The corrected value is derived the same way `--line-strong` already is, from the
light swatch: powder mixed 75% toward `--paper` gives `#4F545D`, which a second round
of review found too bright, so each channel is then multiplied by 0.75 — a mix 25%
toward black. That gives `#3B3F46`, which is the value both mockups carry in their
final state. Both steps are permitted operations, so no third operation is
introduced. Light `--line` is unaffected and stays `#D2C2AA`, oak verbatim.

**Contrast, computed against the surface each token is painted on**

| Pair | Ratio | Verdict |
|---|---|---|
| light `--ink` on `--paper` | 6.6:1 | body text, passes AA |
| light `--ink-soft` on `--paper` | 5.4:1 | passes AA |
| light `--ink-faint` on `--paper` | 4.8:1 | passes AA — today's `#7A8389` is 3.1:1 and fails |
| light `--line-strong` on `--paper` | 3.1:1 | control edges, passes the 3:1 non-text rule |
| light `--accent` on `--paper` | 5.3:1 | link text, passes AA |
| light `--accent-on` on `--accent` | 6.9:1 | active segment label, passes AA |
| dark `--ink` on `--paper` | 15.4:1 | passes AA |
| dark `--ink-soft` on `--paper` | 6.4:1 | passes AA |
| dark `--ink-faint` on `--paper` | 5.0:1 | passes AA |
| dark `--line-strong` on `--paper` | 3.2:1 | passes the 3:1 non-text rule |
| dark `--accent` on `--paper` | 6.4:1 | passes AA |
| dark `--accent-on` on `--accent` | 5.5:1 | passes AA |

`--line` is deliberately below 3:1 in both modes — the corrected dark value
`#3B3F46` measures 1.5:1 on `--paper`. It draws hairlines and the KPI strip's
one-pixel gutters — decoration that separates surfaces already separated by tone.
Today's `--line` is at the same low ratio, so this is parity, not a regression.
`--line-strong` carries every edge that means something.

**Frozen, and why**

`--st-backlog`, `--st-ready`, `--st-in-progress`, `--st-blocked`, `--st-done`,
`--st-dropped`, their six `-bg` companions, `--sev-critical`, `--sev-high`,
`--sev-medium` and `--sev-low` keep their current values in both modes. The five
swatches hold no red and no green, and the website's own theme file leaves
`--destructive` untouched for the same reason.

`--chain` and `--chain-soft` are also left untouched — see Open questions.

### Where bronze lands

Bronze is the one swatch with no obvious chrome role. It gets exactly one home:
`--rule-strong`, consumed by one selector, `.card-foot` at
`src/public/styles.css:410`, whose dashed top rule currently uses `var(--line)`.
That is the workstream card's footer divider — one of the elements the request names
directly. This is the only new token with a single consumer, and it exists as a
token rather than a literal because it needs a value in each of the two theme
blocks.

### Files touched

| File | Change |
|---|---|
| `src/public/theme.ts` | new — Contract 2 |
| `src/public/theme-init.ts` | new — Contract 3 |
| `src/public/theme-toggle.ts` | new — Contract 4 |
| `src/public/styles.css` | delete lines 53-92 and 106-118; repoint 93-105; new values in `:root`; two new tokens; four `#fff`/`--paper-raised` repoints; `.card-foot` rule |
| `src/public/index.html` | `<script src="theme-init.js">` in `<head>`; the `.seg` markup |
| `src/public/board.html` | the same two additions |
| `src/public/app.ts` | one side-effect import |
| `src/public/home.ts` | one side-effect import |
| `src/public/tsconfig.json` | three names added to `include` |
| `tools/bundle-public.mjs` | third entry point, and the comment above it |
| `electron/theme-ipc-handlers.cts` | new — Contract 6 |
| `electron/preload.cts` | fourth `exposeInMainWorld` block |
| `electron/main.cts` | one `register` call; `backgroundColor` on the window |

`tools/copy-assets.mjs` needs no change: `theme-init.js` is a bundle output, not a
copied asset.

## Staged task breakdown

### Phase 1 — The theme mechanism, on today's colours

Small to medium. No dependencies.

- **Write `src/public/theme.ts`** to Contract 2. Wrap every `localStorage` access in
  `try`/`catch` so a privacy mode that throws on access still renders a theme.
- **Write `src/public/theme-init.ts`** to Contract 3.
- **Add the third entry point** to `tools/bundle-public.mjs:62-66`, and rewrite the
  comment above it that says there are exactly two.
- **Add `theme.ts` and `theme-init.ts`** to `include` in
  `src/public/tsconfig.json`.
- **Add `<script src="theme-init.js"></script>`** to `<head>` of
  `src/public/index.html` and `src/public/board.html`, after the stylesheet link.
- **Restructure `src/public/styles.css`.** Delete the `@media (prefers-color-scheme: dark)`
  block at lines 53-92 and the `:root[data-theme="light"]` block at lines 106-118.
  Expand the `:root[data-theme="dark"]` block at lines 93-105 onto one declaration
  per line, matching the `:root` block's own formatting. Values are **not** changed
  in this phase.

Verify: run `npm start`. The board loads dark, because nothing is stored and the
default is dark. In the console, `localStorage.setItem('praxis-theme','light')` then
reload — the board is light, with no dark flash. Set it to `'system'`, reload, then
change the operating system's appearance while the window is open — the board
follows without a reload. Confirm `document.documentElement.dataset.theme` is always
`light` or `dark`, never `system` and never absent.

### Phase 2 — The toggle control

Small. Depends on Phase 1.

- **Add the `.seg` markup** of Contract 5 to the masthead of both HTML files.
- **Write `src/public/theme-toggle.ts`** to Contract 4, and add it to
  `include` in `src/public/tsconfig.json`.
- **Add `import './theme-toggle';`** to `src/public/app.ts` and
  `src/public/home.ts`, beside the existing side-effect imports.

Verify: run `npm start`. The control appears on both pages. Clicking each of the
three buttons repaints immediately and marks that button active. Reload — the same
button is still active and the theme is unchanged. Navigate from the home page to a
board and back — the mode is the same on both pages.

### Phase 3 — Electron native chrome

Small. Depends on Phase 2, which produces the mode this phase reports.

- **Write `electron/theme-ipc-handlers.cts`** to Contract 6, validating the argument
  against the three literals before touching `nativeTheme`.
- **Add the `praxisThemeAPI` block** to `electron/preload.cts`.
- **Register the handler** in `electron/main.cts` beside lines 95-97, and add
  `backgroundColor: '#22252E'` to the `BrowserWindow` options at line 22.

Verify: run `npm run electron:dev`. Choose `Light`, then click `Choose folder` on
the home page — the native folder picker is light. Choose `Dark` and repeat — it is
dark. Choose `System` and confirm the picker follows the operating system. Then run
`npm start` in a plain browser tab and confirm the toggle still works and the console
is clean, proving the `praxisThemeAPI` guard holds.

### Phase 4 — The FlowCharge palette

Medium. Depends on Phase 1 for the two-block structure.

- **Replace the values** in `:root` and `:root[data-theme="dark"]` with Contract 7's
  two tables. Add a header comment naming the five swatches, the two permitted
  derivation operations and this plan's id, mirroring the website file's own header.
- **Add `--accent-on` and `--rule-strong`** to both blocks.
- **Repoint the hardcoded foregrounds**: `src/public/styles.css:131`, `:272` and
  `:294` change `color: #fff` to `color: var(--accent-on)`, and `:686` changes
  `color: var(--paper-raised)` to `color: var(--accent-on)`. Line 295,
  `.filter-chips button.blocked-toggle.active`, keeps its `#fff` — it sits on
  `--sev-critical`, which is frozen.
- **Point `.card-foot`'s dashed rule** at `var(--rule-strong)` at line 410.
- **Leave every `--st-*` and `--sev-*` declaration byte-for-byte unchanged.**

Verify: open the board beside the FlowCharge website in both modes and confirm the
page backgrounds, card surfaces and text tones read as the same theme. Diff the
`--st-*` and `--sev-*` lines against the previous commit and confirm zero changes.
Spot-check the twelve pairs in Contract 7's contrast table with the browser's
contrast inspector. Confirm the four KPI panels, the column heads and the card
head/body/foot all changed. Confirm no purple, red, green or amber board colour
moved.

### Phase 5 — Build and package check

Small. Depends on Phase 4.

Run `npm run build`, then `npm run build:release`. Confirm both succeed, that the
eval guard reports clean across three bundles rather than two, and that
`dist/public/theme-init.js` exists and is minified in the release build. Then run
`npm run package:mac` and launch the packaged app to confirm the pre-paint script is
present in the packaged `dist/` and no flash occurs.

## Data & compatibility

- **No migration.** The feature adds one `localStorage` key. Nothing existing is
  read, rewritten or moved. `.praxis-projects.json` and `.praxis-update.json` are
  untouched.
- **No API change.** No `/api/*` route, request shape or response shape changes.
  `src/lib/extract.ts` and the whole server data path are untouched.
- **New IPC surface.** One channel, `setThemeSource`, taking one string validated
  against three literals in the main process. It is the only new attack surface, and
  it can set nothing but Electron's own theme source.
- **CSP.** Unchanged. `script-src 'self'` already permits a same-origin
  `theme-init.js`, which is precisely why the pre-paint script is a file rather than
  an inline block.
- **Rollback.** Per phase, by reverting that phase's commit. Reverting Phase 4 alone
  restores the old colours and keeps the toggle. Reverting Phases 1 to 3 removes the
  toggle and leaves a stray `praxis-theme` key that nothing reads. Reverting Phase 1
  without Phase 4 would leave the app with no dark mode at all, so the two are
  reverted together or in that order.
- **Forward compatibility.** An older build reading a newer `praxis-theme` value it
  does not recognise falls back to `DEFAULT_MODE`, by Contract 1.

## Testing strategy

This repository has no test harness: `package.json` declares no `test` script and
no test runner, and there is no test directory. Introducing one is a separate
decision and is not planned here. Verification is therefore the manual, observable
steps written into each phase above.

If a harness is added later, the natural units are the three pure functions in
`src/public/theme.ts` — `readMode` against absent, valid and junk stored values,
`resolveMode` against a stubbed `matchMedia`, and `setMode`'s round trip through
storage. The IPC handler's literal validation is the natural second unit. The palette
itself is not unit-testable in any useful way; contrast is checked by inspection
against Contract 7's table.

## Open questions

1. **`--chain` and `--chain-soft` — freeze them, or recolour them?** These carry the
   dependency-chain outline and its halo, at `src/public/styles.css:415-418`. They
   are purple in both modes. Decision 1 of the brief recolours "any other non-status,
   non-severity token", which sweeps them in by wording, but they behave like the
   status colours: a signal that must stand out against every card, and the palette
   holds nothing that would serve. This plan leaves them untouched, which is the
   zero-work path and blocks nothing. **Recommendation: leave them.** The purple will
   read as louder against the warm cream than it does against today's cool grey; if
   that offends, the smallest fix is a separate one-line change to a bronze-adjacent
   outline, not part of this plan.
2. **Where should the toggle sit once WS-70 redesigns the masthead?** This plan puts
   it in the masthead of both pages because that is the one container both pages
   share, and it adds no masthead layout CSS. WS-70 may want it somewhere else.
   **Recommendation: land it in the masthead now and let WS-70 move it**, since
   moving three lines of markup is cheap and the alternative is blocking this
   workstream on WS-70.
3. **Who ships the icon sizing rule?** Contract 5's glyphs carry no `width` or
   `height` attribute, so they need one CSS rule to get a size. In the mockups that
   rule is `.toolbar .seg button svg { width: 13px; height: 13px; }`, inside the
   toolbar-scoped block WS-70 owns. This plan still adds no CSS, so until WS-70's
   toolbar CSS lands the glyphs render at the browser's default replaced-element
   size. **Recommendation: leave the rule with WS-70**, because duplicating it here
   would give one declaration two owners. If the two workstreams land far apart in
   time, the smallest fix is a one-line unscoped `.seg button svg` rule, which is a
   separate decision and not part of this plan.

## Alternatives considered and rejected

- **Resolve `system` in CSS, by retargeting the media query to
  `:root:not([data-theme])`.** This is what the workstream record suggested. It
  keeps dark mode working with JavaScript disabled and needs no `matchMedia`
  listener. Rejected because it keeps two full copies of every dark value — the
  `@media` block and the `[data-theme="dark"]` block — in a file that already holds
  four copies of the palette and has no mechanism to keep them in step. The whole
  board is JavaScript-rendered, so a JavaScript-free dark mode protects nothing that
  is otherwise reachable.
- **An inline `<head>` script for the pre-paint apply.** Rejected on evidence:
  `src/server.ts:32` sets `script-src 'self'` with no `'unsafe-inline'`, so the
  browser would refuse to run it. Widening the CSP to buy back an inline block would
  trade a real security property for one saved HTTP request against a loopback
  server.
- **A two-way light/dark switch instead of three states.** Rejected because it
  cannot express "follow the operating system", which the request explicitly asks
  for, and because Electron's `nativeTheme.themeSource` has the same three states.
  This decision stands. The three states are unchanged by the move to icon-only
  buttons.
- **Text labels on the three buttons, reading `System | Light | Dark`.** This was the
  first draft of Contract 5. Rejected during live review of the two mockups: three
  words in the toolbar crowd the wordmark and the breadcrumb, and the sibling website
  already states the pattern with glyphs. The accessible name is not lost, because
  each button keeps the same text in `aria-label` and `title`.
- **Draw new icons for the three states.** Rejected: the monitor glyph is the sibling
  website's own light/dark control, so reusing it keeps the two products consistent.
  Only the third state needed a glyph the website does not have. Contract 5 therefore
  copies the mockups' path data verbatim rather than restating it.
- **Make the main process own the persisted mode, in a JSON file beside
  `.praxis-update.json`.** This would let the window's `backgroundColor` be exactly
  right at launch for a light-mode user, removing the last trace of flash. Rejected
  because the pre-paint script must read the mode synchronously and IPC is
  asynchronous, so `localStorage` has to hold it anyway — and two stores holding one
  value is a drift bug waiting to happen. The accepted cost is a brief `#22252E`
  window frame before a light page paints, which matches the dark default.
- **Make "system" the default rather than dark.** The request offered either. Dark
  is chosen because the request named it first and because it is the state a user
  gets with no configuration on any operating system. "System" stays available as an
  explicit third choice, which is the part the request actually asked to be
  possible.
- **Paste the five raw swatches onto surfaces directly.** Rejected on the measured
  numbers already in the workstream record: steel is 3.3:1 and bronze 2.7:1 against
  powder, so raw swatches as text fail. Every value in Contract 7 is a derived tier
  or a verbatim swatch used only where it measures safely.
- **Keep the app's cool powder-blue light background.** Rejected: the brief settles
  it, and the website's warm cream exists specifically so the rest of the palette
  reads at proper contrast on top of it.
- **Give `--ink-faint` a wider tonal gap from `--ink-soft` in light mode**, at
  around 3.6:1. Rejected because `--ink-faint` paints real small text — dates, counts
  and 10.5px uppercase labels — and 4.5:1 is the floor for that. The hierarchy
  between the two tiers is carried by size, weight, letter-spacing and case, which
  `.kpi-label`, `.tagline` and `.card-foot .updated` already differ on.
- **Port the website's radial background gradient.** Rejected in the brief: it is a
  marketing-site visual tell and it would fight a dense board.

## Final summary

- **Approach:** resolve the theme in JavaScript, write one `data-theme` attribute
  before first paint, and let `src/public/styles.css` carry just two palette blocks
  holding values derived from the website's `steel-theme.css`.
- **Five phases**, four of them small, one medium. Roughly a day of focused work.
- **Top risks:** the three hardcoded `#fff` values silently failing contrast in dark
  mode if `--accent-on` is skipped; the new `theme-init` entry point being missed in
  `tools/bundle-public.mjs` or `src/public/tsconfig.json` and failing only at
  runtime; and a masthead collision with WS-70.
- **Needs your answer:** whether `--chain` and `--chain-soft` stay purple (this plan
  leaves them alone), whether the toggle may live in the masthead until WS-70
  moves it, and whether the icon sizing rule stays with WS-70 (Open question 3).
