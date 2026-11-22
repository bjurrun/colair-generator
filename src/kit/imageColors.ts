// Uit afbeelding (S-038, S-111): de kleuren van een foto in OKLab, uit ColairKit/ImageColors.swift.
// De foto blijft in de browser: hij wordt nergens heen gestuurd.
import { hexFromRGB, OKLab, round } from './color';

export interface Sample { hex: string; x: number; y: number; share: number }
export interface Pixel { lab: OKLab; x: number; y: number }
export const COUNT_RANGE: [number, number] = [3, 8];

/** Het kleine kopietje (128 op de langste kant) als OKLab-pixels; bijna doorzichtige pixels tellen niet. */
export function pixelsOf(data: Uint8ClampedArray, width: number, height: number): Pixel[] {
  const out: Pixel[] = [];
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    const o = (row * width + col) * 4;
    if (data[o + 3] <= 128) continue;
    // Canvas-data is niet voorvermenigvuldigd: de waarden zijn al de kleur zelf.
    out.push({ lab: OKLab.fromRGB(data[o], data[o + 1], data[o + 2]), x: (col + 0.5) / width, y: (row + 0.5) / height });
  }
  return out;
}

/** Hoeveel meer een kleur telt naarmate hij levendiger is: grijs 1×, helder ±3×, fel tot 12×. */
const vividness = (c: OKLab) => { const k = c.chroma / 0.06; return Math.min(12, 1 + k * k); };

function distance(a: OKLab, b: OKLab) {
  const dark = 0.35 + 0.65 * Math.max(a.l, b.l);
  const dl = (a.l - b.l) * 0.7 * dark, da = (a.a - b.a) * 1.4, db = (a.b - b.b) * 1.4;
  return dl * dl + da * da + db * db;
}

/** Hoeveel kleine vlakken het beeld eerst wordt, voor het palet daaruit wordt gekozen. */
const PATCH_COUNT = 24;

function nearest(color: OKLab, centers: OKLab[]) {
  let best = 0, bestD = Infinity;
  centers.forEach((c, k) => { const d = distance(color, c); if (d < bestD) { bestD = d; best = k; } });
  return best;
}

/** Gewogen k-means in OKLab met een gespreide start: elk volgend centrum is de kleur die het verst weg ligt, maal zijn startgewicht. */
function kmeans(colors: OKLab[], weights: number[], seeds: number[], count: number): OKLab[] {
  if (!colors.length) return [];
  const argmax = (score: (i: number) => number) => { let best = 0; for (let i = 1; i < colors.length; i++) if (score(i) > score(best)) best = i; return best; };
  const centers = [colors[argmax((i) => seeds[i])]];
  const gap = colors.map((c) => distance(c, centers[0]));
  while (centers.length < count) {
    const next = argmax((i) => gap[i] * seeds[i]);
    if (!(gap[next] > 0)) break;
    centers.push(colors[next]);
    for (let i = 0; i < colors.length; i++) gap[i] = Math.min(gap[i], distance(colors[i], colors[next]));
  }
  const assignment = colors.map(() => 0);
  for (let it = 0; it < 30; it++) {
    let changed = false;
    for (let i = 0; i < colors.length; i++) {
      const best = nearest(colors[i], centers);
      if (assignment[i] !== best) { assignment[i] = best; changed = true; }
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < colors.length; i++) {
      const c = assignment[i], w = weights[i];
      sums[c][0] += colors[i].l * w; sums[c][1] += colors[i].a * w; sums[c][2] += colors[i].b * w; sums[c][3] += w;
    }
    centers.forEach((_, c) => { if (sums[c][3] > 0) centers[c] = new OKLab(sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]); });
    if (!changed) break;
  }
  return centers;
}

/**
 * Het palet in twee stappen (S-111): eerst 24 kleine vlakken van gelijke kleur, elk een kleur die echt in het beeld staat;
 * dan de kleuren die groot, fel en anders dan de al gekozen zijn. Daarna wordt niets meer gemiddeld.
 * Altijd hetzelfde resultaat voor dezelfde foto.
 */
export function cluster(pixels: Pixel[], count: number): Sample[] {
  if (!pixels.length) return [];
  const step = 0.03;
  const bins = new Map<string, { l: number; a: number; b: number; weight: number }>();
  for (const p of pixels) {
    const key = `${round(p.lab.l / step) || 0},${round(p.lab.a / step) || 0},${round(p.lab.b / step) || 0}`;
    let bin = bins.get(key);
    if (!bin) { bin = { l: 0, a: 0, b: 0, weight: 0 }; bins.set(key, bin); }
    bin.l += p.lab.l; bin.a += p.lab.a; bin.b += p.lab.b; bin.weight += 1;
  }
  const groups = [...bins.values()].sort((x, y) => (x.weight !== y.weight ? y.weight - x.weight : x.l - y.l));
  const colors = groups.map((g) => new OKLab(g.l / g.weight, g.a / g.weight, g.b / g.weight));
  const area = groups.map((g) => g.weight);

  // 1. De vlakken: k-means op oppervlak; de start geeft felle kleuren voorrang.
  const patches = kmeans(colors, area, groups.map((g, i) => g.weight * vividness(colors[i])), Math.min(PATCH_COUNT, colors.length));
  const share = patches.map(() => 0);
  colors.forEach((c, i) => { share[nearest(c, patches)] += area[i]; });
  const total = pixels.length;

  // 2. De keuze. Een vlak onder 0,4 % van het beeld is een rand of een spikkel.
  const worth = patches.map((p, i) => { const part = share[i] / total; return part < 0.004 ? 0 : Math.sqrt(part * vividness(p)); });
  const argmax = (score: (i: number) => number) => { let best = 0; for (let i = 1; i < patches.length; i++) if (score(i) > score(best)) best = i; return best; };
  const chosen = [argmax((i) => worth[i])];
  const gap = patches.map((p) => distance(p, patches[chosen[0]]));
  while (chosen.length < count) {
    const next = argmax((i) => worth[i] * gap[i]);
    if (!(worth[next] > 0 && gap[next] > 0)) break;
    chosen.push(next);
    for (let i = 0; i < patches.length; i++) gap[i] = Math.min(gap[i], distance(patches[i], patches[next]));
  }
  const centers = chosen.map((i) => patches[i]);

  // De marker staat waar de kleur echt is: van de best passende pixels, die het dichtst bij het midden.
  const members: { d: number; i: number }[][] = centers.map(() => []);
  pixels.forEach((p, i) => { const best = nearest(p.lab, centers); members[best].push({ d: distance(p.lab, centers[best]), i }); });
  const samples: Sample[] = [];
  centers.forEach((center, c) => {
    const all = members[c];
    if (!all.length) return;
    const mx = all.reduce((t, m) => t + pixels[m.i].x, 0) / all.length;
    const my = all.reduce((t, m) => t + pixels[m.i].y, 0) / all.length;
    const close = [...all].sort((a, b) => a.d - b.d).slice(0, Math.max(8, Math.trunc(all.length / 6)));
    let spot = close[0];
    const far = (m: { i: number }) => (pixels[m.i].x - mx) ** 2 + (pixels[m.i].y - my) ** 2;
    for (const m of close) if (far(m) < far(spot)) spot = m;
    samples.push({ hex: center.hex, x: pixels[spot.i].x, y: pixels[spot.i].y, share: all.length / total });
  });
  return wheelOrder(samples);
}

/**
 * De kleuren rond het kleurenwiel, van warm naar koel (S-111): van alle volgordes die met de kleinste stappen,
 * waarbij kleurtoon zwaar telt en licht weinig, in het kwadraat; daarna de warme kant (naar oranjegeel, 60°) eerst.
 */
export function wheelOrder(samples: Sample[]): Sample[] {
  const labs = samples.map((s) => OKLab.fromHex(s.hex));
  const n = labs.length;
  if (n <= 1) return samples;
  const step = labs.map((p) => labs.map((q) => {
    const dl = (p.l - q.l) * 0.4, da = (p.a - q.a) * 1.5, db = (p.b - q.b) * 1.5;
    return dl * dl + da * da + db * db;
  }));
  const order = labs.map((_, i) => i);
  let best = [...order], bestCost = Infinity;
  const permute = (k: number, cost: number) => {
    if (cost >= bestCost) return;
    if (k === n) { bestCost = cost; best = [...order]; return; }
    for (let i = k; i < n; i++) {
      [order[k], order[i]] = [order[i], order[k]];
      permute(k + 1, k === 0 ? 0 : cost + step[order[k - 1]][order[k]]);
      [order[k], order[i]] = [order[i], order[k]];
    }
  };
  permute(0, 0);
  const warmth = (c: OKLab) => c.chroma * Math.cos((c.hue - 60) * Math.PI / 180);
  const lean = best.reduce((t, idx, i) => t + warmth(labs[idx]) * (n - 1 - 2 * i), 0);
  if (lean < 0) best.reverse();
  return best.map((i) => samples[i]);
}

/** `count` kleuren van een afbeelding, rond het kleurenwiel van warm naar koel (S-111). */
export function extract(image: CanvasImageSource & { width: number; height: number }, count: number): Sample[] {
  const side = 128, scale = side / Math.max(image.width, image.height);
  const w = Math.max(1, Math.round(image.width * scale)), h = Math.max(1, Math.round(image.height * scale));
  const canvas = new OffscreenCanvas(w, h), ctx = canvas.getContext('2d', { colorSpace: 'srgb' })!;
  ctx.imageSmoothingQuality = 'low';
  ctx.drawImage(image, 0, 0, w, h);
  return cluster(pixelsOf(ctx.getImageData(0, 0, w, h).data, w, h), Math.min(Math.max(count, COUNT_RANGE[0]), COUNT_RANGE[1]));
}

/** Leest de kleur op een plek, voor een marker die je versleept: een kopie van 512 pixels, een vlakje van 5 × 5. */
export class Sampler {
  private w: number; private h: number; private data: Uint8ClampedArray;
  constructor(image: CanvasImageSource & { width: number; height: number }) {
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    this.w = Math.max(1, Math.round(image.width * scale)); this.h = Math.max(1, Math.round(image.height * scale));
    const ctx = new OffscreenCanvas(this.w, this.h).getContext('2d', { colorSpace: 'srgb' })!;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(image, 0, 0, this.w, this.h);
    this.data = ctx.getImageData(0, 0, this.w, this.h).data;
  }
  hexAt(x: number, y: number): string {
    const cx = Math.round(Math.min(Math.max(x, 0), 1) * (this.w - 1)), cy = Math.round(Math.min(Math.max(y, 0), 1) * (this.h - 1));
    let r = 0, g = 0, b = 0, n = 0;
    for (let py = Math.max(0, cy - 2); py <= Math.min(this.h - 1, cy + 2); py++) for (let px = Math.max(0, cx - 2); px <= Math.min(this.w - 1, cx + 2); px++) {
      const i = (py * this.w + px) * 4;
      if (this.data[i + 3] / 255 <= 0.5) continue;
      r += this.data[i]; g += this.data[i + 1]; b += this.data[i + 2]; n++;
    }
    return n ? hexFromRGB(r / n, g / n, b / n) : '#000000';
  }
}
