# Changelog

## 1.1.5 — 2026-10-29

- Chips created by Mushroom's chips card before this module had loaded never reacted to taps on
  WebKit (iOS Companion app, Safari): their first render ran before `setConfig`, so the gesture
  handlers were bound to nothing. Handlers are now bound after whichever render first produces
  the chip; the button card gets the same treatment.
- `debug: true` on a chip shows the build and the last gesture step on the chip itself, and
  writes each step to the logbook.

## 1.1.2 — 2026-10-29

- Taps on chips and the button did nothing on touch screens: pointerleave fires between
  pointerup and click there, and the gesture handler took it for a cancelled press.

## 1.1.1 — 2026-10-29

- Chips inside a Mushroom chips card were tiny and oversized at once: Mushroom sizes its chips in
  em of the chip height, and the chip inherited those variables against a 14 px font. The chip now
  uses Mushroom's exact sizing model (36 px, 0.5em icon, 0.3em text, 0.25em padding).
- `icon_only: true` for a round 36 px chip.

## 1.1.0 — 2026-10-29

- The `fully-tablet-chips` row card is gone. Chips live inside Mushroom's chips card instead:
  `type: fully-tablet` (+ `chip:`) or `type: fully-tablet-<kind>`. Mushroom builds chip
  elements as `mushroom-<type>-chip`, so the chip is registered under those names too.
- `custom:fully-tablet-chip` still works as a card of its own.
- Examples for plain Mushroom chips that open the sheet by hash route or launch an app.

## 1.0.2 — 2026-10-28

- Dashboards running inside Fully Kiosk slowed right down: every chip read the whole Fully
  JavaScript interface (13 synchronous Android bridge calls) on every Home Assistant state
  update. Bridge reads are now cached for 2 s and the chips only need three of them.
- Chips, the chips row and the button skip re-rendering when nothing they show has changed,
  instead of re-rendering on every state change anywhere in the house.
- The sheet's icons are pre-warmed while the dashboard is idle, so the first open no longer
  waits on icon downloads.
- Test harness: an inside-Fully load test counts bridge calls and renders.

## 1.0.1 — 2026-10-28

- History stayed blank when the sheet was opened straight into it (history chip, hash route,
  hold on the button): the loader now runs after every render while History is showing.
- Repository and file renamed to `fully-kiosk-sheet`; element names are unchanged.

## 1.0.0 — 2026-10-28

First release as a HACS plugin. Grown out of the `fully-tablet-sheet v5` resource
that ran inline on the Barnabas Landing station tablets.

- Tablets are configured (`tablets:`) or discovered from the Fully Kiosk integration;
  no more hard-coded list.
- One tablet works: no tab row, no Overview.
- History page per tablet: screen on/off timeline, charger bands, app-in-front strip,
  battery curve with hover, stats, activity log from the Home Assistant logbook.
- Actions taken in the sheet are written to the logbook (`log_actions: false` turns it off).
- Chips: status, screen, battery, history, app (launch an Android app on the tablet,
  from the tablet or from a phone), charger, open. Usable standalone (`fully-tablet-chips`)
  or inside `mushroom-chips-card`.
- Hash routes: `#tablets`, `#tablet-<key>`, `#tablet-<key>-history`, `#tablets-history`.
- Tap / hold actions on the button and the chips (`navigate`, `url`, `more-info`,
  `perform-action`, `open-sheet`, `open-history`, `launch-app`).
- The Barnabas battery-conditioning drain window is now a plain `charger_off_note`.
