// De acht harmonieën en welke het best bij kleuren past: uit ColairKit (Harmony.swift, HarmonyMatch.swift).
// De namen en omschrijvingen zijn tekst en staan in de content (Keystatic), per taal.
import { angleOfHue, hsl, hueDistance, type ColorWheel } from './color';

export const HARMONIES = ['analogous', 'complementary', 'splitComplementary', 'triad', 'tetrad', 'square', 'monochrome', 'analogousAccent'] as const;
export type Harmony = (typeof HARMONIES)[number];

/** Het icoon in de sprite (src/components/Iconen.astro). */
export const harmonyIcon: Record<Harmony, string> = {
  analogous: 'harmony-analogous', complementary: 'harmony-complementary', splitComplementary: 'harmony-split', triad: 'harmony-triad',
  tetrad: 'harmony-tetrad', square: 'harmony-square', monochrome: 'harmony-monochrome', analogousAccent: 'harmony-analogous-accent',
};

/** De plekken op het wiel, ten opzichte van de basiskleur, in graden. */
export function offsets(h: Harmony, spread: number): number[] {
  switch (h) {
    case 'analogous': return [0, -spread, spread, -2 * spread, 2 * spread];
    case 'complementary': return [0, 180];
    case 'splitComplementary': return [0, 150, 210];
    case 'triad': return [0, 120, 240];
    case 'tetrad': return [0, 60, 180, 240];
    case 'square': return [0, 90, 180, 270];
    case 'monochrome': return [0];
    case 'analogousAccent': return [0, -spread, spread, 180];
  }
}

const range = (from: number, to: number, by: number) => { const r: number[] = []; for (let v = from; v < to; v += by) r.push(v); return r; };

/** De harmonie die het best past bij kleuren die niet uit een harmonie komen (S-062), zoals een schilderij. */
export function closestHarmony(hexes: string[], wheel: ColorWheel = 'painter', spread = 30): Harmony {
  const colors = hexes.flatMap((hex) => {
    const c = hsl(hex);
    const weight = c.saturation * (1 - Math.abs(2 * c.lightness - 1));
    return weight > 0.06 ? [{ hue: angleOfHue(wheel, c.hue), weight }] : [];
  });
  if (colors.length <= 1) return 'monochrome';
  const weightSum = colors.reduce((t, c) => t + c.weight, 0);
  const cost = (h: Harmony) => {
    const offs = offsets(h, spread);
    const candidates = range(0, 360, 2);
    for (const c of colors) for (const o of offs) candidates.push(c.hue - o);
    let best = Infinity;
    for (const rotation of candidates) {
      const positions = offs.map((o) => rotation + o);
      const fit = colors.reduce((t, c) => { const d = Math.min(...positions.map((p) => hueDistance(c.hue, p))); return t + c.weight * d * d; }, 0) / weightSum;
      const filled = positions.reduce((t, p) => { const d = Math.min(...colors.map((c) => hueDistance(c.hue, p))); return t + d * d; }, 0) / positions.length;
      best = Math.min(best, fit + 0.5 * filled);
    }
    return best;
  };
  const order: Harmony[] = ['monochrome', 'complementary', 'analogous', 'triad', 'splitComplementary', 'analogousAccent', 'square', 'tetrad'];
  const costs = order.map(cost);
  let k = 0;
  for (let i = 1; i < costs.length; i++) if (costs[i] < costs[k]) k = i;
  return order[k];
}
