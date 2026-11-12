# Published Browser Interaction QA (V80)
This repository contains a GitHub Actions **Chromium Playwright** suite that opens the published GitHub Pages portfolio, performs input/click interactions, checks character autosave and XML roundtrip, validates upgrade hardpoint caps, downloads a vehicle dossier and checks mobile layout.

## Run
Open **Actions** → **Live browser smoke tests — Infinity portfolio** → **Run workflow**.
The workflow also runs when app.js, data.js, index.html, or the smoke tests change on `main`.
Failed tests attach Playwright traces and screenshots (artifact: `portfolio-browser-diagnostics`).

## Scope
The test uses a fresh browser context for each case; the test character names contain `QA` and are not written to your own browser. The suite never touches game records outside the test's isolated runner. This is a **real browser** on the deployed URL, not a JS syntax-only check.

## Current expected baseline
Build V80; 37 vehicles, 50 Chapter 11 upgrades; five Weapon slots and ten Equipment slots; all vehicles reference-only for personal loadout. Checks intentionally reject unverified TAG hardpoints.
