# Contributing

This repository is published from the website of Colair. Every change to the engine or the generator there arrives here as a commit, after its tests and build have passed. So:

- **The engine follows the app.** `src/kit/` is a line-by-line translation of ColairKit, the Swift package of the Colair app. A change to a rule starts in the app; the parity tests (`tests/parity.test.ts`, with outcomes of the Swift code in `tests/fixtures/parity.json`) keep the two the same.
- **Pull requests are welcome**, for the engine, the generator and the docs. They are not merged here directly: a change that is accepted is made at the source, and comes back here with the next sync. You will be credited in that commit.
- **Bugs and ideas**: open an issue. For a wrong colour, give the input, the seed if you used one, and what you expected.

Before you send a change:

```bash
npm test        # parity with the app, the examples in the docs, the helpers
npx astro check # types, 0 errors
npm run build   # the demo builds
```
