import { defineConfig } from 'vitest/config'

// Three suites: `unit` runs anywhere (npm test); `integration` and `rules` need the Firebase
// emulators and run through scripts/firebase.mjs (npm run test:integration / test:rules).
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'], environment: 'node' } },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'rules',
          include: ['tests/rules/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
})
