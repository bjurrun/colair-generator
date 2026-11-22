// The small helpers of the web generator: safe text in HTML, and moving a colour up or down.
import { describe, expect, it } from 'vitest';
import { esc, jsonScript } from '../src/generator/html';
import { arrows, moved } from '../src/generator/reorder';

describe('html', () => {
  it('escapes text for innerHTML and attributes', () => {
    expect(esc('<b title="x">Tom & \'Jerry\'</b>')).toBe('&lt;b title=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;');
  });
  it('writes JSON that cannot close its <script> block', () => {
    expect(jsonScript({ t: '</script>' })).not.toContain('<');
    expect(JSON.parse(jsonScript({ t: '</script>' }))).toEqual({ t: '</script>' });
  });
});

describe('reorder', () => {
  it('gives the first colour only down, the last only up', () => {
    expect(arrows(0, 3)).toEqual({ up: false, down: true });
    expect(arrows(2, 3)).toEqual({ up: true, down: false });
  });
  it('swaps a colour with its neighbour and ignores a step outside the list', () => {
    expect(moved(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
    expect(moved(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});
