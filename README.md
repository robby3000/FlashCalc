# FlashCalc

A small, fast **film flash exposure calculator**. Pick a flash unit, set ISO and power, and FlashCalc shows the correct aperture for a range of subject distances (in metres or feet).

Built as a single self-contained HTML file — no build step, no dependencies, no tracking. Works offline and is intended to be installed as a Progressive Web App (PWA) on phones and desktops.

## Features

- Guide-number based exposure math for fixed-GN and zoom-capable flashes
- ISO and power-fraction adjustments (`GN_eff = GN_base × √(ISO/100) × √(power)`)
- Metres / feet toggle
- Dark "darkroom" UI with safelight amber accents
- Runs entirely client-side; installable as a PWA

## Supported flash units

| Model | Type | Guide Number (m @ ISO 100) |
| --- | --- | --- |
| Olympus A11 | fixed | 10 |
| Godox Lux Junior | fixed | 12 |
| YN-560 III | zoom | 15–58 (18–105 mm) |

Adding a new flash is a one-line edit in the `flashes` object inside `flashcalc2.html`.

## Usage

Open `flashcalc2.html` in any modern browser. To install as an app:

- **iOS Safari:** Share → *Add to Home Screen*
- **Android Chrome:** menu → *Install app*
- **Desktop Chrome/Edge:** click the install icon in the address bar

## Project structure

```
flashcalc2.html   # the entire app (markup, CSS, JS in one file)
```

## License

Private project, all rights reserved.
