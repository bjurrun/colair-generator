// Tekst op een kleur uit een palet (de hexcode op een kleurvlak), met minstens 4,5 : 1 contrast (WCAG 1.4.3, S-086).
//
// De app zet daar inkt of wit met 70–75 % dekking (Tone.onLightColor / onDarkColor). Bij een middentint haalt dat
// geen 4,5 : 1 (bijvoorbeeld #CD2BC2: 3,0 : 1). Op de site is de tekst daarom vol: inkt of wit, welke het meest
// contrast geeft. Bij de paar tinten waar ook dat net onder 4,5 blijft (luminantie rond 0,18–0,21), wordt het zwart:
// zwart haalt daar altijd meer dan 4,5 : 1.
import { rgb } from '../kit/color';

const lin = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const luminantie = (hex: string) => { const [r, g, b] = rgb(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
export const contrast = (a: string, b: string) => {
  const [x, y] = [luminantie(a), luminantie(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export const INKT = '#141414', WIT = '#FFFFFF', ZWART = '#000000';

export function tekstOp(hex: string): string {
  const best = contrast(INKT, hex) >= contrast(WIT, hex) ? INKT : WIT;
  return contrast(best, hex) >= 4.5 ? best : ZWART;
}
