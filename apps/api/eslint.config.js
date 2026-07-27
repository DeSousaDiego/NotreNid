const nodeConfig = require('@notre-nid/eslint-config/node');

module.exports = [
  ...nodeConfig,
  {
    rules: {
      // Les décorateurs Nest (paramètres non utilisés dans les DTO, injections) sont un usage légitime.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
];
