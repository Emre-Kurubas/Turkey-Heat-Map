import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Hook rules. `exhaustive-deps` is not stylistic here: the whole render
    // budget rests on memo dependency lists being right, and a missing dep
    // silently serves stale geometry or a stale colour scale.
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    // The core/-purity boundary. This is the rule that keeps the architecture
    // honest; do not weaken it to make a test pass.
    files: ['src/core/**/*.ts'],
    ignores: ['src/core/**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'react', message: 'core/ must stay React-free. Move this to hooks/ or components/.' },
          { name: 'react-dom', message: 'core/ must stay React-free.' },
        ],
        patterns: [
          {
            group: ['@/components/*', '@/hooks/*', '@/context/*'],
            message: 'core/ must not depend on the React layers.',
          },
        ],
      }],
      'no-restricted-globals': ['error',
        { name: 'window', message: 'core/ must stay DOM-free.' },
        { name: 'document', message: 'core/ must stay DOM-free.' },
        { name: 'navigator', message: 'core/ must stay DOM-free.' },
      ],
    },
  },
  {
    rules: {
      'no-restricted-properties': ['error', {
        object: 'Math',
        property: 'random',
        message: 'Use the seeded PRNG in src/data/mock/prng.ts. Randomness breaks reproducibility.',
      }],
    },
  },
  {
    // Config files are not part of the typed project graph.
    files: ['*.config.js', '*.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
