# Using it in your own project

Two ways in: the **engine** alone, for your own interface, a server or a script; or the **whole generator** on your own page.

## Install

```bash
npm install github:bjurrun/colair-generator
```

The package ships TypeScript source. Vite, Astro, Next.js (with `transpilePackages: ['colair-generator']`), Bun and Deno compile it as they go. Without a bundler, or to own the code: copy `src/kit/` into your project. It has no dependencies and needs ES2020 (`BigInt`).

```ts
import { suggest, defaultSettings, SeededGenerator } from 'colair-generator/engine'; // everything
import { colorName } from 'colair-generator/engine/colorNames';                    // one module
```

Every example below is also a test (`tests/examples.test.ts`).

## The engine

### Generate, with locked colours

```ts
import { suggest, defaultSettings, randomGenerator, type Slot } from 'colair-generator/engine';

const rng = randomGenerator();            // or new SeededGenerator(42n) for the same palette every time
const settings = defaultSettings('triad');

let slots: Slot[] = [
  { hex: '#C8553D', isLocked: true },     // keep this one
  { hex: '#888888', isLocked: false },    // free places: their hex does not matter
  { hex: '#888888', isLocked: false },
  { hex: '#888888', isLocked: false },
];
const { hexes } = suggest(slots, settings, rng);
```

Keep the same `rng` for the whole session: each call moves it on, so Generate gives a new palette every time.

To generate again, pass the current colours with their locks:

```ts
slots = hexes.map((hex, i) => ({ hex, isLocked: slots[i].isLocked }));
const next = suggest(slots, settings, rng).hexes;
```

Changing the harmony is the same call with other settings. `settings` also takes `wheel: 'digital'` for the RGB wheel, `spread` (degrees between close neighbours, default 30) and `variation` (0–100, default 40: how far colours may stray from their place).

### Start a palette

```ts
import { firstPalette, addColor, startingFrom, defaultSettings, SeededGenerator } from 'colair-generator/engine';

firstPalette(defaultSettings('analogous'), rng);                // five colours
addColor(['#2A3F8C', '#E9C24A'], defaultSettings('complementary'), rng); // one more that fits

const p = startingFrom('#c8553d', 5, defaultSettings('analogous'), 1); // around one colour, seed 1
p.hexes;      // dark to light
p.startIndex; // where '#C8553D' is
```

### Describe and adjust

```ts
import { colorName, closestHarmony, shiftedPalette, isLight } from 'colair-generator/engine';

colorName('#C8553D');                                  // a name from Colair's list
closestHarmony(['#2A3F8C', '#E9C24A', '#E07A2E']);     // e.g. 'complementary'
shiftedPalette(hexes, [true, false, false, false], 1); // one step warmer; -1 is cooler; locked colours stay
isLight('#F3DE97');                                    // true: put dark text on it
```

### From a picture (browser)

```ts
import { extract, Sampler } from 'colair-generator/engine';

const bitmap = await createImageBitmap(file);   // a File from <input type="file"> or a drop
const samples = extract(bitmap, 5);             // 3 to 8: [{ hex, x, y, share }, …], warm to cool
const sampler = new Sampler(bitmap);
sampler.hexAt(0.5, 0.5);                        // the colour in the middle, for a marker you drag
```

`extract` needs `OffscreenCanvas` (every current browser). On a server, decode the picture yourself and call `cluster(pixelsOf(rgba, width, height), count)`.

### Notations, links, files

```ts
import { code, hexFrom, normalizedHex, toSearch, fromSearch, makeFile, encode, decode, fileData, EXTENSION } from 'colair-generator/engine';

normalizedHex('c53');                // '#CC5533', or null if it is not a colour
code('hsl', '#C8553D');              // '10°, 56%, 51%'
hexFrom('rgb', ['200', '85', '61']); // '#C8553D'

const link = location.origin + toSearch({ hexes, locked: [true, false, false, false], harmony: 'triad', name: 'Harbour' });
fromSearch(new URL(link).search);    // the palette back, or null

const file = makeFile('Harbour', 'triad', hexes.map((hex) => ({ hex, locked: false })));
const bytes = fileData('procreate', file); // or 'adobe' (.ase) or 'colair' (.json, opens in the app)
const blob = new Blob([bytes]);            // save as `Harbour.${EXTENSION.procreate}`
decode(encode(file));                      // the Colair file back, or null if it is not one
```

## The whole generator

### In an Astro site

```astro
---
import Icons from 'colair-generator/Icons.astro';
import Generator from 'colair-generator/Generator.astro';
import text from 'colair-generator/text/en.json';
---
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head>
<body class="maak-page">
  <Icons />
  <Generator text={text}>
    <footer slot="voet">Your footer</footer>
  </Generator>
  <script>import 'colair-generator/generator';</script>
</body>
</html>
```

`Generator.astro` brings its own styles and the tokens. `src/components/Page.astro` in this repo is a complete example with a header and a language switch.

Props and slots:

| | |
|---|---|
| `text` | The texts, from `src/text/<lang>.json` or your own translation |
| `eerste` | The tab that is open in Start from: `'foto'` (default) or the id of a tab you add |
| `voorbeelden` | Sample photos to try From image with: `[{ src, naam, breed, hoog }]` (path in `public/`, name, width, height) |
| slot `tab`, `paneel` | An extra tab in Start from, before Picture, and its panel (`<div class="pane" role="tabpanel">`) |
| slot `werk` | Something under the panels of Start from |
| slot `na` | Under the editor, inside `<main>` |
| slot `voet` | After `<main>`: your footer |
| slot `exporteer` | At the bottom of the Export sheet |

The generator runs once per page and expects the markup of `Generator.astro`. To put a palette on it from your own code (as the site does with Inspiration), import its handles:

```ts
import { commit, current, toast } from 'colair-generator/generator';

commit({ ...current(), hexes: ['#2A3F8C', '#E9C24A', '#E07A2E'], locked: [false, false, false], name: 'Harbour' }); // one step for Undo
```

### Without Astro

The generator is static HTML plus one script. Build the demo (`npm run build`) and take `dist/` as a starting point: `dist/index.html` has the full markup, `dist/_astro/` the script and the CSS. Change the page around it as you like, but keep the ids and `data-` attributes the script uses (see [GENERATOR.md](GENERATOR.md), *The markup contract*).

### Make it yours

- **Logo**: the PNG cards carry `/assets/colair-logo.svg`. Put your own SVG at that path in `public/`.
- **Colours, type, sizes**: all in the tokens at the top of `src/styles/colair.css`, for light and dark.
- **Words**: your own `text` JSON.
- **Name**: please give your project its own; see [NOTICE.md](../NOTICE.md).
