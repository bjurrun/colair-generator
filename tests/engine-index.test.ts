// De ingang van de engine (src/kit/index.ts, colair-generator/engine) geeft elke module door.
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import * as engine from '../src/kit';

describe('src/kit/index.ts', () => {
  it('verwijst naar elke module van de engine', async () => {
    for (const f of readdirSync('src/kit').filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
      const mod = await import(`../src/kit/${f}`);
      for (const naam of Object.keys(mod)) expect(engine, `${f}: ${naam}`).toHaveProperty(naam);
    }
  });
});
