// De rekenregels van de site (src/kit/) tegen de echte ColairKit-code van de app (tests/fixtures/parity.json,
// gemaakt door tools/parity/make.sh). Elke uitkomst moet precies gelijk zijn: dezelfde seed, dezelfde kleuren.
import { describe, expect, it } from 'vitest';
import fx from './fixtures/parity.json';
import { angleOfHue, hexFromHSL, hexFromHSV, hsl, hsv, hueAtAngle, isLight, lightness, OKLab, saturation, withLightness, withSaturation } from '../src/kit/color';
import { closestHarmony, type Harmony } from '../src/kit/harmony';
import { fittedRotation, SeededGenerator, startingFrom, suggest, unit, type Slot } from '../src/kit/engine';
import { code, hexFrom, NOTATIONS } from '../src/kit/notation';
import { cluster, pixelsOf, wheelOrder } from '../src/kit/imageColors';
import { encode, decode, makeFile } from '../src/kit/paletteFile';
import { ALL, colorName } from '../src/kit/colorNames';
import { shifted, shiftedPalette } from '../src/kit/colorTemperature';
import { ase, crc32, fileData, g17, procreate, procreateJSON, EXTENSION, FORMATS } from '../src/kit/swatchFiles';

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('willekeur', () => {
  it('SplitMix64 geeft dezelfde getallen', () => {
    const g = new SeededGenerator(7);
    expect(fx.raw.map(() => String(g.next()))).toEqual(fx.raw);
  });
  it('Double.random(in: 0..<1) is gelijk', () => {
    const g = new SeededGenerator(42);
    fx.unit.forEach((u: number) => expect(unit(g)).toBe(u));
  });
});

describe('kleur', () => {
  for (const c of fx.color as any[]) it(c.hex, () => {
    const s = hsl(c.hex), v = hsv(c.hex), lab = OKLab.fromHex(c.hex);
    [s.hue, s.saturation, s.lightness].forEach((x, i) => close(x, c.hsl[i]));
    [v.hue, v.saturation, v.value].forEach((x, i) => close(x, c.hsv[i]));
    expect(hexFromHSL(s)).toBe(c.fromHSL);
    expect(hexFromHSV(v)).toBe(c.fromHSV);
    [lab.l, lab.a, lab.b].forEach((x, i) => close(x, c.lab[i], 1e-12));
    expect(lab.hex).toBe(c.labHex);
    expect(withSaturation(c.hex, saturation(c.hex) + 0.05)).toBe(c.more);
    expect(withSaturation(c.hex, saturation(c.hex) - 0.1)).toBe(c.less);
    expect(withLightness(c.hex, lightness(c.hex) + 0.05)).toBe(c.lighter);
    expect(withLightness(c.hex, lightness(c.hex) - 0.1)).toBe(c.darker);
    expect(isLight(c.hex)).toBe(c.isLight);
    close(angleOfHue('painter', s.hue), c.painter);
    close(hueAtAngle('painter', angleOfHue('painter', s.hue)), c.back);
    expect(NOTATIONS.map((n) => code(n, c.hex))).toEqual(c.codes);
  });
  it('OKLab buiten sRGB', () => {
    expect([[0.7, 0.3, 0.2], [0.5, -0.3, 0.1], [0.9, 0.1, 0.25], [0.3, 0.05, -0.3]].map(([l, a, b]) => new OKLab(l, a, b).hex)).toEqual(fx.labOut);
  });
  it('getypte kleuren', () => {
    expect([hexFrom('rgb', ['200', '85', '61']), hexFrom('hsl', ['10', '56', '51']), hexFrom('cmyk', ['0', '58', '70', '22']), hexFrom('hex', ['c53']), hexFrom('rgb', ['300', '0', '0'])]
      .map((h) => h ?? 'nil')).toEqual(fx.typed);
  });
});

describe('genereer', () => {
  const setups = fx.setups as Slot[][];
  it(`${fx.suggest.length} paletten zijn gelijk aan de app`, () => {
    for (const s of fx.suggest as any[]) {
      const r = suggest(setups[s.setup], { harmony: s.harmony, wheel: s.wheel, spread: s.spread, variation: s.variation }, new SeededGenerator(BigInt(s.seed)));
      expect(r.hexes, JSON.stringify(s)).toEqual(s.hexes);
      close(r.rotation, s.rotation);
    }
  });
  it('vanuit kleur', () => {
    for (const s of fx.start as any[]) {
      const p = startingFrom(s.start, s.count, { harmony: s.harmony, wheel: 'painter', spread: 30, variation: 40 }, BigInt(s.seed));
      expect(p.hexes).toEqual(s.hexes);
      expect(p.startIndex).toBe(s.startIndex);
    }
  });
  it('de lijnen op het wiel', () => {
    for (const f of fx.fitted as any[]) close(fittedRotation(['#2A3F8C', '#6E8FC9', '#E9C24A'], { harmony: f.harmony, wheel: 'painter', spread: 30, variation: 40 }), f.rotation);
  });
  it('welke harmonie bij een schilderij past', () => {
    for (const c of fx.closest as any[]) expect(closestHarmony(c.hexes)).toBe(c.harmony as Harmony);
  });
});

describe('uit afbeelding', () => {
  it('dezelfde kleuren en plekken', () => {
    const { width, height, rgb, samples } = fx.image as any;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) { data[i * 4] = rgb[i * 3]; data[i * 4 + 1] = rgb[i * 3 + 1]; data[i * 4 + 2] = rgb[i * 3 + 2]; data[i * 4 + 3] = 255; }
    const px = pixelsOf(data, width, height);
    [3, 5, 8].forEach((n, k) => {
      const got = cluster(px, n);
      expect(got.map((s) => s.hex)).toEqual(samples[k].map((s: any) => s.hex));
      got.forEach((s, i) => { close(s.share, samples[k][i].share); close(s.x, samples[k][i].x); close(s.y, samples[k][i].y); });
    });
  });
  it('dezelfde volgorde rond het wiel (S-111)', () => {
    for (const w of fx.wheel as { in: string[]; out: string[] }[]) {
      expect(wheelOrder(w.in.map((hex) => ({ hex, x: 0, y: 0, share: 0 }))).map((s) => s.hex)).toEqual(w.out);
    }
  });
});

describe('bestand', () => {
  it('schrijft precies zoals de app', () => {
    expect(encode(makeFile('Zomeravond', 'analogous', [{ hex: '#2A3F8C', locked: false }, { hex: '#E9C24A', locked: true, name: 'Goud' }]))).toBe(fx.file);
  });
  it('leest een bestand van de app, en weigert wat de app weigert', () => {
    expect(decode(fx.file)?.colors[1]).toEqual({ hex: '#E9C24A', locked: true, name: 'Goud' });
    expect(decode('{"app":"Colair","version":1,"name":"x","harmony":"triad","colors":[{"hex":"#123","locked":false}]}')).toBeNull();
    expect(decode('{"app":"Ander","version":1,"name":"x","harmony":"triad","colors":[]}')).toBeNull();
  });
});

describe('kleurnamen (S-113)', () => {
  it('heeft dezelfde lijst als de app, naam voor naam', () => {
    expect(ALL.length).toBe(fx.colorNameCount);
    expect(ALL.map(([n, h]) => [n, h])).toEqual(fx.colorNameList);
  });
  it('geeft elke kleur dezelfde naam als de app', () => {
    for (const c of fx.colorNames as any[]) expect(colorName(c.hex), c.hex).toBe(c.name);
  });
});

describe('warmer en koeler (S-112)', () => {
  it('zet elke kleur even ver als de app, beide kanten op', () => {
    for (const c of fx.temperature as any[]) for (const st of c.steps) expect(shifted(c.hex, st.by), `${c.hex} ${st.by}`).toBe(st.hex);
  });
  it('laat vastgezette kleuren staan, zoals de app', () => {
    for (const p of fx.temperaturePalette as any[]) expect(shiftedPalette(['#C8553D', '#2A3F8C', '#808080', '#E9C24A', '#FFFFFF'], [false, true, false, false], p.by)).toEqual(p.hexes);
  });
});

describe('bestanden voor apps (S-076)', () => {
  const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64');
  for (const f of fx.swatchFiles as any[]) {
    const file = makeFile(f.name, f.harmony, f.colors);
    it(`${f.name}: .ase byte voor byte gelijk`, () => expect(b64(ase(file))).toBe(f.ase));
    it(`${f.name}: Swatches.json gelijk`, () => expect(procreateJSON(file)).toBe(f.procreateJSON));
    it(`${f.name}: .swatches (zip) byte voor byte gelijk`, () => expect(b64(procreate(file))).toBe(f.procreate));
  }
  it('Colair: het .json-bestand van S-034', () => {
    const file = makeFile('Zomeravond', 'analogous', [{ hex: '#2A3F8C', locked: false }, { hex: '#E9C24A', locked: true, name: 'Goud' }]);
    expect(new TextDecoder().decode(fileData('colair', file))).toBe(fx.file);
  });
  it('de formaten in de volgorde van de sheet', () => {
    expect(FORMATS).toEqual(['procreate', 'adobe', 'colair']);
    expect(FORMATS.map((f) => EXTENSION[f])).toEqual(['swatches', 'ase', 'json']);
  });
  it('CRC-32 en %.17g', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
    expect([1, 0.5, 0.695, 0.1, 1e-5].map(g17)).toEqual(['1', '0.5', '0.69499999999999995', '0.10000000000000001', '1.0000000000000001e-05']);
  });
});
