// Hoe het kleurvenster een kleur toont en laat typen: Hex, RGB, HSL, CMYK (ColairKit/ColorNotation.swift, S-014).
import { hexFromHSL, hexFromRGB, hsl, normalizedHex, rgb, round } from './color';

export const NOTATIONS = ['hex', 'rgb', 'hsl', 'cmyk'] as const;
export type Notation = (typeof NOTATIONS)[number];
export const notationName: Record<Notation, string> = { hex: 'Hex', rgb: 'RGB', hsl: 'HSL', cmyk: 'CMYK' };

/** "#C8553D", "200, 85, 61", "10°, 56%, 51%" of "0, 58, 70, 22". */
export function code(n: Notation, hex: string): string {
  const h = normalizedHex(hex) ?? '#000000';
  switch (n) {
    case 'hex': return h;
    case 'rgb': { const [r, g, b] = rgb(h); return `${r}, ${g}, ${b}`; }
    case 'hsl': { const c = hsl(h); return `${round(c.hue) % 360}°, ${round(c.saturation * 100)}%, ${round(c.lightness * 100)}%`; }
    case 'cmyk': {
      const [r8, g8, b8] = rgb(h); const r = r8 / 255, g = g8 / 255, b = b8 / 255;
      const k = 1 - Math.max(r, g, b);
      if (!(k < 1)) return '0, 0, 0, 100';
      const c = (1 - r - k) / (1 - k), m = (1 - g - k) / (1 - k), y = (1 - b - k) / (1 - k);
      return [c, m, y, k].map((v) => String(round(v * 100))).join(', ');
    }
  }
}

/** De velden: één voor Hex, drie voor RGB en HSL, vier voor CMYK; `key` is de tekst in de content. */
export const fields: Record<Notation, { key: string; max: number }[]> = {
  hex: [{ key: 'hex', max: 0 }],
  rgb: [{ key: 'rood', max: 255 }, { key: 'groen', max: 255 }, { key: 'blauw', max: 255 }],
  hsl: [{ key: 'tint', max: 359 }, { key: 'verzadiging', max: 100 }, { key: 'licht', max: 100 }],
  cmyk: [{ key: 'cyaan', max: 100 }, { key: 'magenta', max: 100 }, { key: 'geel', max: 100 }, { key: 'zwart', max: 100 }],
};

/** De waarde per veld, zoals de velden ze tonen. */
export function values(n: Notation, hex: string): string[] {
  if (n === 'hex') return [code(n, hex)];
  return code(n, hex).split(',').map((s) => s.replace(/\D/g, ''));
}

export function accepts(n: Notation, text: string, index: number): boolean {
  if (n === 'hex') return normalizedHex(text) !== null;
  const f = fields[n][index];
  if (!f || !/^\s*-?\d+\s*$/.test(text)) return false;
  const v = parseInt(text, 10);
  return v >= 0 && v <= f.max;
}

/** De kleur die de velden beschrijven, of null zolang er één niet klopt. */
export function hexFrom(n: Notation, vals: string[]): string | null {
  if (vals.length !== fields[n].length || !vals.every((v, i) => accepts(n, v, i))) return null;
  if (n === 'hex') return normalizedHex(vals[0]);
  const x = vals.map((v) => parseInt(v, 10));
  switch (n) {
    case 'rgb': return hexFromRGB(x[0], x[1], x[2]);
    case 'hsl': return hexFromHSL({ hue: x[0], saturation: x[1] / 100, lightness: x[2] / 100 });
    case 'cmyk': { const k = x[3] / 100; return hexFromRGB(255 * (1 - x[0] / 100) * (1 - k), 255 * (1 - x[1] / 100) * (1 - k), 255 * (1 - x[2] / 100) * (1 - k)); }
  }
}
