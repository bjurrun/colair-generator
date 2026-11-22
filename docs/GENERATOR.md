# The web generator

`src/generator/` is the palette editor of the Colair app, in the browser. It is the same generator as on [colair.app/generator](https://colair.app/generator/), without Inspiration (the paintings and their palettes, which stay with the app and the site).

| File | |
|---|---|
| `Generator.astro` | The markup: the editor, Start from, and the sheets Colour, Harmony, Export and From image |
| `generator.ts` | The behaviour. It runs once, when the page loads, on the markup above |
| `generator.css` | The layout for phone, desktop and wide desktop. Only tokens from `src/styles/colair.css` |
| `Icons.astro` | The icons as an SVG sprite; put it in the page once |
| `html.ts`, `reorder.ts` | Two small helpers: safe text in HTML, moving a colour up or down |

## Layout

The generator is built phone first and follows the app.

- **Phone** (up to 860 px): like Palette in the iOS app. The colours fill the screen above the fold, with a floating glass toolbar (Start from, Harmony, Export) at the top right, and Undo and Generate as round buttons at the bottom while the editor is in view. The number of colours and the temperature sit under the colours as − and + steppers. Start from follows below the palette.
- **Desktop** (861 px and up): like Palette in the Mac app. The harmony is one button in the header next to the title, Undo and Export on the right, and the number of colours, the temperature and Generate in a row below the colours.
- **Wide** (1100 px and up): Start from sits next to the editor, just as tall, in its own column.

The colours always share the height that is left, so the whole editor stays in view with two colours or eight. Light and dark follow the system (`prefers-color-scheme`).

## What you can do

| | Mouse and keyboard | Touch |
|---|---|---|
| New palette in the harmony | Generate, or the space bar | Generate |
| Lock or unlock a colour | The lock, or 1 to 8 | The lock |
| Lighter or darker | Drag sideways, or ← → on a focused colour | Swipe sideways |
| More or less saturated | Drag up or down, or ↑ ↓ on a focused colour | Swipe up or down |
| Move a colour up or down | The arrows on hover, or ⌥↑ ⌥↓ | |
| Pick a colour exactly | Click it: the wheel, with Hex, RGB, HSL and CMYK | Tap it |
| Undo | ⌘Z or Ctrl+Z, or Undo | Undo |
| Warmer or cooler | The temperature − and + | The same |
| More or fewer colours (2 to 8) | Number of colours − and + | The same |

A locked colour shakes when you try to change it. Every change is one step for Undo (up to 80).

**Start from** has two tabs:

- **Picture**: drop or choose a photo. The sheet From image shows it with a ring on every colour the engine found; drag a ring to take the colour under it, choose 3 to 8 colours, and Use palette puts them on the palette with the harmony that fits best. The photo stays in the browser.
- **Colour**: pick a start colour on the wheel, a harmony and a number; the example changes as you go, with its own Undo and Generate. Make palette puts it on the palette.

**Export** names the palette and offers a PNG (With name and codes, or Just the colours; 1080 × 1350 at 2×, as the app draws them), a file for Procreate, Adobe or Colair, the hex codes, or a link. On a phone the PNG and the files go to the share sheet.

The palette is always in the address bar (`?p=…&h=…`, see `link.ts`), so a refresh keeps it and the link is ready to share. Nothing is stored: no cookies, no local storage.

## Texts

All words come from `src/text/<lang>.json` (English, Dutch, Spanish), passed to the component as `text`. The page writes them into `<script id="maakTekst" type="application/json">`, where `generator.ts` reads the ones it needs at run time (toasts, labels). The keys are Dutch, like the source: `palet.genereer` is Generate. To add a language, copy `en.json`, translate the values, and add a page.

## Events

`generator.ts` dispatches `colair:meet` on `window` when someone generates or exports, with the name in `detail` (`'genereer'`, `'export/card'`, `'export/procreate'`, …). The site counts these without cookies; this repo has no listener, so nothing is sent anywhere. Listen to it if you want your own counts:

```ts
addEventListener('colair:meet', (e) => console.log((e as CustomEvent<string>).detail));
```

## The markup contract

`generator.ts` finds its elements by id and data attribute (`#bands`, `#dlgKleur`, `[data-act="generate"]`, `[data-begin]`, …). If you keep `Generator.astro` as it is, you do not need to know them. If you write your own markup, start from the rendered HTML of the demo page (`npm run build`, then `dist/index.html`) and keep every id and `data-` attribute.
