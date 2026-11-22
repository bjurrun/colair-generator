// Het palet in een link (Deel een link): ?p=2A3F8C-6E8FC9&h=analogous&v=01&n=Naam. v: welke kleuren vaststaan.
import { normalizedHex } from './color';
import { HARMONIES, closestHarmony, type Harmony } from './harmony';

export interface LinkPalette { hexes: string[]; locked: boolean[]; harmony: Harmony; name: string }

export function toSearch(p: LinkPalette): string {
  const q = new URLSearchParams();
  q.set('p', p.hexes.map((h) => h.slice(1)).join('-'));
  q.set('h', p.harmony);
  if (p.locked.some(Boolean)) q.set('v', p.locked.map((l) => (l ? 1 : 0)).join(''));
  if (p.name) q.set('n', p.name);
  return '?' + q.toString();
}

/** Null als de link geen geldig palet van 2 tot 8 kleuren bevat. */
export function fromSearch(search: string): LinkPalette | null {
  const q = new URLSearchParams(search);
  const parts = (q.get('p') ?? '').split('-');
  const hexes = parts.map((h) => normalizedHex(h));
  if (hexes.length < 2 || hexes.length > 8 || hexes.some((h) => !h)) return null;
  const ok = hexes as string[];
  const h = q.get('h') as Harmony;
  const v = q.get('v') ?? '';
  return { hexes: ok, locked: ok.map((_, i) => v[i] === '1'), harmony: HARMONIES.includes(h) ? h : closestHarmony(ok), name: (q.get('n') ?? '').slice(0, 60) };
}
