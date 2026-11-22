// ColorTemperature: een-op-een uit ColairKit (Sources/ColairKit/ColorTemperature.swift, S-112). Het hele palet een stap
// warmer of koeler, zoals een schilder een vleugje oker of blauw toevoegt. In OKLab:
// 1. De tint draait TURN graden naar de warme pool (WARM_HUE, oranje), nooit eraan voorbij.
// 2. Daarna schuiven a en b een beetje (TINT) naar de pool; dat geeft grijs een temperatuur en vervaagt naar zwart en
//    wit als 4 · L · (1 − L). Koeler is hetzelfde naar de koude pool, WARM_HUE + 180 (blauw).
// Lichtheid en chroma blijven; buiten sRGB verliest de kleur chroma tot hij past (OKLab.hex).
// Verander hier niets zonder de app (npm test, tools/parity).
import { OKLab, wrap } from './color';

/** De warme pool in OKLab-graden: oranje. De koude pool ligt ertegenover, bij blauw. */
export const WARM_HUE = 60;
/** Hoeveel graden de tint per stap draait. */
export const TURN = 8;
/** Hoe ver a en b per stap naar de pool schuiven. */
export const TINT = 0.01;

/** `hex` na `steps` stappen: positief is warmer, negatief koeler. */
export function shifted(hex: string, steps: number): string {
  if (steps === 0) return hex;
  let color = OKLab.fromHex(hex);
  for (let k = 0; k < Math.abs(steps); k++) color = step(color, steps > 0);
  return color.hex;
}

/** Het palet na `steps` stappen. Vastgezette kleuren (`locked`) blijven; een kleur zonder vlag telt als vrij. */
export function shiftedPalette(hexes: string[], locked: boolean[], steps: number): string[] {
  return hexes.map((hex, index) => (index < locked.length && locked[index] ? hex : shifted(hex, steps)));
}

/** Eén stap, zonder tussendoor naar sRGB af te ronden. */
export function step(input: OKLab, warmer: boolean): OKLab {
  const color = new OKLab(input.l, input.a, input.b);
  const pole = warmer ? WARM_HUE : wrap(WARM_HUE + 180);
  const chroma = color.chroma;
  if (chroma > 0.0001) {
    // De korte weg naar de pool; precies ertegenover draait hij de positieve kant op, zodat de regel altijd hetzelfde doet.
    let turnTo = pole - color.hue;
    if (turnTo > 180) turnTo -= 360;
    if (turnTo <= -180) turnTo += 360;
    const angle = (color.hue + Math.min(TURN, Math.abs(turnTo)) * (turnTo < 0 ? -1 : 1)) * Math.PI / 180;
    color.a = chroma * Math.cos(angle);
    color.b = chroma * Math.sin(angle);
  }
  // Bij zwart en wit is minder ruimte voor kleur: de tint is vol bij middelste lichtheid en nul bij 0 en 1.
  const room = Math.max(0, Math.min(1, 4 * color.l * (1 - color.l)));
  const poleAngle = pole * Math.PI / 180;
  color.a += TINT * room * Math.cos(poleAngle);
  color.b += TINT * room * Math.sin(poleAngle);
  return color;
}
