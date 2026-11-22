// Het bestand dat de app opent (S-034, S-035): ColairKit/Trends.swift, PaletteFile. JSON met gesorteerde sleutels en
// inspringing zoals Swift's JSONEncoder met .prettyPrinted en .sortedKeys.
import { normalizedHex } from './color';
import { HARMONIES, type Harmony } from './harmony';

export interface FileColor { hex: string; locked: boolean; name?: string }
export interface PaletteFile { app: 'Colair'; version: 1; name: string; harmony: Harmony; colors: FileColor[] }

export function makeFile(name: string, harmony: Harmony, colors: FileColor[]): PaletteFile {
  return { app: 'Colair', version: 1, name, harmony, colors };
}

/** Zoals de app hem schrijft: sleutels op alfabet, twee spaties inspringen, " : " tussen sleutel en waarde. */
export function encode(file: PaletteFile): string {
  const sorted = (v: unknown): unknown => Array.isArray(v) ? v.map(sorted)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().filter((k) => (v as any)[k] !== undefined).map((k) => [k, sorted((v as any)[k])])) : v;
  return JSON.stringify(sorted(file), null, 2).replace(/^(\s*"[^"]+"):/gm, '$1 :').replace(/\//g, '\\/');
}

/** Leest en controleert een bestand zoals de app: alleen bekende velden, onze app, 2 tot 8 geldige kleuren. */
export function decode(text: string): PaletteFile | null {
  let o: any;
  try { o = JSON.parse(text); } catch { return null; }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  if (!Object.keys(o).every((k) => ['app', 'version', 'name', 'harmony', 'colors'].includes(k))) return null;
  if (o.app !== 'Colair' || typeof o.version !== 'number' || o.version > 1 || typeof o.name !== 'string') return null;
  if (!HARMONIES.includes(o.harmony) || !Array.isArray(o.colors) || o.colors.length < 2 || o.colors.length > 8) return null;
  const colors: FileColor[] = [];
  for (const c of o.colors) {
    if (!c || typeof c !== 'object' || !Object.keys(c).every((k) => ['hex', 'locked', 'name'].includes(k))) return null;
    const hex = typeof c.hex === 'string' ? normalizedHex(c.hex) : null;
    if (!hex || typeof c.locked !== 'boolean') return null;
    colors.push({ hex, locked: c.locked, ...(typeof c.name === 'string' ? { name: c.name } : {}) });
  }
  return makeFile(o.name, o.harmony, colors);
}
