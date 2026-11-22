// De SuggestionEngine van de app (Sources/ColairKit/SuggestionEngine.swift), regel voor regel. Met dezelfde
// SeededGenerator (SplitMix64) en dezelfde omzetting naar 0..<1 als Swift's Double.random(in:using:), zodat dezelfde
// seed dezelfde kleuren geeft als in de app. Getest tegen de Swift-code: tests/parity.test.ts.
import { angleOfHue, hexFromHSL, hsl, hueAtAngle, hueDistance, normalizedHex, wrap, type ColorWheel } from './color';
import { offsets, type Harmony } from './harmony';

export interface Slot { hex: string; isLocked: boolean }
export interface Settings { harmony: Harmony; wheel: ColorWheel; spread: number; variation: number }
export const defaultSettings = (harmony: Harmony = 'analogous'): Settings => ({ harmony, wheel: 'painter', spread: 30, variation: 40 });

export interface Random { next(): bigint }
const MASK = (1n << 64n) - 1n;

/** SplitMix64, zoals SeededGenerator in de app. */
export class SeededGenerator implements Random {
  private state: bigint;
  constructor(seed: bigint | number) { this.state = BigInt(seed) & MASK; }
  next(): bigint {
    this.state = (this.state + 0x9E3779B97F4A7C15n) & MASK;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK;
    return z ^ (z >> 31n);
  }
}

/** Een generator met een willekeurige seed uit de browser. */
export function randomGenerator(): SeededGenerator {
  const a = new Uint32Array(2); crypto.getRandomValues(a);
  return new SeededGenerator((BigInt(a[0]) << 32n) | BigInt(a[1]));
}

/** Swift: Double.random(in: 0..<1, using:) neemt de laagste 53 bits van next() en schaalt met 2^-53. */
export const unit = (rng: Random) => Number(rng.next() & ((1n << 53n) - 1n)) * 2 ** -53;

interface Info { hue: number; saturation: number; lightness: number; weight: number }

const range = (from: number, to: number, by: number) => { const r: number[] = []; for (let v = from; v < to; v += by) r.push(v); return r; };
const minOf = (a: number[]) => (a.length ? Math.min(...a) : undefined);

export interface Result { hexes: string[]; rotation: number }

/** Vult de vrije plekken met kleuren die bij de harmonie passen; vastgezette kleuren blijven. */
export function suggest(slots: Slot[], settings: Settings, rng: Random): Result {
  const rand = () => unit(rng);
  const offs = offsets(settings.harmony, settings.spread);
  const v = settings.variation / 100;
  const info: Info[] = slots.map((slot) => {
    const c = hsl(slot.hex);
    return { hue: angleOfHue(settings.wheel, c.hue), saturation: c.saturation, lightness: c.lightness, weight: c.saturation * (1 - Math.abs(2 * c.lightness - 1)) };
  });
  const locked = slots.map((_, i) => i).filter((i) => slots[i].isLocked);
  // Grijzen hebben geen tint, dus trekken ze niet aan de harmonie.
  const chromatic = locked.filter((i) => info[i].weight > 0.06);
  const weightSum = chromatic.reduce((t, i) => t + info[i].weight, 0);
  const cost = (rotation: number) => chromatic.reduce((total, i) => {
    const nearest = minOf(offs.map((o) => hueDistance(info[i].hue, rotation + o))) ?? 180;
    return total + info[i].weight * nearest * nearest;
  }, 0);

  let rotation: number;
  if (chromatic.length === 0) rotation = rand() * 360;
  else {
    const candidates: number[] = [];
    for (const i of chromatic) for (const o of offs) candidates.push(wrap(info[i].hue - o));
    candidates.push(...range(0, 360, 2));
    const costs = candidates.map(cost);
    const best = minOf(costs) ?? 0;
    const good = candidates.filter((_, k) => costs[k] <= best + 16 * weightSum);
    rotation = good[Math.trunc(rand() * good.length) % good.length];
  }

  const hues = offs.map((o) => wrap(rotation + o));
  const count = hues.map(() => 0);
  for (const i of chromatic) {
    const distances = hues.map((h) => hueDistance(info[i].hue, h));
    const nearest = distances.indexOf(minOf(distances) ?? 0);
    count[nearest === -1 ? 0 : nearest] += 1;
  }
  let baseSaturation = 0.45 + rand() * 0.35;
  if (chromatic.length) {
    let total = 0;
    for (const i of chromatic) total += info[i].saturation * info[i].weight;
    baseSaturation = total / weightSum;
  }
  const lightnesses = locked.map((i) => info[i].lightness);
  const jitter = (settings.harmony === 'monochrome' ? 1 : 2) + 12 * v;

  const hexes = slots.map((slot) => {
    if (slot.isLocked) return slot.hex;
    const least = minOf(count) ?? 0;
    const ties = count.map((_, k) => k).filter((k) => count[k] === least);
    const k = ties[Math.trunc(rand() * ties.length) % ties.length];
    count[k] += 1;
    const hue = hueAtAngle(settings.wheel, hues[k] + (rand() - 0.5) * 2 * jitter);
    // Licht zo ver mogelijk van de waarden die er al zijn.
    let bestL = 0.5, bestScore = -1;
    for (let n = 0; n < 14; n++) {
      const candidate = 0.16 + rand() * 0.72;
      const distance = lightnesses.length ? Math.min(...lightnesses.map((l) => Math.abs(l - candidate))) : rand();
      const score = distance + rand() * 0.05 * (1 + 2 * v);
      if (score > bestScore) { bestScore = score; bestL = candidate; }
    }
    lightnesses.push(bestL);
    const s = Math.min(0.95, Math.max(0.1, baseSaturation + (rand() - 0.5) * (0.15 + 0.55 * v)));
    return hexFromHSL({ hue, saturation: s, lightness: bestL });
  });
  return { hexes, rotation };
}

/** Waar de plekken van de harmonie liggen voor deze kleuren (de lijnen op het wiel, S-018). */
export function fittedRotation(hexes: string[], settings: Settings): number {
  return suggest(hexes.map((hex) => ({ hex, isLocked: true })), settings, new SeededGenerator(0)).rotation;
}

export interface StartPalette { hexes: string[]; startIndex: number }

/** Vanuit kleur (S-068): `count` kleuren rond één startkleur, van donker naar licht. Dezelfde seed geeft hetzelfde palet. */
export function startingFrom(start: string, count: number, settings: Settings, seed: bigint | number): StartPalette {
  const hex = normalizedHex(start) ?? '#888888';
  const size = Math.min(Math.max(count, 2), 8);
  const rng = new SeededGenerator(seed);
  const slots: Slot[] = [{ hex, isLocked: true }, ...Array.from({ length: size - 1 }, () => ({ hex: '#888888', isLocked: false }))];
  const made = suggest(slots, settings, rng).hexes;
  const ordered = made.map((_, i) => i).sort((x, y) => {
    const a = hsl(made[x]).lightness, b = hsl(made[y]).lightness;
    return a === b ? x - y : a - b;
  });
  return { hexes: ordered.map((i) => made[i]), startIndex: Math.max(0, ordered.indexOf(0)) };
}

/** Het eerste palet: vijf vrije kleuren in de harmonie. */
export function firstPalette(settings: Settings, rng: Random): string[] {
  return suggest(Array.from({ length: 5 }, () => ({ hex: '#888888', isLocked: false })), settings, rng).hexes;
}

/** Kleur toevoegen (S-007): één vrije kleur achteraan die bij de rest past; de andere veranderen niet. */
export function addColor(hexes: string[], settings: Settings, rng: Random): string {
  const fixed: Slot[] = hexes.map((hex) => ({ hex, isLocked: true }));
  return suggest([...fixed, { hex: '#888888', isLocked: false }], settings, rng).hexes.at(-1)!;
}
