const expoConfig = require('eslint-config-expo/flat');

const base = require('./base');

/** Lint rules for the mobile app (apps/mobile), built on Expo's official flat config. */
const reactNativeConfig = [
  ...expoConfig,
  ...base,
  {
    ignores: ['expo-env.d.ts'],
  },
];

module.exports = reactNativeConfig;
