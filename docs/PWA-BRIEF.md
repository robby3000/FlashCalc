# FlashCalc PWA — Build Brief

A precise spec for the coding agent. **Read this whole document before writing any code.**
The single most important instruction is at the end: §11 *Do not overbuild this*.

---

## 1. What FlashCalc is

A small film-photography tool. The user picks a flash unit, sets ISO and power output, and
the app shows the correct aperture for a range of subject distances (metres or feet). The
math is guide-number based:

```
GN_iso       = GN_base × √(ISO / 100)
GN_effective = GN_iso  × √(power)
distance     = GN_effective / aperture
```

The current app is a single self-contained `flashcalc2.html` (markup + CSS + JS inline, no
build step, no dependencies). It works. The math is correct. The dark "darkroom" UI is
correct. **Do not rewrite the calculator, the styling, or the visual identity.** This brief
is about wrapping it as a PWA and adding one feature: user-managed flash units persisted in
IndexedDB.

## 2. Current state of the repo

```
flashcalc2.html   # the entire app, inline CSS + JS, ~860 lines
README.md
.gitignore
docs/PWA-BRIEF.md   # this file
```

The flash database is a hard-coded object inside `flashcalc2.html`:

```js
const flashes = {
  "Olympus A11":        { type: "fixed", guideNumber: 10 },
  "Godox Lux Junior":   { type: "fixed", guideNumber: 12 },
  "YN-560 III":         { type: "zoom",  guideNumbers: [ { zoom: 18, gn: 15 }, ... ] }
};
```

Two shapes: `fixed` (one GN at ISO 100 in metres) and `zoom` (array of `{ zoom, gn }`).

## 3. Target end state

```
index.html         # the app (renamed from flashcalc2.html), inline CSS + JS
manifest.json      # PWA manifest
sw.js              # service worker
icons/             # 192, 512, 512-maskable, plus a favicon or two
scripts/
  stamp-sw.mjs     # cache-name stamper (see §7)
package.json       # name, version, scripts: stamp / stamp:check / serve. No deps.
docs/PWA-BRIEF.md  # this file
README.md          # update to reflect the PWA
```

No `node_modules`. No bundler. No framework. No CDN. No runtime dependency of any kind.

## 4. Hard constraints

- **Single `index.html`, inline CSS and JS.** No external `.css` or `.js` files for the app
  itself. The only separate JS is `sw.js` (service workers cannot be inline) and
  `scripts/stamp-sw.mjs` (a build-time tool, never shipped).
- **Zero runtime dependencies.** No npm packages, no CDN scripts, no Dexie, no framework.
  IndexedDB is accessed with the **plain vanilla `indexedDB` API**. Dexie is overkill for a
  one-store database — do not add it.
- **No build step.** `index.html` is opened directly by the browser. The only "build" tool
  is `scripts/stamp-sw.mjs`, run by hand after changes (see §7).
- **All asset paths relative.** `./icons/...`, `start_url: "./"`, `scope: "./"`. The app
  must work at a domain root or under a subpath (e.g. a GitHub Pages project site) with no
  changes. `sw.js` derives its root from `new URL('./', self.location).pathname`, the same
  pattern as the Aimless service worker.
- **Preserve the existing calculator and UI.** The dark theme, amber accents, layout, and
  result-card animation stay. The user has already signed off on the look.

## 5. New feature: user-managed flash units

### 5.1 Storage

One IndexedDB database, one object store:

- DB name: `flashcalc`
- Store: `flashes`, keyPath `id`, auto-generated `id` (uuid or `crypto.randomUUID()`)
- Record shape:
  ```ts
  {
    id: string,
    name: string,                       // "Olympus A11"
    type: "fixed" | "zoom",
    guideNumber?: number,               // for fixed: GN at ISO 100 in metres
    guideNumbers?: Array<{zoom:number, gn:number}>,  // for zoom, sorted ascending by zoom
    builtIn?: boolean,                  // true for the three defaults; false for user-added
    createdAt: number                   // Date.now(), for stable sort order
  }
  ```

A second store is **not** required. Prefs (last-selected flash, last unit m/ft, last ISO)
can live in `localStorage` — they are non-critical and the simpler store is the right one.
Do not add a prefs store to IndexedDB unless you find a concrete reason during the build.

### 5.2 First-run seeding

On first run (detected by `flashes` store being empty), insert the three existing units
from §2 with `builtIn: true`. Use a single transaction. Never re-seed if the store already
has records.

### 5.3 UI

Add a second card below the calculator card: **"My Flash Units"**. It lists every flash in
the store, each row showing name, type, and a compact GN summary (`GN 10` for fixed,
`GN 15–58 @ 18–105mm` for zoom). Each row has:

- **Edit** — opens an inline form (or a modal) with the same fields used to add one.
- **Delete** — confirms for built-in units (they can be restored via a "Restore defaults"
  action, see below), no confirm for user-added.

A **"+ Add flash"** button at the top of the card opens an empty form. The form fields:

- Name (text, required, unique-ish — warn on duplicate but allow it)
- Type (toggle: Fixed / Zoom)
- If Fixed: Guide number at ISO 100 in metres (number, > 0)
- If Zoom: a repeatable list of `{zoom, gn}` rows with add/remove. Zoom in mm, GN in metres
  at ISO 100. Sort by zoom on save.

A **"Restore defaults"** action (small ghost button at the bottom of the card) re-inserts
any of the three built-in units that are missing, without touching user-added ones. It does
**not** reset edits the user has made to a built-in unit — only re-adds deleted ones.

### 5.4 Calculator integration

The existing `<select id="sel-flash">` is populated from IndexedDB on load and whenever the
list changes (add/edit/delete). The selected flash is persisted to `localStorage` so a
reload restores it. The zoom sub-select for zoom-type flashes works exactly as it does now.

### 5.5 Validation

- Name non-empty.
- GN > 0 for fixed; every zoom row has zoom > 0 and gn > 0.
- Zoom list non-empty for zoom type, at least one row.
- Show errors via the existing toast — do not build a separate error UI.

## 6. PWA shell

### 6.1 `manifest.json`

```jsonc
{
  "name": "FlashCalc",
  "short_name": "FlashCalc",
  "description": "Film flash exposure calculator.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "display_override": ["standalone"],
  "orientation": "portrait",
  "background_color": "#0a0a0d",
  "theme_color": "#c48200",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- `theme_color` matches the amber accent `#c48200` from the existing CSS.
- `background_color` matches `--bg: #0a0a0d`.
- **No `version` member** — it is not in the web app manifest spec and browsers ignore it.
  See Aimless `docs/cache-busting.md` §4. The cache name is the only version that matters
  and it lives in `sw.js`.

### 6.2 `index.html` head additions

Add the standard PWA meta/link tags, modelled on Aimless:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1">
<meta name="theme-color" content="#c48200">
<meta name="description" content="Film flash exposure calculator.">
<link rel="manifest" href="./manifest.json">
<link rel="icon" href="./icons/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="FlashCalc">
```

Add `env(safe-area-inset-*)` padding to the header and the bottom of the app container, the
way pomo-day does, so installed iOS PWAs clear the notch and home indicator.

### 6.3 Service worker registration

At the end of the inline `<script>` in `index.html`:

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('[sw] reg failed:', err));
  });
}
```

Register only in a secure context (the `if` is enough; SW registration is a no-op on
`http://` except for `localhost`).

## 7. Service worker — the cache-busting discipline

This is the single most important part of the PWA. **A shipped change must never be served
from a stale cache.** Read Aimless `docs/cache-busting.md` if any of this is unclear.

### 7.1 `sw.js` — modelled on the Aimless worker

```js
const CACHE = 'flashcalc-v0.1.0-XXXXXXXX';   // ← stamped by scripts/stamp-sw.mjs

const ROOT = new URL('./', self.location).pathname;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // Per-file add, not addAll: a missing icon must not block the shell.
      Promise.all(PRECACHE.map(u =>
        cache.add(u).catch(err => console.warn('[sw] precache miss:', u, err.message))
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Only purge old caches when the new one holds the complete shell.
    const cache = await caches.open(CACHE);
    const missing = [];
    for (const u of PRECACHE) {
      if (!(await cache.match(new URL(u, self.location).href))) missing.push(u);
    }
    if (missing.length) { console.warn('[sw] incomplete, keeping old caches:', missing); return; }
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  // HTML + manifest: network-first with a 3s timeout, then cache.
  if (url.pathname.endsWith('.html') || url.pathname === ROOT || url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  // Everything else (icons): cache-first.
  event.respondWith(cacheFirst(event.request));
});

// ...cacheFirst, networkFirst with 3s timeout, withTimeout — copy from Aimless sw.js
```

The three strategies and the `withTimeout` helper are copied from the Aimless worker
verbatim in shape. The 3s network timeout is load-bearing — without it, launching the
installed app on a dead-but-not-refused connection looks like "the app won't load".

### 7.2 `scripts/stamp-sw.mjs`

Copy the Aimless `scripts/stamp-sw.mjs` and adapt three constants:

- `PUBLIC` → the repo root (FlashCalc has no `public/` dir; `index.html` is at the root).
- `SW` → `./sw.js` at the repo root.
- `EXCLUDE` → `new Set(['sw.js', '.DS_Store'])` (unchanged).

The stamp hashes every file the app ships (paths + bytes, sorted, `sw.js` excluded) and
rewrites the `const CACHE = '...';` line in `sw.js` to `flashcalc-v<version>-<hash8>`. The
version comes from `package.json`.

### 7.3 `package.json`

```json
{
  "name": "flashcalc",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Film flash exposure calculator. Single-file PWA, zero dependencies.",
  "scripts": {
    "serve": "python3 -m http.server 8080",
    "stamp": "node scripts/stamp-sw.mjs",
    "stamp:check": "node scripts/stamp-sw.mjs --check"
  }
}
```

No dependencies. No `test` script is required for v0.1 (the calculator math is already
correct and unchanged); add one only if a pure-logic module gets extracted.

### 7.4 The discipline

After **any** change to `index.html`, `manifest.json`, or anything under `icons/`:

1. `npm run stamp` — rewrites the cache name in `sw.js`.
2. Commit `sw.js` **in the same commit** as the change that caused the stamp.

A change to `sw.js` alone (e.g. editing a strategy) does **not** need a re-stamp — the
byte-difference in `sw.js` itself triggers the new install, and the hash is unchanged so
the cached files survive, which is correct.

## 8. Icons

Generate the icon set from the existing lightning-bolt SVG already in the header
(`<path d="M13 2 3.5 13.5H10l-1.5 8.5L20.5 10.5H14L13 2Z"/>`) on the amber gradient
background that the header logo uses (`linear-gradient(145deg, #e09a14, #c48200)`).

Required files in `icons/`:

- `icon-192.png` (192×192, purpose `any`)
- `icon-512.png` (512×512, purpose `any`)
- `icon-512-maskable.png` (512×512, purpose `maskable` — keep the bolt within the safe
  zone, ~80% of the canvas, on the full-bleed amber background)
- `favicon-32.png` (32×32)
- `apple-touch-icon.png` (180×180, no transparency, opaque amber background)

Use whatever tool is available on the WSL box (ImageMagick `convert`, or a small Node
script using `sharp` if installable — **ask before installing anything**). If neither is
available, generate them with an inline Node script using the `node:canvas`-free approach
of writing a PNG via `zlib` is overkill — instead, ask the user to provide icons or to
approve installing ImageMagick.

## 9. Resilience checklist

These are the patterns worth copying from the Aimless and pomo-day apps. Each one has
already cost someone an afternoon; do not skip them.

- [ ] **Relative paths everywhere** — `./index.html`, `./icons/...`, `start_url: "./"`.
- [ ] **Per-file precache** (not `addAll`) — a missing icon must not block the shell.
- [ ] **Activate guards the purge** — only delete old caches when the new one is complete.
- [ ] **Network-first HTML with a 3s timeout** — see §7.1.
- [ ] **Cache name stamped from a hash of the shell** — see §7.2.
- [ ] **`skipWaiting()` + `clients.claim()`** — updates land on next load, not after every
      tab is closed.
- [ ] **IndexedDB transactions are awaited** — never fire-and-forget a write; the data is
      the whole point of the app.
- [ ] **First-run seeding is idempotent** — only seed when the store is empty.
- [ ] **`localStorage` for prefs, IndexedDB for flashes** — the right store for each.
- [ ] **Safe-area insets** in the layout for installed iOS PWAs.
- [ ] **No `version` in `manifest.json`** — it is silently inert.
- [ ] **No CDN, no external resource of any kind** — first-load offline must work.

## 10. Things explicitly out of scope

Do **not** build any of these in v0.1. If you are tempted, re-read §11.

- Sync across devices, accounts, cloud backup.
- Import/export of the flash library to a file. (Reasonable v1.1 feature, not now.)
- A separate test harness. The calculator math is unchanged and already correct.
- Sharing results to social / a camera roll / a notes app.
- A dark/light theme toggle. The dark theme is the design.
- Unit conversion beyond the existing m/ft toggle.
- Multi-language support.
- Analytics, telemetry, error reporting.
- A build step, a bundler, a transpiler, a framework.

## 11. Do not overbuild this

FlashCalc is a calculator with one list. The whole point of this brief is a small, solid,
installable app that a film photographer can trust to open in a darkroom with no signal and
show them an f-number. If the build grows past a single `index.html` and a handful of
supporting files, or past a few hundred added lines, the experiment has failed on its own
terms even if the app is good.

When in doubt, choose the smaller implementation. A 40-line vanilla IndexedDB wrapper in
the inline `<script>` is correct; pulling in Dexie is not. A single `flashes` store is
correct; a separate `prefs` store is not. An inline edit form is correct; a routing layer
is not.

The reference apps are useful for the **resilience patterns** (service worker, cache
busting, offline shell), not for their scope. Aimless is a GPS walking app with a card
engine and an I Ching module; pomo-day is a full day planner. FlashCalc is none of those
things. Borrow the discipline, not the size.

---

## 12. Definition of done

- [ ] `index.html` (renamed from `flashcalc2.html`) opens directly in a browser and the
      calculator works identically to today.
- [ ] The three default flashes appear on first run, persist across reloads, and survive
      closing the tab and reopening.
- [ ] A user can add, edit, and delete a custom flash unit, and it persists.
- [ ] "Restore defaults" re-adds any missing built-in unit without touching user data.
- [ ] The app installs as a PWA on iOS and Android (prompt appears / Add to Home Screen
      works) and launches standalone with the amber icon.
- [ ] With the network off, the installed app launches and the calculator works, including
      flashes the user added while online.
- [ ] `npm run stamp` updates the cache name; `npm run stamp:check` passes.
- [ ] DevTools → Application → Cache Storage shows exactly one `flashcalc-*` cache.
- [ ] No runtime dependencies. `package.json` has an empty `dependencies` block (or none).
- [ ] `README.md` updated to describe the PWA install and the add-flash feature.
- [ ] All changes committed with `sw.js` stamped in the same commit as the change.
