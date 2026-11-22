# How the engine works

The engine (`src/kit/`) is the colour logic of the Colair app, translated line by line from its Swift package ColairKit. It is deterministic: give it the same input and the same seed, and it gives the same colours as the app, to the last digit. That is what `tests/parity.test.ts` checks.

Colours go in and out as hex strings: `'#C8553D'`. Everything that accepts a colour also accepts `'c8553d'` or `'#c53'`; everything that returns one returns six upper-case digits with a `#`.

| Module | What it does |
|---|---|
| `color.ts` | Hex, RGB, HSL, HSV, OKLab; lightness and saturation; light or dark; the painter's wheel |
| `harmony.ts` | The eight harmonies and the harmony that fits a set of colours |
| `engine.ts` | The suggestion engine: free colours around locked ones; adding a colour; a palette from one colour; the seeded random generator |
| `colorTemperature.ts` | A colour or palette a step warmer or cooler |
| `colorNames.ts` | A name for every colour |
| `imageColors.ts` | The colours that shape a picture, and the colour under a point |
| `notation.ts` | Hex, RGB, HSL and CMYK as text, in and out |
| `link.ts` | A palette in a URL query string |
| `paletteFile.ts` | The `.json` palette file that the app opens |
| `swatchFiles.ts` | Swatch files for Procreate (`.swatches`) and Adobe (`.ase`) |

## The painter's wheel

Harmonies are measured on a wheel. The engine has two (`ColorWheel`):

- **`'painter'`** (the default): the red-yellow-blue wheel that painters mix on. Yellow sits opposite violet and blue opposite orange, not opposite each other as on a screen. It is the RGB hue wheel, stretched piecewise: RGB hue 0°, 35°, 60°, 120°, 240°, 277° lands on wheel angle 0°, 60°, 120°, 180°, 240°, 300° (`angleOfHue`, `hueAtAngle`).
- **`'digital'`**: the plain RGB hue wheel.

Every harmony is a set of places on the wheel, relative to a base angle (`offsets`), with `spread` (30° by default) for the close neighbours:

| Harmony | Places |
|---|---|
| `analogous` | 0, ±spread, ±2·spread |
| `complementary` | 0, 180 |
| `splitComplementary` | 0, 150, 210 |
| `triad` | 0, 120, 240 |
| `tetrad` | 0, 60, 180, 240 |
| `square` | 0, 90, 180, 270 |
| `monochrome` | 0 |
| `analogousAccent` | 0, ±spread, 180 |

## Suggesting colours

`suggest(slots, settings, rng)` takes a palette as places, some locked, and fills the free ones. `settings` is `{ harmony, wheel, spread, variation }`; `defaultSettings(harmony)` gives the app's values (painter's wheel, spread 30, variation 40).

1. **Weigh the locked colours.** Each locked colour gets a weight: its saturation times how far its lightness is from black or white (`s · (1 − |2l − 1|)`). Greys, near-whites and near-blacks weigh almost nothing; colours with a weight of 0.06 or less have no hue to speak of and do not pull on the harmony.
2. **Turn the harmony to fit them.** The engine tries rotations of the harmony (every 2°, plus every rotation that puts one place exactly on one locked colour) and scores each by the weighted squared distance from every locked colour to its nearest place. Of all rotations within a small margin of the best, it picks one at random. With nothing locked, any rotation will do.
3. **Spread the free colours over the places.** Each free colour goes to the place with the fewest colours so far (ties at random), so a triad of six gets two of each.
4. **Choose hue, lightness and saturation.**
   - *Hue*: the place on the wheel, plus a little jitter that grows with `variation` (narrower for `monochrome`).
   - *Lightness*: of 14 random candidates between 0.16 and 0.88, the one farthest from every lightness already in the palette. That is why a generated palette always runs from dark to light, and never has two colours of the same value.
   - *Saturation*: the weighted saturation of the locked colours (or a random 0.45–0.80 if none), plus some noise, kept between 0.10 and 0.95.

Locked colours come back unchanged. `suggest` also returns the `rotation` it chose; `fittedRotation(hexes, settings)` gives the rotation for a finished palette (the lines the app draws on its wheel).

Built on `suggest`:

- `firstPalette(settings, rng)`: five free colours.
- `addColor(hexes, settings, rng)`: one new colour that fits the others, which stay as they are.
- `startingFrom(start, count, settings, seed)`: a palette of 2 to 8 colours around one colour, sorted dark to light; `startIndex` says where the start colour ended up.
- `closestHarmony(hexes)`: the harmony that best describes colours that did not come from one, such as a painting or a photo. Every harmony is turned to its best fit; the score is how close the colours are to its places plus how well its places are filled, so a harmony with empty places loses.

### Randomness

The engine never calls `Math.random()`. It takes a `Random`, anything with `next(): bigint` that returns 64 random bits. `SeededGenerator(seed)` is SplitMix64, the same generator as the app, and `unit(rng)` turns its bits into a number in [0, 1) exactly as Swift's `Double.random(in:using:)` does. Same seed, same palette, on every platform. `randomGenerator()` gives a SeededGenerator with a seed from `crypto.getRandomValues`.

## Warmer and cooler

`shifted(hex, steps)` moves a colour towards orange (warmer, positive steps) or towards blue (cooler, negative), in OKLab. Each step:

- turns the hue at most 8° (`TURN`) the short way round towards the pole: 60° in OKLab for warm, 240° for cool;
- adds a tint of 0.01 (`TINT`) towards the pole, scaled by `4·L·(1 − L)`, so mid tones move most and black and white hardly at all.

Lightness stays the same. A colour that falls outside sRGB loses chroma until it fits. `shiftedPalette(hexes, locked, steps)` does the whole palette and leaves locked colours alone.

## Names

`colorName(hex)` gives every colour one of Colair's own names (`ALL`, 305 of them, in English in every language): the name whose colour is nearest in OKLab. On a tie the first in the list wins, so the same colour always gets the same name.

## Colours from a picture

`extract(image, count)` takes anything you can draw on a canvas (an `ImageBitmap`, an `<img>`, a `<canvas>`) and returns 3 to 8 `Sample`s: `{ hex, x, y, share }`, with `x` and `y` from 0 to 1 where the colour really is in the picture, and `share` the part of the picture it stands for. The picture never leaves the browser.

1. **Shrink** to 128 pixels on the longest side and convert to OKLab; nearly transparent pixels do not count (`pixelsOf`).
2. **Group into patches.** Colours are binned in steps of 0.03, then a weighted k-means makes 24 patches of one colour each. Vivid colours count more when the patches are seeded: grey 1×, bright about 3×, vivid up to 12×. Every patch is a colour that is really in the picture; nothing is averaged after this.
3. **Choose.** A patch smaller than 0.4 % of the picture is an edge or a speck and is skipped. The first colour is the patch with the best mix of size and vividness; each next one is the patch that scores best on that mix times its distance to the colours already chosen. So you get the sunset and the flowers, not five shades of grey-brown.
4. **Place the marker** on the pixel nearest the middle of the area of that colour, among the pixels that match it best.
5. **Order** round the wheel: the order with the smallest steps between neighbours (hue counts heavily, lightness a little), then warm side first (`wheelOrder`).

`cluster(pixels, count)` is steps 2 to 5, if you have pixels already (on a server, say). `Sampler` reads the colour under a point for a marker that is dragged: an average of 5 × 5 pixels on a 512-pixel copy.

## Text, links and files

- **Notations** (`notation.ts`): `code(n, hex)` writes `'#C8553D'`, `'200, 85, 61'`, `'10°, 56%, 51%'` or `'0, 58, 70, 22'`; `values` gives the separate fields; `hexFrom(n, values)` reads them back (or `null`); `accepts(n, text, index)` says whether a field takes that text.
- **Links** (`link.ts`): `toSearch(palette)` writes `?p=2A3F8C-6E8FC9&h=analogous&v=01&n=Name` (`v`: which colours are locked); `fromSearch(search)` reads it back, or `null` unless there are 2 to 8 valid colours. An unknown harmony becomes the closest one.
- **The Colair file** (`paletteFile.ts`): `makeFile`, `encode` and `decode`. `encode` writes JSON exactly like the app (sorted keys, two-space indent, `" : "`), so the app opens it; `decode` accepts only what the app would.
- **Swatch files** (`swatchFiles.ts`): `fileData(format, file)` gives the bytes for `'procreate'` (a zip with `Swatches.json`), `'adobe'` (Adobe Swatch Exchange, RGB) or `'colair'` (the file above); `EXTENSION[format]` gives the extension. Byte for byte what the app writes.

## Rounding

Swift rounds halves away from zero (`2.5 → 3`, `−2.5 → −3`); JavaScript's `Math.round` rounds them up (`−2.5 → −2`). The engine uses its own `round` everywhere, so colours on the edge round the same way as in the app.
