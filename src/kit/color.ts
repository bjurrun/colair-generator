// ColorMath, HSL, HSV, ColorWheel en OKLab: een-op-een uit ColairKit (Sources/ColairKit/ColorMath.swift, OKLab.swift).
// Dezelfde formules en dezelfde afronding als Swift, zodat de site dezelfde kleuren geeft als de app.
// Getest tegen uitkomsten van de Swift-code zelf: tests/parity.test.ts.

export interface HSL { hue: number; saturation: number; lightness: number }
export interface HSV { hue: number; saturation: number; value: number }

/** Swift's `rounded()`: de helft weg van nul (JS Math.round rondt de helft naar boven). */
export const round = (v: number) => (v < 0 ? -Math.round(-v) : Math.round(v));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Een hoek in 0..<360. */
export function wrap(angle: number): number {
  const r = angle % 360;
  return r < 0 ? r + 360 : r;
}

/** De kortste afstand tussen twee hoeken, 0...180. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(wrap(a) - wrap(b));
  return d > 180 ? 360 - d : d;
}

/** "#c8553d", "C8553D" of "#c53" wordt "#C8553D". Null als het geen kleur is. */
export function normalizedHex(text: string): string | null {
  let body = text.trim();
  if (body.startsWith('#')) body = body.slice(1);
  if (!(body.length === 3 || body.length === 6) || !/^[0-9a-fA-F]+$/.test(body)) return null;
  if (body.length === 3) body = [...body].map((c) => c + c).join('');
  return '#' + body.toUpperCase();
}

/** Rood, groen en blauw van 0 tot 255. */
export function rgb(hex: string): [number, number, number] {
  const v = parseInt((normalizedHex(hex) ?? '#000000').slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

export function hexFromRGB(r: number, g: number, b: number): string {
  const part = (v: number) => Math.trunc(clamp(round(v), 0, 255)).toString(16).toUpperCase().padStart(2, '0');
  return '#' + part(r) + part(g) + part(b);
}

export function hsl(hex: string): HSL {
  const [r8, g8, b8] = rgb(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const maxV = Math.max(r, g, b), minV = Math.min(r, g, b);
  const l = (maxV + minV) / 2;
  if (maxV === minV) return { hue: 0, saturation: 0, lightness: l };
  const d = maxV - minV;
  const s = l > 0.5 ? d / (2 - maxV - minV) : d / (maxV + minV);
  let h: number;
  if (maxV === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (maxV === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { hue: h * 60, saturation: s, lightness: l };
}

export function hexFromHSL(color: HSL): string {
  const h = wrap(color.hue), s = color.saturation, l = color.lightness;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return hexFromRGB(f(0), f(8), f(4));
}

export function hsv(hex: string): HSV {
  const [r8, g8, b8] = rgb(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const maxV = Math.max(r, g, b), d = maxV - Math.min(r, g, b);
  if (!(d > 0)) return { hue: 0, saturation: 0, value: maxV };
  let h: number;
  if (maxV === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (maxV === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { hue: h * 60, saturation: d / maxV, value: maxV };
}

export function hexFromHSV(color: HSV): string {
  const h = wrap(color.hue), s = clamp(color.saturation, 0, 1), v = clamp(color.value, 0, 1);
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return hexFromRGB(f(5), f(3), f(1));
}

/** De HSL-verzadiging, 0...1 (S-073). */
export const saturation = (hex: string) => hsl(hex).saturation;

/** `hex` met een andere HSL-verzadiging; tint en licht blijven: feller of grijzer (S-073). */
export function withSaturation(hex: string, s: number): string {
  const c = hsl(hex);
  return hexFromHSL({ ...c, saturation: clamp(s, 0, 1) });
}

/** Het HSL-licht, 0...1 (S-078). */
export const lightness = (hex: string) => hsl(hex).lightness;

/** `hex` met een ander HSL-licht; tint en verzadiging blijven: 0 is zwart, 0,5 de zuivere kleur, 1 wit (S-078). */
export function withLightness(hex: string, l: number): string {
  const c = hsl(hex);
  return hexFromHSL({ ...c, lightness: clamp(l, 0, 1) });
}

/** Waar donkere tekst beter leest dan witte. */
export function isLight(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.18;
}

// ---------- Het kleurenwiel van de harmonieën ----------

/** Het schilderswiel (rood, geel, blauw als primaire kleuren) of het digitale RGB-wiel. */
export type ColorWheel = 'painter' | 'digital';
const RYB: [number, number][] = [[0, 0], [60, 35], [120, 60], [180, 120], [240, 240], [300, 277], [360, 360]];

function mapWheel(value: number, from: 0 | 1, to: 0 | 1): number {
  const x = wrap(value);
  for (let i = 0; i < RYB.length - 1; i++) {
    const a = RYB[i], b = RYB[i + 1];
    if (x <= b[from]) {
      const t = (x - a[from]) / (b[from] - a[from]);
      return a[to] + t * (b[to] - a[to]);
    }
  }
  return x;
}

/** De plek op het wiel van een RGB-tint. */
export const angleOfHue = (wheel: ColorWheel, hue: number) => (wheel === 'digital' ? wrap(hue) : mapWheel(hue, 1, 0));
/** De RGB-tint op een plek van het wiel. */
export const hueAtAngle = (wheel: ColorWheel, angle: number) => (wheel === 'digital' ? wrap(angle) : mapWheel(angle, 0, 1));

// ---------- OKLab ----------

export class OKLab {
  constructor(public l: number, public a: number, public b: number) {}

  get chroma() { return Math.sqrt(this.a * this.a + this.b * this.b); }
  get hue() { return wrap(Math.atan2(this.b, this.a) * 180 / Math.PI); }

  static fromHex(hex: string) { const [r, g, b] = rgb(hex); return OKLab.fromRGB(r, g, b); }

  static fromRGB(r8: number, g8: number, b8: number) {
    const linear = (c: number) => { c = c / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const r = linear(r8), g = linear(g8), b = linear(b8);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return new OKLab(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
  }

  get linearRGB(): [number, number, number] {
    const l = Math.pow(this.l + 0.3963377774 * this.a + 0.2158037573 * this.b, 3);
    const m = Math.pow(this.l - 0.1055613458 * this.a - 0.0638541728 * this.b, 3);
    const s = Math.pow(this.l - 0.0894841775 * this.a - 1.2914855480 * this.b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }

  get isInGamut() { return this.linearRGB.every((v) => v >= -0.0001 && v <= 1.0001); }

  /** De dichtstbijzijnde sRGB-kleur; buiten sRGB verliest hij chroma tot hij past. */
  get hex(): string {
    const color = new OKLab(this.l, this.a, this.b);
    while (!color.isInGamut && color.chroma > 0.001) { color.a *= 0.95; color.b *= 0.95; }
    const [r, g, b] = color.linearRGB;
    const gamma = (c: number) => { c = clamp(c, 0, 1); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };
    return hexFromRGB(gamma(r), gamma(g), gamma(b));
  }
}
