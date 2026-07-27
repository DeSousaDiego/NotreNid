const importPlugin = require('eslint-plugin-import');
const globals = require('globals');

const base = require('./base');

/** Lint rules for Node.js projects (apps/api, packages/shared, packages/api-client). */
const nodeConfig = [
  ...base,
  {
    plugins: {
      import: importPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },
];

module.exports = nodeConfig;
