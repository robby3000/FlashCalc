# FlashCalc

A small, fast **film flash exposure calculator**. Pick a flash unit, set ISO and power, and FlashCalc shows the correct aperture for a range of subject distances (in metres or feet).

Built as a persistent offline-first single-file Progressive Web App (PWA) — zero runtime dependencies, no build step, no tracking.

## Features

- **Accurate Guide-Number Math:** Fixed-GN and zoom-capable flashes with ISO and power-fraction adjustments:
  $$\text{GN}_{\text{iso}} = \text{GN}_{\text{base}} \times \sqrt{\frac{\text{ISO}}{100}}$$
  $$\text{GN}_{\text{effective}} = \text{GN}_{\text{iso}} \times \sqrt{\text{power}}$$
  $$\text{distance} = \frac{\text{GN}_{\text{effective}}}{\text{aperture}}$$
- **User-Managed Flash Units:** Add, edit, and delete your own flash units directly in the UI. Persisted locally in your browser via vanilla IndexedDB.
- **Offline-First PWA:** Installable on iOS and Android with complete offline functionality.
- **Safe-Area Layout:** Designed for standalone mobile screens with notch and home-indicator clearance.
- **Darkroom Instrument UI:** High-contrast dark theme with safelight amber accents.

## Installing as a PWA

Open `index.html` via a local server (`npm run serve`) or hosted site over HTTPS:

- **iOS Safari:** Share → *Add to Home Screen*
- **Android Chrome:** Menu (⋮) → *Install app* or *Add to Home screen*
- **Desktop Chrome / Edge:** Click the install icon in the address bar

## Project Structure

```
index.html         # the entire app (inline markup, CSS, JS)
manifest.json      # PWA web app manifest
sw.js              # Service Worker (cache-busting shell precache)
icons/             # App icons & favicons (192, 512, 512-maskable, 32, apple-touch)
scripts/
  stamp-sw.mjs     # Service worker cache stamper
  generate-icons.mjs # Dependency-free PNG generator
package.json       # npm scripts: serve, stamp, stamp:check
docs/PWA-BRIEF.md  # Authoritative build brief
```

## Cache Discipline

After modifying any client-shipped asset (`index.html`, `manifest.json`, `icons/*`):

```bash
npm run stamp
npm run stamp:check
```

Commit `sw.js` in the same commit as the changed files to ensure clients never serve stale caches.

## Development

To serve locally:

```bash
npm run serve
```

Then visit `http://localhost:8080`.

## License

Private project, all rights reserved.
