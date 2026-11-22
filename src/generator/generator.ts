// De generator: de editor van de app Colair in de browser, met Begin vanuit (Afbeelding, Kleur). Rekenregels uit
// src/kit/ (gelijk aan ColairKit, npm test); opmaak in Generator.astro; teksten uit <script id="maakTekst">.
// Niets wordt bewaard: bewaren is de app. Gaat 1-op-1 mee naar de repo colair-generator (tools/generator-export.mjs);
// wat alleen de site heeft (Inspiratie) haakt in via de export onderaan, zie src/scripts/maak.ts.
import { hexFromHSV, hsv as toHSV, isLight, lightness, normalizedHex, saturation, withLightness, withSaturation, wrap, type HSV } from '../kit/color';
import { closestHarmony, harmonyIcon, type Harmony } from '../kit/harmony';
import { addColor, defaultSettings, firstPalette, randomGenerator, startingFrom, suggest, type StartPalette } from '../kit/engine';
import { fields as notationFields, hexFrom, values as notationValues, type Notation } from '../kit/notation';
import { makeFile } from '../kit/paletteFile';
import { EXTENSION, fileData, type FileFormat } from '../kit/swatchFiles';
import { extract, Sampler, type Sample } from '../kit/imageColors';
import { fromSearch, toSearch } from '../kit/link';
import { colorName } from '../kit/colorNames';
import { shiftedPalette } from '../kit/colorTemperature';
import { esc } from './html';
import { arrows, moved } from './reorder';

// Meten (S-083): Genereer en elke export, met de taal (src/scripts/meten.ts).
const meet = (naam: string) => dispatchEvent(new CustomEvent('colair:meet', { detail: naam }));
const T = JSON.parse(document.getElementById('maakTekst')!.textContent!);
const $ = <E extends Element = HTMLElement>(s: string, root: ParentNode = document) => root.querySelector(s) as E;
const $$ = <E extends Element = HTMLElement>(s: string, root: ParentNode = document) => [...root.querySelectorAll(s)] as E[];
const wide = matchMedia('(min-width: 861px)');
/** Breed genoeg om Begin vanuit naast de editor te zetten (generator.css: .duo). */
const duo = matchMedia('(min-width: 1100px)');
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const fill = (s: string, n: number | string) => s.replace('{n}', String(n));
const ink = (hex: string) => (isLight(hex) ? '#141414' : '#FFFFFF'); // de afbeeldingen (PictureInk.onColor)
// Op de kleurstroken: Tone.onLightColor / onDarkColor en de waas achter het slot, zoals in de app.
const onColor = (hex: string) => (isLight(hex) ? 'rgba(20,20,20,.7)' : 'rgba(255,255,255,.75)');
const wash = (hex: string) => (isLight(hex) ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.18)');
const ico = (name: string, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

// ---------- Het palet ----------
type Source = 'harmony' | 'image';
interface State { hexes: string[]; locked: boolean[]; harmony: Harmony; source: Source; name: string }
const clone = (s: State): State => ({ ...s, hexes: [...s.hexes], locked: [...s.locked] });
const same = (a: State, b: State) => JSON.stringify(a) === JSON.stringify(b);
const rng = randomGenerator();
const settings = () => defaultSettings(state.harmony);
const undoStack: State[] = [];
let state: State = fromLink() ?? { hexes: firstPalette(defaultSettings('analogous'), rng), locked: [false, false, false, false, false], harmony: 'analogous', source: 'harmony', name: '' };

/** Eén stap voor Vorige (S-006): de toestand van vóór de wijziging. */
function commit(next: State, before = state) {
  if (same(next, before)) return;
  undoStack.push(clone(before));
  if (undoStack.length > 80) undoStack.shift();
  state = next;
  render();
}
function undo() {
  const prev = undoStack.pop();
  if (!prev) return;
  state = prev;
  render();
  toast(T.palet.teruggezet);
}
function generate() {
  commit({ ...clone(state), hexes: suggest(state.hexes.map((hex, i) => ({ hex, isLocked: state.locked[i] })), settings(), rng).hexes, source: 'harmony' });
}
function chooseHarmony(h: Harmony) {
  const next = { ...clone(state), harmony: h, source: 'harmony' as Source };
  next.hexes = suggest(next.hexes.map((hex, i) => ({ hex, isLocked: next.locked[i] })), defaultSettings(h), rng).hexes;
  commit(next);
}
/** Het hele palet een stap koeler (−1) of warmer (+1), met de regel van de app (S-112); één stap voor Vorige. */
function temperature(steps: number) {
  commit({ ...clone(state), hexes: shiftedPalette(state.hexes, state.locked, steps) });
}
function add() {
  if (state.hexes.length >= 8) return toast(T.palet.vol);
  const next = clone(state);
  next.hexes.push(addColor(state.hexes, settings(), rng)); next.locked.push(false);
  commit(next);
  $('#bands li:last-child')?.classList.add('new');
}
function remove(i: number) {
  if (state.hexes.length <= 2) return toast(T.palet.minimaal);
  const next = clone(state);
  next.hexes.splice(i, 1); next.locked.splice(i, 1);
  commit(next);
}

// ---------- Tekenen ----------
const bands = $('#bands');
/** Omhoog en omlaag bij hover (S-099, ontwerp optie A). */
function moveHTML(i: number) {
  const a = arrows(i, state.hexes.length);
  const one = (dir: 'up' | 'down', on: boolean) => on
    ? `<button class="move" data-move="${dir}" data-i="${i}" aria-label="${esc(dir === 'up' ? T.palet.omhoog : T.palet.omlaag)}" title="${esc(dir === 'up' ? T.palet.hoger : T.palet.lager)}">${ico(dir === 'up' ? 'chevron-up' : 'chevron-down')}</button>`
    : '<span class="move" aria-hidden="true"></span>';
  return `<span class="moves">${one('up', a.up)}${one('down', a.down)}<kbd class="toets" aria-hidden="true">${i + 1}</kbd></span>`;
}
/** Eén plek omhoog of omlaag: één stap voor Vorige, zoals Omhoog en Omlaag in de app. */
function move(i: number, to: number) {
  if (to < 0 || to >= state.hexes.length) return;
  commit({ ...clone(state), hexes: moved(state.hexes, i, to), locked: moved(state.locked, i, to) });
}
function bandHTML(hex: string, i: number) {
  const locked = state.locked[i];
  return `<li style="--c:${hex};--on:${onColor(hex)};--wash:${wash(hex)}"><button class="swatch" data-i="${i}" aria-label="${esc(fill(T.palet.kleur, i + 1))}, ${esc(colorName(hex))}, ${hex}"><span class="etiket"><b class="naam">${esc(colorName(hex))}</b><code>${hex}</code></span></button>`
    + moveHTML(i)
    + `<button class="lock" data-lock="${i}" aria-pressed="${locked}" aria-keyshortcuts="${i + 1}" aria-label="${esc(locked ? T.palet.maakLos : T.palet.zetVast)}" title="${esc(`${locked ? T.palet.maakLos : T.palet.zetVast} (${i + 1})`)}">${ico(locked ? 'lock' : 'lock-open')}</button></li>`;
}
function paintBand(i: number) {
  const li = bands.children[i] as HTMLElement, hex = state.hexes[i];
  li.style.setProperty('--c', hex); li.style.setProperty('--on', onColor(hex)); li.style.setProperty('--wash', wash(hex));
  li.querySelector('code')!.textContent = hex;
  // De naam volgt de kleur (S-113), ook tijdens vegen en op het wiel.
  const naam = colorName(hex);
  li.querySelector('.naam')!.textContent = naam;
  li.querySelector('.swatch')!.setAttribute('aria-label', `${fill(T.palet.kleur, i + 1)}, ${naam}, ${hex}`);
}
function render() {
  bands.innerHTML = state.hexes.map(bandHTML).join('');
  const n = state.hexes.length;
  $$<HTMLButtonElement>('[data-act="add"]').forEach((x) => (x.disabled = n >= 8));
  // De stroken delen de hoogte die er is, zodat de hele editor boven de vouw blijft (maak.css: --n).
  bands.style.setProperty('--n', String(n));
  // Twee tellers (telefoon onder de stroken, desktop naast de harmonie) tonen hetzelfde.
  $$('[data-amount]').forEach((o) => (o.textContent = String(n)));
  $$<HTMLButtonElement>('[data-act="more"]').forEach((b) => (b.disabled = n >= 8));
  // Alles vast: de temperatuur kan niets veranderen, zoals in de app (TemperatureStepper, isFullyLocked).
  $$<HTMLButtonElement>('[data-act="cooler"], [data-act="warmer"]').forEach((b) => (b.disabled = state.locked.every(Boolean)));
  $$<HTMLButtonElement>('[data-act="fewer"]').forEach((b) => (b.disabled = n <= 2));
  $$<HTMLButtonElement>('[data-act="undo"]').forEach((b) => (b.disabled = !undoStack.length));
  const h = T.harmonieen[state.harmony];
  $('#harmonyName').textContent = h.naam;
  $('.harmony-btn').title = h.naam; // breed kan de naam inkorten (maak.css); bij hover staat hij heel
  $$('#harmonyIcon use, #harmonyIconApp use').forEach((u) => u.setAttribute('href', `#i-${harmonyIcon[state.harmony]}`));
  $$('[data-harmony]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.harmony === state.harmony && state.source === 'harmony')));
  inAdres();
}
/** Het palet staat in de adresbalk: verversen houdt het vast en de link is te kopiëren. Vervangt, zodat Terug de
 *  pagina verlaat in plaats van door elk palet te lopen; Vorige is ⌘Z. GoatCounter telt alleen het pad (meten.ts). */
function inAdres() {
  try { history.replaceState(history.state, '', toSearch(state) + location.hash); } catch { /* Safari: te vaak achter elkaar */ }
}

// ---------- Vegen: opzij voor licht, omhoog en omlaag voor verzadiging (S-078), en tikken voor het wiel ----------
// Na 12 px ligt de richting vast. De kleur tilt op tot 300 px (of wat past), de andere krimpen tot stroken met hun
// hexcode, en in het midden staat de schaal: liggend zwart, zuiver, wit; rechtop grijs onder, vol boven. De knop toont
// de kleur van nu en blijft onder de vinger (ColorSwipe.follow): rechts is lichter, omhoog is voller.
const THRESHOLD = 12, LIFT = 300, STRIP = 28, KNOB = 40, SCALE_PAD = 20;
type Axis = 'light' | 'sat';
interface Swipe { i: number; x: number; y: number; id: number; hex: string; axis: Axis | null; ignore: boolean; start: number; travel: number; before: State; el: HTMLElement }
let swipe: Swipe | null = null;
bands.addEventListener('pointerdown', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('.swatch');
  if (!el || e.button !== 0) return;
  const i = Number(el.dataset.i);
  swipe = { i, x: e.clientX, y: e.clientY, id: e.pointerId, hex: state.hexes[i], axis: null, ignore: false, start: 0, travel: 1, before: clone(state), el };
});
/** Til kleur i op: hij krijgt de hoogte die de andere als stroken overlaten, hoogstens 300 px; nooit minder dan hij had. */
function lift(s: Swipe, axis: Axis) {
  const n = state.hexes.length, gap = parseFloat(getComputedStyle(bands).rowGap) || 8;
  const box = s.el.getBoundingClientRect(), total = bands.getBoundingClientRect().height;
  const h = Math.max(box.height, Math.min(LIFT, total - (n - 1) * (STRIP + gap)));
  const strip = Math.max(STRIP - 8, Math.min(STRIP, (total - h - (n - 1) * gap) / Math.max(1, n - 1)));
  bands.style.setProperty('--lift', `${h}px`);
  bands.style.setProperty('--strip', `${strip}px`);
  bands.classList.add('swiping');
  s.el.parentElement!.classList.add('lifted');
  const scale = document.createElement('span');
  scale.className = `scale ${axis}`;
  const stops = axis === 'light' ? [0, .5, 1].map((v) => withLightness(s.hex, v)) : [0, 1].map((v) => withSaturation(s.hex, v));
  scale.style.background = `linear-gradient(${axis === 'light' ? 'to right' : 'to top'}, ${stops.join(', ')})`;
  scale.innerHTML = '<i></i>';
  s.el.append(scale);
  s.travel = Math.max(1, (axis === 'light' ? box.width : h) - 2 * SCALE_PAD - KNOB - 8);
  s.start = axis === 'light' ? lightness(s.hex) : saturation(s.hex);
  s.el.style.setProperty('--v', String(s.start));
}
function drop(s: Swipe) {
  bands.classList.remove('swiping');
  s.el.parentElement?.classList.toggle('lifted', false);
  s.el.querySelector('.scale')?.replaceWith();
}
bands.addEventListener('pointermove', (e) => {
  const s = swipe;
  if (!s || e.pointerId !== s.id || s.ignore) return;
  const dx = e.clientX - s.x, dy = e.clientY - s.y;
  if (!s.axis) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESHOLD) return;
    if (state.locked[s.i]) { shake(s.i); s.ignore = true; return; }
    s.axis = Math.abs(dx) >= Math.abs(dy) ? 'light' : 'sat';
    lift(s, s.axis);
    try { s.el.setPointerCapture(e.pointerId); } catch { /* een pointer die al los is */ }
  }
  const v = Math.min(1, Math.max(0, s.start + (s.axis === 'light' ? dx : -dy) / s.travel));
  // Altijd vanaf de kleur van het begin, zodat tint en de andere waarde een uitstapje naar zwart, wit of grijs overleven.
  state.hexes[s.i] = s.axis === 'light' ? withLightness(s.hex, v) : withSaturation(s.hex, v);
  paintBand(s.i);
  s.el.style.setProperty('--v', String(v));
});
function endSwipe(e: PointerEvent) {
  if (!swipe || e.pointerId !== swipe.id) return;
  const s = swipe; swipe = null;
  if (s.axis) {
    drop(s);
    const after = clone(state); state = s.before; commit(after);
  } else if (!s.ignore && e.type === 'pointerup') openColor(s.i);
}
bands.addEventListener('pointerup', endSwipe);
bands.addEventListener('pointercancel', endSwipe);
bands.addEventListener('click', (e) => {
  const mv = (e.target as HTMLElement).closest<HTMLElement>('[data-move]');
  if (mv) {
    const i = Number(mv.dataset.i), to = i + (mv.dataset.move === 'up' ? -1 : 1);
    move(i, to);
    // De kleur houdt de muis en de focus: zijn pijltje staat er weer.
    (bands.children[to]?.querySelector(`[data-move="${mv.dataset.move}"]`) as HTMLElement | null ?? bands.children[to]?.querySelector('.swatch') as HTMLElement | null)?.focus();
    return;
  }
  const lock = (e.target as HTMLElement).closest<HTMLElement>('[data-lock]');
  if (lock) {
    const i = Number(lock.dataset.lock), next = clone(state);
    next.locked[i] = !next.locked[i];
    commit(next);
    (bands.children[i]?.querySelector('.lock') as HTMLElement)?.focus();
    return;
  }
  // Met het toetsenbord (Enter of spatie op een kleur): het wiel.
  const sw = (e.target as HTMLElement).closest<HTMLElement>('.swatch');
  if (sw && (e as MouseEvent).detail === 0) openColor(Number(sw.dataset.i));
});
// Pijltjes, in stappen van 5 % zoals het menu op de Mac: links en rechts donkerder en lichter, omhoog en omlaag voller en grijzer.
const STEP: Record<string, [Axis, number]> = { ArrowLeft: ['light', -.05], ArrowRight: ['light', .05], ArrowUp: ['sat', .05], ArrowDown: ['sat', -.05] };
bands.addEventListener('keydown', (e) => {
  const sw = (e.target as HTMLElement).closest<HTMLElement>('.swatch');
  // Option met omhoog of omlaag verplaatst de kleur één plek (S-099), zoals ⌥⌘↑ en ⌥⌘↓ op de Mac.
  if (sw && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    const i = Number(sw.dataset.i), to = i + (e.key === 'ArrowUp' ? -1 : 1);
    move(i, to);
    (bands.children[Math.max(0, Math.min(to, state.hexes.length - 1))]?.querySelector('.swatch') as HTMLElement)?.focus();
    return;
  }
  const step = STEP[e.key];
  if (!sw || !step) return;
  e.preventDefault();
  const i = Number(sw.dataset.i), hex = state.hexes[i];
  if (state.locked[i]) return shake(i);
  const next = clone(state);
  next.hexes[i] = step[0] === 'light' ? withLightness(hex, lightness(hex) + step[1]) : withSaturation(hex, saturation(hex) + step[1]);
  commit(next);
  (bands.children[i]?.querySelector('.swatch') as HTMLElement)?.focus();
});
function shake(i: number) {
  const l = bands.children[i]?.querySelector('.lock');
  if (!l) return;
  l.classList.remove('shake'); void (l as HTMLElement).offsetWidth; l.classList.add('shake');
  toast(T.palet.vastgezet);
}

// ---------- Het kleurenwiel: de tintring met de driehoek (ColorWheelPicker.swift) ----------
class Wheel {
  color: HSV = { hue: 0, saturation: 0, value: 0 };
  private ctx: CanvasRenderingContext2D;
  private S: number; private c: number; private ringIn: number; private ringOut: number; private r: number;
  private ring?: ImageData; private triHue = -1; private tri?: HTMLCanvasElement;
  private part: 'ring' | 'triangle' | null = null;
  constructor(private canvas: HTMLCanvasElement, private onChange: (hex: string) => void, private onEnd: () => void = () => {}) {
    this.ctx = canvas.getContext('2d')!;
    this.S = canvas.width; this.c = this.S / 2; this.ringOut = this.c - 2; this.ringIn = this.c * 0.8; this.r = this.ringIn - this.S * 0.025;
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); this.part = null; this.drag(e); });
    canvas.addEventListener('pointermove', (e) => { if (canvas.hasPointerCapture(e.pointerId)) this.drag(e); });
    canvas.addEventListener('pointerup', () => { this.part = null; this.onEnd(); });
  }
  /** Gray en zwart hebben geen eigen tint: de ring blijft dan staan. */
  set(hex: string) {
    const v = toHSV(hex);
    this.color = v.saturation > 0 && v.value > 0 ? v : { ...v, hue: this.color.hue };
    this.draw();
  }
  get hex() { return hexFromHSV(this.color); }
  private corners() { const r = this.r, h = (r * Math.sqrt(3)) / 2; return [[r, 0], [-r / 2, h], [-r / 2, -h]]; }
  private weights(px: number, py: number) {
    const [a, b, c] = this.corners();
    const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
    const wa = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / det;
    const wb = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / det;
    return [wa, wb, 1 - wa - wb];
  }
  private rotate(x: number, y: number, deg: number) { const t = (deg * Math.PI) / 180; return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)]; }
  private drag(e: PointerEvent) {
    const b = this.canvas.getBoundingClientRect(), k = this.S / b.width;
    const px = (e.clientX - b.left) * k - this.c, py = (e.clientY - b.top) * k - this.c;
    if (!this.part) this.part = Math.hypot(px, py) >= this.ringIn - 6 ? 'ring' : 'triangle';
    if (this.part === 'ring') this.color = { ...this.color, hue: wrap((Math.atan2(py, px) * 180) / Math.PI) };
    else {
      const [x, y] = this.rotate(px, py, -this.color.hue);
      const w = this.weights(x, y);
      const a = Math.max(0, w[0]), bw = Math.max(0, w[1]), c = Math.max(0, w[2]), sum = a + bw + c;
      const value = (a + bw) / sum;
      this.color = { hue: this.color.hue, saturation: value > 0 ? a / sum / value : this.color.saturation, value };
    }
    this.draw();
    this.onChange(this.hex);
  }
  private ringImage() {
    if (this.ring) return this.ring;
    const img = this.ctx.createImageData(this.S, this.S);
    for (let y = 0; y < this.S; y++) for (let x = 0; x < this.S; x++) {
      const dx = x + 0.5 - this.c, dy = y + 0.5 - this.c, d = Math.hypot(dx, dy);
      const alpha = Math.min(1, Math.max(0, Math.min(this.ringOut - d, d - this.ringIn) + 0.5));
      if (alpha <= 0) continue;
      const hex = hexFromHSV({ hue: wrap((Math.atan2(dy, dx) * 180) / Math.PI), saturation: 1, value: 1 });
      const i = (y * this.S + x) * 4;
      img.data[i] = parseInt(hex.slice(1, 3), 16); img.data[i + 1] = parseInt(hex.slice(3, 5), 16); img.data[i + 2] = parseInt(hex.slice(5, 7), 16); img.data[i + 3] = alpha * 255;
    }
    return (this.ring = img);
  }
  private triangle() {
    if (this.tri && this.triHue === this.color.hue) return this.tri;
    const side = Math.ceil(this.r * 2), cv = this.tri ?? document.createElement('canvas');
    cv.width = cv.height = side;
    const g = cv.getContext('2d')!, img = g.createImageData(side, side);
    const hue = hexFromHSV({ hue: this.color.hue, saturation: 1, value: 1 });
    const pr = parseInt(hue.slice(1, 3), 16), pg = parseInt(hue.slice(3, 5), 16), pb = parseInt(hue.slice(5, 7), 16);
    const edge = this.r * 1.5;
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const [rx, ry] = this.rotate(x + 0.5 - this.r, y + 0.5 - this.r, -this.color.hue);
      const w = this.weights(rx, ry);
      const alpha = Math.min(1, Math.max(0, Math.min(w[0], w[1], w[2]) * edge + 0.5));
      if (alpha <= 0) continue;
      const a = Math.max(0, w[0]), b = Math.max(0, w[1]), i = (y * side + x) * 4;
      img.data[i] = pr * a + 255 * b; img.data[i + 1] = pg * a + 255 * b; img.data[i + 2] = pb * a + 255 * b; img.data[i + 3] = alpha * 255;
    }
    g.putImageData(img, 0, 0);
    this.triHue = this.color.hue;
    return (this.tri = cv);
  }
  draw() {
    const g = this.ctx;
    g.clearRect(0, 0, this.S, this.S);
    g.putImageData(this.ringImage(), 0, 0);
    g.drawImage(this.triangle(), this.c - this.r, this.c - this.r);
    const handle = (x: number, y: number, r: number, fillHex: string) => {
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fillHex; g.fill();
      g.lineWidth = this.S * 0.012; g.strokeStyle = '#FFFFFF'; g.stroke();
      g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
    };
    const mid = (this.ringIn + this.ringOut) / 2, t = (this.color.hue * Math.PI) / 180;
    handle(this.c + mid * Math.cos(t), this.c + mid * Math.sin(t), (this.ringOut - this.ringIn) / 2 + 2, hexFromHSV({ ...this.color, saturation: 1, value: 1 }));
    const [a, b, c] = this.corners(), s = this.color.saturation, v = this.color.value;
    const wa = s * v, wb = (1 - s) * v, wc = 1 - v;
    const [px, py] = this.rotate(wa * a[0] + wb * b[0] + wc * c[0], wa * a[1] + wb * b[1] + wc * c[1], this.color.hue);
    handle(this.c + px, this.c + py, this.S * 0.03, this.hex);
  }
}

// ---------- Het kleurvenster ----------
const dlgKleur = $<HTMLDialogElement>('#dlgKleur');
let picking: { i: number; before: State; original: string; originalLocked: boolean } | null = null;
let notation: Notation = 'hex';
const wheel = new Wheel($<HTMLCanvasElement>('#wheel'), (hex) => pick(hex, true));
function pick(hex: string, fromWheel = false) {
  if (!picking) return;
  // Een kleur die je zelf kiest, staat vast (S-013).
  state.hexes[picking.i] = hex; state.locked[picking.i] = true;
  paintBand(picking.i);
  if (!fromWheel) wheel.set(hex);
  paintPicker(!fromWheel);
}
function paintPicker(keepFields = false) {
  if (!picking) return;
  const hex = state.hexes[picking.i];
  const was = $('#was'), nu = $('#nu');
  dlgKleur.style.setProperty('--was', picking.original); dlgKleur.style.setProperty('--was-on', ink(picking.original));
  dlgKleur.style.setProperty('--nu', hex); dlgKleur.style.setProperty('--nu-on', ink(hex));
  was.querySelector('code')!.textContent = picking.original; nu.querySelector('code')!.textContent = hex;
  $('#kleurNaam').textContent = colorName(hex);
  const lock = $('#kleurLock'), locked = state.locked[picking.i];
  lock.setAttribute('aria-pressed', String(locked));
  lock.setAttribute('aria-label', locked ? T.palet.maakLos : T.palet.zetVast);
  lock.innerHTML = ico(locked ? 'lock' : 'lock-open');
  if (!keepFields) paintFields();
}
function paintFields() {
  if (!picking) return;
  const hex = state.hexes[picking.i], vals = notationValues(notation, hex);
  $('#fields').innerHTML = notationFields[notation].map((f, k) =>
    `<label><span>${esc(T.kleur[f.key])}</span><input inputmode="${notation === 'hex' ? 'text' : 'numeric'}" value="${esc(vals[k])}" data-k="${k}" autocomplete="off" spellcheck="false"></label>`).join('');
  $$('[data-notation]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.notation === notation)));
}
$('#fields').addEventListener('input', () => {
  const inputs = $$<HTMLInputElement>('#fields input');
  const hex = hexFrom(notation, inputs.map((i) => i.value));
  inputs.forEach((i) => i.classList.toggle('bad', hex === null && !!i.value && !(notation === 'hex' ? normalizedHex(i.value) : true)));
  if (hex) pick(hex);
});
$('#fields').addEventListener('focusout', () => paintFields());
$('#notation').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-notation]');
  if (b) { notation = b.dataset.notation as Notation; paintFields(); }
});
$('#was').addEventListener('click', () => {
  if (!picking) return;
  state.hexes[picking.i] = picking.original; state.locked[picking.i] = picking.originalLocked;
  paintBand(picking.i); wheel.set(picking.original); paintPicker();
});
$('#kleurLock').addEventListener('click', () => {
  if (!picking) return;
  state.locked[picking.i] = !state.locked[picking.i];
  render(); paintPicker(true);
});
$('#kleurDelete').addEventListener('click', () => {
  if (!picking) return;
  if (state.hexes.length <= 2) return toast(T.palet.minimaal);
  const { i, before } = picking; picking = null;
  dlgKleur.close();
  state = before; remove(i);
});
$('#kleurDone').addEventListener('click', () => dlgKleur.close());
dlgKleur.addEventListener('close', () => {
  if (!picking) return;
  const after = clone(state); state = picking.before; picking = null;
  commit(after);
});
function openColor(i: number) {
  picking = { i, before: clone(state), original: state.hexes[i], originalLocked: state.locked[i] };
  $('#kleurTitel').textContent = fill(T.palet.kleur, i + 1);
  wheel.set(state.hexes[i]);
  paintPicker();
  openSheet(dlgKleur, bands.children[i] as HTMLElement);
}

// ---------- Sheets: van onderen op de telefoon, als popover naast de kleur op de computer ----------
/** Een sheet; breed met een anker als popover. 'onder' (standaard) staat rechts onder het anker, 'boven' opent
 *  links uitgelijnd erboven, zoals het harmoniemenu boven zijn knop (dat zou onder de rand van de editor vallen). */
// plek: 'onder' rechts onder een knop in de werkbalk, 'links' eronder en links uitgelijnd (de harmonie in de kop),
// 'boven' erboven als dat past.
function openSheet(d: HTMLDialogElement, anchor?: HTMLElement, plek: 'onder' | 'links' | 'boven' = 'onder') {
  d.classList.toggle('pop', !!anchor && wide.matches);
  d.style.left = d.style.top = '';
  d.showModal();
  if (anchor && wide.matches) {
    const r = anchor.getBoundingClientRect(), w = d.offsetWidth, h = d.offsetHeight;
    const left = plek === 'onder' ? r.right - w - 72 : r.left;
    const top = plek === 'boven' && r.top - h - 8 >= 16 ? r.top - h - 8 : r.bottom + 8;
    d.style.left = `${Math.max(16, Math.min(innerWidth - w - 16, left))}px`;
    d.style.top = `${Math.max(16, Math.min(innerHeight - h - 16, top))}px`;
  }
}
// Klikken naast een sheet sluit hem.
$$<HTMLDialogElement>('dialog.sheet').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

// ---------- Harmonie ----------
const dlgHarmonie = $<HTMLDialogElement>('#dlgHarmonie');
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-harmony]');
  if (!b) return;
  chooseHarmony(b.dataset.harmony as Harmony);
  if (dlgHarmonie.open) dlgHarmonie.close();
});

// ---------- Knoppen ----------
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
  if (a === 'generate') { generate(); meet('genereer'); }
  else if (a === 'undo') undo();
  else if (a === 'add' || a === 'more') add();
  else if (a === 'fewer') remove(state.hexes.length - 1);
  else if (a === 'cooler') temperature(-1);
  else if (a === 'warmer') temperature(1);
  else if (a === 'harmonies') openSheet(dlgHarmonie, $<HTMLElement>('.harmony-btn'), 'links');
  else if (a === 'export') openExport();
  else if (a === 'kies-foto') $<HTMLInputElement>('#photoInput').click();
  // De + in de werkbalk (telefoon): naar Begin vanuit, onder het palet.
  else if (a === 'begin') { $('#begin').scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' }); $<HTMLElement>('.begin-tabs [aria-selected="true"]').focus({ preventScroll: true }); }
});
/** Na een nieuw palet uit Begin vanuit: onder elkaar (smaller dan de twee kolommen) terug naar het palet; naast elkaar staat het al in beeld. */
function naarPalet() {
  if (!duo.matches) $('#editor').scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
}
addEventListener('keydown', (e) => {
  if ($$<HTMLDialogElement>('dialog').some((d) => d.open) || (e.target as HTMLElement).closest('input, select, textarea')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key === ' ' && !(e.target as HTMLElement).closest('button, a')) { e.preventDefault(); generate(); }
  // 1 tot en met 8: die kleur vast of los, zoals het slot. Niet met ⌘: ⌘1 wisselt van tabblad.
  else if (/^[1-8]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey && Number(e.key) <= state.hexes.length) {
    e.preventDefault();
    const i = Number(e.key) - 1, next = clone(state);
    next.locked[i] = !next.locked[i];
    commit(next);
  }
});

// ---------- Exporteer: afbeelding (Kaart, Kleurvlak), bestand (S-076), hexcodes, link ----------
const dlgExport = $<HTMLDialogElement>('#dlgExport');
const MIME: Record<FileFormat, string> = { procreate: 'application/zip', adobe: 'application/octet-stream', colair: 'application/json' };
const nameOf = () => ($<HTMLInputElement>('#exportName').value.trim().split(/\s+/).join(' ')) || T.exporteer.naamStandaard;
function openExport() {
  $<HTMLInputElement>('#exportName').value = state.name;
  // De tegels tonen het palet zelf: zo zie je dat je een afbeelding krijgt, en welke.
  const banden = state.hexes.map((hex) => `<i style="background:${esc(hex)}"></i>`).join('');
  $$<HTMLElement>('.export-voorbeeld .banden', dlgExport).forEach((el) => { el.innerHTML = banden; });
  openSheet(dlgExport);
}
$<HTMLInputElement>('#exportName').addEventListener('input', (e) => { state.name = (e.target as HTMLInputElement).value; });
$('#exportName').addEventListener('change', inAdres);
dlgExport.addEventListener('click', async (e) => {
  const target = e.target as HTMLElement;
  const format = target.closest<HTMLElement>('[data-format]')?.dataset.format as FileFormat | undefined;
  if (format) {
    meet(`export/${format}`);
    const file = makeFile(nameOf(), state.harmony, state.hexes.map((hex, i) => ({ hex, locked: state.locked[i] })));
    return save(new Blob([fileData(format, file)], { type: MIME[format] }), `${nameOf()}.${EXTENSION[format]}`);
  }
  const kind = target.closest<HTMLElement>('[data-export]')?.dataset.export;
  if (!kind) return;
  meet(`export/${kind}`);
  const name = nameOf();
  if (kind === 'hex') { await copy(state.hexes.join('\n')); return toast(T.exporteer.gekopieerd); }
  if (kind === 'link') {
    const url = link();
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { try { await navigator.share({ title: name, url }); } catch { /* gestopt */ } return; }
    await copy(url); return toast(T.exporteer.gekopieerd);
  }
  save(await picture(kind as 'card' | 'field', name), `${name}.png`);
});
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); } catch {
    const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
  }
}
/** Delen op de telefoon (in Foto's of Bestanden), anders downloaden. */
async function save(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (err) { if ((err as Error).name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(T.exporteer.bewaard);
}
function link() {
  return location.href.split(/[?#]/)[0] + toSearch(state);
}
function fromLink(): State | null {
  const p = fromSearch(location.search);
  return p && { ...p, source: 'harmony' };
}

// De afbeeldingen van de app (PalettePictures.swift): 1080 × 1350 punten op schaal 2, vaste kleuren.
const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace';
const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
async function iconImage(name: string) {
  const sym = document.getElementById(`i-${name}`)!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sym.getAttribute('viewBox')}" width="96" height="96" style="color:#141414">${sym.innerHTML}</svg>`;
  return load('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}
async function picture(style: 'card' | 'field', name: string): Promise<Blob> {
  const W = 1080, H = 1350, k = 2, cv = document.createElement('canvas');
  cv.width = W * k; cv.height = H * k;
  const g = cv.getContext('2d')!; g.scale(k, k);
  const logo = await load('/assets/colair-logo.svg');
  const icon = state.source === 'harmony' ? await iconImage(harmonyIcon[state.harmony]) : null;
  const subtitle = state.source === 'harmony' ? T.harmonieen[state.harmony].naam : T.uitAfbeelding.bron;
  const meta = (x: number, cy: number) => {
    let tx = x;
    if (icon) { g.drawImage(icon, x, cy - 14, 28, 28); tx += 36; }
    g.font = `400 22px ${SANS}`; g.fillStyle = 'rgba(20,20,20,.6)'; g.textBaseline = 'middle';
    g.fillText(`${subtitle} · ${state.hexes.length} ${T.exporteer.kleuren}`, tx, cy);
    return tx + g.measureText(`${subtitle} · ${state.hexes.length} ${T.exporteer.kleuren}`).width;
  };
  const fitText = (text: string, size: number, weight: number, max: number) => {
    let s = size; do { g.font = `${weight} ${s}px ${SANS}`; s -= 2; } while (g.measureText(text).width > max && s > size / 2);
  };
  const stripes = (x: number, y: number, w: number, h: number, inset: number, r: number) => {
    g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip();
    const sh = h / state.hexes.length;
    state.hexes.forEach((hex, i) => {
      g.fillStyle = hex; g.fillRect(x, y + i * sh, w, sh + 0.5);
      g.font = `500 26px ${MONO}`; g.fillStyle = ink(hex); g.textBaseline = 'middle'; g.fillText(hex, x + inset, y + i * sh + sh / 2);
    });
    g.restore();
  };
  if (style === 'card') {
    g.fillStyle = '#F4F3EF'; g.fillRect(0, 0, W, H);
    g.save(); g.shadowColor = 'rgba(20,20,20,.06)'; g.shadowBlur = 24; g.shadowOffsetY = 2;
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(48, 48, W - 96, H - 96, 28); g.fill(); g.restore();
    let y = 48 + 24 + 24;
    g.drawImage(logo, 48 + 24 + 32, y, (36 * 409) / 143, 36); y += 36 + 32;
    if (name) { fitText(name, 60, 600, W - 2 * (48 + 24 + 32)); g.fillStyle = '#141414'; g.textBaseline = 'top'; (g as any).letterSpacing = '-0.6px'; g.fillText(name, 48 + 24 + 32, y); (g as any).letterSpacing = '0px'; y += 72 + 20; }
    meta(48 + 24 + 32, y + 14); y += 28 + 40;
    stripes(72, y, W - 144, H - 72 - y, 32, 16);
  } else {
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, 128);
    let x = 64;
    if (name) { fitText(name, 40, 600, 480); g.fillStyle = '#141414'; g.textBaseline = 'middle'; g.fillText(name, x, 64); x += g.measureText(name).width + 28; }
    meta(x, 64);
    g.drawImage(logo, W - 64 - (32 * 409) / 143, 48, (32 * 409) / 143, 32);
    stripes(0, 128, W, H - 128, 64, 0);
  }
  return new Promise((ok) => cv.toBlob((b) => ok(b!), 'image/png'));
}

// ---------- Begin vanuit: de tabs Afbeelding · Kleur, op de site met Inspiratie ervoor (ontwerp 20 november 2026) ----------
/** De tabs staan in Generator.astro; de site zet er Inspiratie ('kunst') voor. */
type Begin = string;
const beginTabs = $$<HTMLButtonElement>('.begin-tabs [data-begin]');
function kiesBegin(tab: Begin, focus = false) {
  beginTabs.forEach((b) => {
    const aan = b.dataset.begin === tab;
    b.setAttribute('aria-selected', String(aan));
    b.tabIndex = aan ? 0 : -1;
    $(`#${b.getAttribute('aria-controls')}`).hidden = !aan;
    if (aan && focus) b.focus();
  });
  // Kleur begint bij het palet van nu: de eerste vaste kleur, anders de bovenste.
  if (tab === 'kleur') vulKleur();
}
beginTabs.forEach((b) => b.addEventListener('click', () => kiesBegin(b.dataset.begin as Begin)));
// Pijltjes links en rechts lopen door de tabs, zoals een gesegmenteerde keuze.
$('.begin-tabs').addEventListener('keydown', (e) => {
  const stap = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!stap) return;
  e.preventDefault();
  const i = beginTabs.findIndex((b) => b.getAttribute('aria-selected') === 'true');
  kiesBegin(beginTabs[(i + stap + beginTabs.length) % beginTabs.length].dataset.begin as Begin, true);
});

// ---------- Kleur: Vanuit kleur (S-068), in de kolom ----------
const paneKleur = $('#paneKleur');
let from = { hex: '#C8553D', harmony: 'analogous' as Harmony, count: 5, seed: 1n, preview: null as StartPalette | null };
/** Vorige in Vanuit kleur: de keuzes van vóór elke stap (een ander voorbeeld, de harmonie, het aantal, de startkleur). */
type FromStep = { hex: string; harmony: Harmony; count: number; seed: bigint };
let fromSteps: FromStep[] = [];
let fromDragging = false;
function stepFrom() { fromSteps.push({ hex: from.hex, harmony: from.harmony, count: from.count, seed: from.seed }); }
function undoFrom() {
  const prev = fromSteps.pop();
  if (!prev) return;
  Object.assign(from, prev);
  startWheel.set(from.hex);
  paintFrom();
}
const startWheel = new Wheel($<HTMLCanvasElement>('#startWheel'), (hex) => {
  // Eén sleepbeweging over het wiel is één stap.
  if (!fromDragging) stepFrom();
  fromDragging = true;
  from.hex = hex; paintFrom();
}, () => (fromDragging = false));
function paintFrom() {
  from.preview = startingFrom(from.hex, from.count, defaultSettings(from.harmony), from.seed);
  const sc = $('#startColor');
  sc.style.setProperty('--start', from.hex); sc.style.setProperty('--start-on', ink(from.hex));
  sc.querySelector('code')!.textContent = from.hex;
  $('#example').innerHTML = from.preview.hexes.map((h, i) => `<i style="background:${h}" class="${i === from.preview!.startIndex ? 'start' : ''}"></i>`).join('');
  $('#startCount').textContent = String(from.count);
  $<HTMLSelectElement>('#startHarmony').value = from.harmony;
  $<HTMLButtonElement>('#startUndo').disabled = !fromSteps.length;
}
function vulKleur() {
  const i = state.locked.findIndex(Boolean);
  from = { hex: state.hexes[Math.max(0, i)], harmony: state.harmony, count: state.hexes.length, seed: rng.next(), preview: null };
  fromSteps = [];
  startWheel.set(from.hex);
  paintFrom();
}
$('#startUndo').addEventListener('click', undoFrom);
// In de tab Kleur is ⌘Z Vorige van het voorbeeld, niet van het palet (zoals het venster Vanuit kleur in de app).
paneKleur.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !(e.target as HTMLElement).closest('input, select, textarea')) { e.preventDefault(); e.stopPropagation(); undoFrom(); }
});
$('#startGenerate').addEventListener('click', () => { stepFrom(); from.seed += 1n; paintFrom(); });
$<HTMLSelectElement>('#startHarmony').addEventListener('change', (e) => { stepFrom(); from.harmony = (e.target as HTMLSelectElement).value as Harmony; paintFrom(); });
paneKleur.querySelectorAll<HTMLElement>('[data-step]').forEach((b) => b.addEventListener('click', () => {
  const count = Math.min(8, Math.max(2, from.count + Number(b.dataset.step)));
  if (count === from.count) return;
  stepFrom(); from.count = count; paintFrom();
}));
$('#startMake').addEventListener('click', () => {
  const p = from.preview!;
  // Een nieuw palet begint open, de startkleur ook: je genereert er verder vanuit.
  commit({ hexes: p.hexes, locked: p.hexes.map(() => false), harmony: from.harmony, source: 'harmony', name: '' });
  // Een volgende Maak palet begint bij het palet dat er nu staat.
  vulKleur();
  naarPalet();
});

// ---------- Uit afbeelding (S-037, S-038): de foto blijft in de browser ----------
const dlgFoto = $<HTMLDialogElement>('#dlgFoto');
let photo: { bitmap: ImageBitmap; sampler: Sampler; samples: Sample[]; count: number; name: string } | null = null;
$<HTMLInputElement>('#photoInput').addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  (e.target as HTMLInputElement).value = '';
  if (file) openPhoto(file);
});
/** Een foto (gekozen, gesleept of een voorbeeld) in het venster Uit afbeelding. Hij blijft in de browser. */
async function openPhoto(file: Blob, name = '') {
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { return; }
  photo = { bitmap, sampler: new Sampler(bitmap), samples: [], count: photo?.count ?? 5, name };
  const img = $<HTMLImageElement>('#photoImg');
  if (img.src) URL.revokeObjectURL(img.src);
  img.src = URL.createObjectURL(file);
  await img.decode().catch(() => {});
  extractPhoto();
  if (!dlgFoto.open) openSheet(dlgFoto);
  requestAnimationFrame(paintPhoto);
}
// Het sleepvlak: een foto erop laten vallen opent hem; de hele kolom vangt hem, zodat je niet hoeft te mikken.
const sleepVlak = $('#drop'), paneFoto = $('#paneFoto');
const isFile = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
paneFoto.addEventListener('dragover', (e) => { if (!isFile(e)) return; e.preventDefault(); sleepVlak.classList.add('over'); });
paneFoto.addEventListener('dragleave', (e) => { if (!paneFoto.contains(e.relatedTarget as Node)) sleepVlak.classList.remove('over'); });
paneFoto.addEventListener('drop', (e) => {
  sleepVlak.classList.remove('over');
  const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  openPhoto(file);
});
// De voorbeelden: dezelfde foto's als in de app, om Uit afbeelding te proberen zonder eigen beeld.
$$<HTMLElement>('[data-voorbeeld]').forEach((b) => b.addEventListener('click', async () => {
  const r = await fetch(b.dataset.voorbeeld!).catch(() => null);
  if (r?.ok) openPhoto(await r.blob(), b.dataset.naam);
}));
function extractPhoto() { if (photo) photo.samples = extract(photo.bitmap, photo.count); paintPhoto(); }
function paintPhoto() {
  if (!photo) return;
  // De markers over het deel van het vak waar de foto echt staat (object-fit: contain).
  const img = $<HTMLImageElement>('#photoImg'), box = img.getBoundingClientRect(), ar = photo.bitmap.width / photo.bitmap.height;
  let w = box.width, h = box.width / ar;
  if (h > box.height) { h = box.height; w = h * ar; }
  const m = $('#markers');
  Object.assign(m.style, { left: `${(box.width - w) / 2}px`, top: `${(box.height - h) / 2}px`, width: `${w}px`, height: `${h}px`, inset: 'auto' });
  m.innerHTML = photo.samples.map((s, i) => `<button type="button" data-m="${i}" style="left:${s.x * 100}%;top:${s.y * 100}%;--c:${s.hex}" aria-label="${s.hex}"></button>`).join('');
  $('#photoStrip').innerHTML = photo.samples.map((s) => `<i style="background:${s.hex}"></i>`).join('');
  $('#photoCount').textContent = String(photo.count);
}
$('#markers').addEventListener('pointerdown', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-m]');
  if (!b || !photo) return;
  b.setPointerCapture(e.pointerId);
  const i = Number(b.dataset.m), m = $('#markers');
  const move = (ev: PointerEvent) => {
    const r = m.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
    const hex = photo!.sampler.hexAt(x, y);
    photo!.samples[i] = { ...photo!.samples[i], x, y, hex };
    b.style.left = `${x * 100}%`; b.style.top = `${y * 100}%`; b.style.setProperty('--c', hex);
    ($('#photoStrip').children[i] as HTMLElement).style.background = hex;
  };
  b.addEventListener('pointermove', move);
  b.addEventListener('pointerup', () => b.removeEventListener('pointermove', move), { once: true });
});
dlgFoto.querySelectorAll<HTMLElement>('[data-step]').forEach((b) => b.addEventListener('click', () => {
  if (!photo) return;
  photo.count = Math.min(8, Math.max(3, photo.count + Number(b.dataset.step)));
  extractPhoto();
}));
$('#photoOther').addEventListener('click', () => $<HTMLInputElement>('#photoInput').click());
$('#photoUse').addEventListener('click', () => {
  if (!photo) return;
  const hexes = photo.samples.map((s) => s.hex);
  commit({ hexes, locked: hexes.map(() => false), harmony: closestHarmony(hexes), source: 'image', name: photo.name });
  dlgFoto.close();
  naarPalet();
});
addEventListener('resize', () => { if (dlgFoto.open) paintPhoto(); });

// ---------- Melding ----------
let toastTimer = 0;
function toast(text: string) {
  const t = $('#toast');
  t.textContent = text; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => t.classList.remove('on'), 1800);
}

render();

// ---------- Voor wat de site toevoegt (Inspiratie, src/scripts/maak.ts) ----------
/** Het palet van nu, een kopie. */
export const current = () => clone(state);
/** Een palet zonder stap voor Vorige: het volgt iets dat nog beweegt (een werk naast de editor). */
function replace(next: State) { state = clone(next); render(); }
export { $, $$, T, wide, duo, commit, replace, render, toast, naarPalet };
export type { State };
