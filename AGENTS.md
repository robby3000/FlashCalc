# FlashCalc — Agent Notes

A small, fast **film-flash exposure calculator**. Pick a flash unit, set ISO and
power, and FlashCalc shows the correct aperture for a range of subject distances
(metres or feet). Built as a single self-contained HTML file — zero runtime
dependencies, no tracking. Persistent offline-first PWA with user-managed flash units.

## Start here

1. `README.md` — what it is and supported features.
2. `index.html` — **the entire app** (markup + CSS + JS in one file).
3. `manifest.json` & `sw.js` — PWA manifest and service worker.
4. `scripts/stamp-sw.mjs` — cache-busting stamper. Run `npm run stamp` after changes to client assets.

## What it computes

Guide-number based exposure. Core math (see `calculate()`):

- Effective guide number: `GN_eff = GN_base × √(ISO/100) × √(power)`
- For a subject distance `d`, aperture `f = GN_eff / d` (metres; feet uses the
  GN expressed in feet).
- Renders a table of apertures across a distance range for the selected flash.

## Hard constraints

- **Single file app.** Everything for the app UI is inline in `index.html`.
- **Zero runtime dependencies.** Vanilla IndexedDB API (no Dexie, no npm packages).
- **Offline-first.** Network-first (3s timeout) shell with cache-first assets.
- **Cache-busting discipline.** Any modification to `index.html`, `manifest.json`, or `icons/*` must be followed by `npm run stamp`, and `sw.js` must be committed in the same commit.
- **Private project, all rights reserved.**
