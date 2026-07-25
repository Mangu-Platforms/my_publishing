// ESLint 9 flat config — replaces .eslintrc.json (eslint-config-next 16 requires
// eslint >= 9; Next 14's `next lint` is incompatible with eslint 9's API).
// Mirrors the legacy config: next/core-web-vitals + next/typescript + custom rules.
import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescript from 'eslint-config-next/typescript';

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      // Vendored standalone Vite app with its own toolchain and dependency tree.
      'tools/preflight-dashboard/**',
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^actionTypes$' },
      ],
      // Strictness newly introduced by the bumped toolchain (typescript-eslint v8,
      // react-hooks v6, eslint-config-next 16) that the pre-bump gate
      // (eslint 8 + typescript-eslint 6 + eslint-config-next 14) did not enforce.
      // Neutralized to preserve the repo's effective ruleset; re-enable incrementally.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/incompatible-library': 'off',
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];
