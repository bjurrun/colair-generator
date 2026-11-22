// Bestanden voor andere apps (S-076): ColairKit/SwatchFiles.swift, regel voor regel. Procreate (.swatches) en
// Adobe Swatch Exchange (.ase, Photoshop, Illustrator, InDesign, Affinity). Byte voor byte gelijk aan de app (npm test).
import { colorName } from './colorNames';
import { hsv, rgb } from './color';
import { encode, type PaletteFile } from './paletteFile';

export type FileFormat = 'procreate' | 'adobe' | 'colair';
/** In de volgorde van de sheet: Procreate, Photoshop en Illustrator, Colair. */
export const FORMATS: FileFormat[] = ['procreate', 'adobe', 'colair'];
export const EXTENSION: Record<FileFormat, string> = { procreate: 'swatches', adobe: 'ase', colair: 'json' };

/** De inhoud van het bestand. */
export function fileData(format: FileFormat, file: PaletteFile): Uint8Array<ArrayBuffer> {
  if (format === 'procreate') return procreate(file);
  if (format === 'adobe') return ase(file);
  return new TextEncoder().encode(encode(file));
}

// ---------- Procreate ----------

/** Procreate houdt hoogstens 30 kleuren in een palet; Colair heeft er hoogstens 8. */
const PROCREATE_LIMIT = 30;

/** Een zip met Swatches.json: een array met één palet {name, swatches[{hue, saturation, brightness, alpha, colorSpace}]}. */
export function procreate(file: PaletteFile): Uint8Array<ArrayBuffer> {
  return zipStored([['Swatches.json', new TextEncoder().encode(procreateJSON(file))]]);
}

/** Zoals JSONSerialization met .sortedKeys: geen spaties, een / als \/, en getallen als %.17g. */
export function procreateJSON(file: PaletteFile): string {
  const swatches = file.colors.slice(0, PROCREATE_LIMIT).map((c) => {
    const v = hsv(c.hex);
    return `{"alpha":1,"brightness":${g17(v.value)},"colorSpace":0,"hue":${g17(v.hue / 360)},"saturation":${g17(v.saturation)}}`;
  });
  return `[{"name":${JSON.stringify(file.name).replace(/\//g, '\\/')},"swatches":[${swatches.join(',')}]}]`;
}

/** Een getal zoals C's %.17g, wat JSONSerialization schrijft (0.78431372549019607, niet 0.7843137254901961). */
export function g17(x: number): string {
  if (x === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(x)));
  const strip = (s: string) => s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  if (exp < -4 || exp >= 17) {
    const [m, e] = x.toExponential(16).split('e');
    const n = Number(e);
    return `${strip(m)}e${n < 0 ? '-' : '+'}${String(Math.abs(n)).padStart(2, '0')}`;
  }
  return strip(x.toPrecision(17));
}

// ---------- Adobe Swatch Exchange ----------

/** Versie 1.0, big-endian: één kleurgroep met de naam van het palet en een RGB-staal per kleur. */
export function ase(file: PaletteFile): Uint8Array<ArrayBuffer> {
  const blocks: [number, number[]][] = [[0xC001, aseName(file.name)]];
  for (const c of file.colors) {
    const [r, g, b] = rgb(c.hex);
    const body = aseName(c.name ? c.name : colorName(c.hex)); // de eigen naam (trend, kleurboek), anders de Colair-naam (S-113)
    body.push(...[...'RGB '].map((ch) => ch.charCodeAt(0)));
    for (const v of [r, g, b]) body.push(...float32(v / 255));
    body.push(...u16(2)); // normaal (niet globaal, geen steunkleur)
    blocks.push([0x0001, body]);
  }
  blocks.push([0xC002, []]);
  const out = [...[...'ASEF'].map((ch) => ch.charCodeAt(0)), ...u16(1), ...u16(0), ...u32(blocks.length)];
  for (const [type, body] of blocks) out.push(...u16(type), ...u32(body.length), ...body);
  return Uint8Array.from(out);
}

/** De lengte in UTF-16-eenheden met de afsluitende nul, dan de naam in UTF-16 big-endian en de nul. */
function aseName(name: string): number[] {
  const units = [...Array.from({ length: name.length }, (_, i) => name.charCodeAt(i)), 0];
  return [...u16(units.length), ...units.flatMap(u16)];
}

const u16 = (v: number) => [(v >> 8) & 0xFF, v & 0xFF];
const u32 = (v: number) => [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];
const le16 = (v: number) => [v & 0xFF, (v >> 8) & 0xFF];
const le32 = (v: number) => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
function float32(v: number): number[] {
  const d = new DataView(new ArrayBuffer(4)); d.setFloat32(0, v, false);
  return [d.getUint8(0), d.getUint8(1), d.getUint8(2), d.getUint8(3)];
}

// ---------- Zip ----------

/** De kleinste zip: bestanden zonder compressie, zoals Zip.stored in de app. */
export function zipStored(files: [string, Uint8Array][]): Uint8Array<ArrayBuffer> {
  const archive: number[] = [], directory: number[] = [];
  for (const [fileName, data] of files) {
    const name = [...new TextEncoder().encode(fileName)];
    const crc = crc32(data), offset = archive.length;
    const shared = [...le16(20), ...le16(0x0800), ...le16(0), ...le16(0), ...le16(0x21), ...le32(crc), ...le32(data.length),
      ...le32(data.length), ...le16(name.length), ...le16(0)];
    archive.push(...le32(0x04034B50), ...shared, ...name, ...data);
    directory.push(...le32(0x02014B50), ...le16(20), ...shared, ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(offset), ...name);
  }
  const directoryOffset = archive.length;
  archive.push(...directory, ...le32(0x06054B50), ...le16(0), ...le16(0), ...le16(files.length), ...le16(files.length),
    ...le32(directory.length), ...le32(directoryOffset), ...le16(0));
  return Uint8Array.from(archive);
}

const TABLE = Array.from({ length: 256 }, (_, i) => {
  let v = i;
  for (let k = 0; k < 8; k++) v = v & 1 ? 0xEDB88320 ^ (v >>> 1) : v >>> 1;
  return v >>> 0;
});

/** CRC-32 (IEEE), zoals zip hem gebruikt. */
export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const byte of data) crc = TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
