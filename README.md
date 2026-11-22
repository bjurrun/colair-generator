# Colair generator

The colour palette engine of [Colair](https://colair.app), the palette app for painters on iPhone and Mac, together with the web generator that runs it in a browser. Try it at [colair.app/generator](https://colair.app/generator/).

- **The engine** (`src/kit/`): plain TypeScript, no dependencies, no DOM except for reading pictures. It makes palettes in eight harmonies around colours you lock, gives every colour a name, makes a palette warmer or cooler, finds the colours that shape a photo, builds a palette around one colour, and reads and writes hex, RGB, HSL and CMYK, share links, and swatch files for Procreate and Adobe.
- **The web generator** (`src/generator/`): the editor of the app in the browser, for desktop and phone. Generate with the space bar, lock with 1 to 8, swipe a colour for lightness and saturation, pick on a colour wheel, start from a picture or a colour, and export a PNG card, a swatch file, the hex codes or a link.

The engine is a line-by-line translation of ColairKit, the Swift package inside the app. The same seed gives the same colours as the app; `tests/parity.test.ts` checks 480 palettes, colours, notations, picture palettes and files against outcomes of the Swift code.

## A palette in five lines

```ts
import { SeededGenerator, defaultSettings, suggest } from 'colair-generator/engine';

const { hexes } = suggest(
  [{ hex: '#C8553D', isLocked: true }, { hex: '#888888', isLocked: false }, { hex: '#888888', isLocked: false }],
  defaultSettings('triad'),
  new SeededGenerator(42n),
);
// ['#C8553D', …two colours that complete the triad]
```

Locked colours stay put; every free place gets a colour that fits the harmony. Give no seed (`randomGenerator()`) for a new palette every time.

## Run the generator

```bash
npm install
npm run dev      # http://localhost:4321 (English), /nl/ and /es/
npm test         # engine parity with the app, the doc examples, the helpers
npm run build    # a static site in dist/
```

## Use it in your own project

```bash
npm install github:bjurrun/colair-generator
```

Then `import { … } from 'colair-generator/engine'`. The package ships TypeScript source, which Vite, Astro, Next.js, Bun and Deno compile as they go. No build step? Copy `src/kit/` into your project: it has no dependencies.

[docs/USING.md](docs/USING.md) has recipes for each part of the engine and shows how to embed the whole generator in an Astro site, or drive it from your own markup.

## Documentation

| | |
|---|---|
| [docs/ENGINE.md](docs/ENGINE.md) | How the engine works: the painter's wheel, harmonies, the suggestion rule, locking, temperature, names, picture palettes |
| [docs/USING.md](docs/USING.md) | The engine in your own code, and the generator on your own page |
| [docs/GENERATOR.md](docs/GENERATOR.md) | The web generator: layout on desktop and phone, gestures, keys, texts, files |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Where changes come from, and how to propose one |

## What is where

| | |
|---|---|
| `src/kit/` | The engine. `index.ts` exports everything; one module per subject |
| `src/generator/` | The web generator: `Generator.astro` (markup), `generator.ts` (behaviour), `generator.css`, `Icons.astro` |
| `src/text/` | The texts of the generator in English, Dutch and Spanish |
| `src/styles/colair.css` | The design tokens of the app for the web: colours, sizes, radii, durations, light and dark |
| `src/components/Page.astro`, `src/pages/` | The demo page around the generator |
| `tests/` | Parity with the app (`fixtures/parity.json`), the examples from these docs, the helpers |

Comments in the source are in Dutch, the source language of the app; the docs are in English.

## Licence

MIT, see [LICENSE](LICENSE). The icons are Solar (CC BY 4.0), and the name and logo of Colair are not part of the licence: see [NOTICE.md](NOTICE.md).
