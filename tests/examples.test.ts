// The examples from README.md and docs/USING.md, run as tests: if one of these fails, the docs are out of date.
import { describe, expect, it } from 'vitest';
import {
  SeededGenerator, defaultSettings, suggest, firstPalette, addColor, startingFrom, closestHarmony, colorName,
  shiftedPalette, normalizedHex, code, toSearch, fromSearch, makeFile, encode, decode, fileData, EXTENSION, HARMONIES,
} from '../src/kit';

describe('README: a palette in five lines', () => {
  it('fills the free places and keeps the locked colour', () => {
    const settings = defaultSettings('triad');
    const rng = new SeededGenerator(42n);
    const { hexes } = suggest(
      [{ hex: '#C8553D', isLocked: true }, { hex: '#888888', isLocked: false }, { hex: '#888888', isLocked: false }],
      settings, rng,
    );
    expect(hexes).toHaveLength(3);
    expect(hexes[0]).toBe('#C8553D');
    for (const h of hexes) expect(h).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('gives the same colours for the same seed', () => {
    const a = firstPalette(defaultSettings(), new SeededGenerator(7n));
    const b = firstPalette(defaultSettings(), new SeededGenerator(7n));
    expect(a).toEqual(b);
    expect(a).toHaveLength(5);
  });
});

describe('docs/USING.md recipes', () => {
  it('adds one colour without touching the others', () => {
    const hexes = ['#2A3F8C', '#E9C24A'];
    const extra = addColor(hexes, defaultSettings('complementary'), new SeededGenerator(1n));
    expect(extra).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('builds a palette around one colour, dark to light', () => {
    const p = startingFrom('#c8553d', 5, defaultSettings('analogous'), 1);
    expect(p.hexes).toHaveLength(5);
    expect(p.hexes[p.startIndex]).toBe('#C8553D');
  });
  it('names colours, finds the harmony and shifts the temperature', () => {
    expect(colorName('#C8553D')).toMatch(/\w/);
    expect(HARMONIES).toContain(closestHarmony(['#2A3F8C', '#E9C24A', '#E07A2E']));
    const warmer = shiftedPalette(['#2A3F8C', '#6E8FC9'], [true, false], 2);
    expect(warmer[0]).toBe('#2A3F8C');
    expect(warmer[1]).not.toBe('#6E8FC9');
  });
  it('reads and writes notations, links and files', () => {
    expect(normalizedHex('c53')).toBe('#CC5533');
    expect(code('rgb', '#C8553D')).toMatch(/200/);
    const palette = { hexes: ['#2A3F8C', '#E9C24A'], locked: [true, false], harmony: 'complementary' as const, name: 'Harbour' };
    expect(fromSearch(toSearch(palette))).toEqual(palette);
    const file = makeFile('Harbour', 'complementary', [{ hex: '#2A3F8C', locked: true }, { hex: '#E9C24A', locked: false }]);
    expect(decode(encode(file))).toEqual(file);
    expect(fileData('adobe', file).byteLength).toBeGreaterThan(0);
    expect(EXTENSION.procreate).toBe('swatches');
  });
});
