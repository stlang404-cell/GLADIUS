import { defineConfig } from 'vite';

// Long multi-season soak tests (tests/soak/**/*.soak.ts): `npm run soak`. Never part of `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/soak/**/*.soak.ts'],
    testTimeout: 30 * 60 * 1000,
  },
});
