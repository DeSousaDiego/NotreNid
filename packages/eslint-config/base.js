const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');

/**
 * Shared TypeScript lint rules for Notre Nid (api, mobile, packages).
 * App-specific configs (./node.js, ./react-native.js) extend this array.
 * Import ordering is defined per app-config instead of here, since the
 * mobile config already brings its own `import` plugin via eslint-config-expo
 * and flat config forbids redefining a plugin under the same name.
 */
const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Volontairement absent : @typescript-eslint/consistent-type-imports --fix convertit
      // aveuglément les imports de classes utilisées uniquement en paramètre de constructeur
      // vers `import type`, ce qui casse l'injection de dépendances NestJS (les métadonnées
      // de décorateur perdent la référence runtime à la classe). Trop dangereux à activer
      // avec --fix dans un code basé sur les décorateurs/reflect-metadata.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['dist/**', 'build/**', 'node_modules/**', '.expo/**', 'coverage/**'],
  },
  prettierConfig,
);

module.exports = base;
