const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: [
    '<rootDir>/tests/e2e/',
    '<rootDir>/.next/',
    // Vendored standalone Vite app with its own toolchain.
    '<rootDir>/tools/preflight-dashboard/',
  ],
  // .next/standalone re-emits a package.json named like the root one, which
  // collides in Jest's haste map once a build has run in the same workspace.
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules.bak.',
    '<rootDir>/.next/',
    '<rootDir>/tools/preflight-dashboard/',
  ],
};

// Use async form so we can override transformIgnorePatterns AFTER nextJest sets them.
// This is needed because @upstash/redis pulls in `uncrypto` which ships only ESM
// (.mjs with `export` syntax) — Jest can't process it without transformation.
module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();
  config.transformIgnorePatterns = [
    // bson (pulled in by mongodb) ships ESM-only .mjs — transform it for Jest.
    '/node_modules/(?!(uncrypto|@upstash/redis|@upstash/ratelimit|mongodb|bson)/)',
  ];
  return config;
};
