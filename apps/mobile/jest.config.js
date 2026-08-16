/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  // Cold worker startup under parallel load can push a suite's first render
  // past the 5s default (see docs/PHASE_STATUS.md Phase 3B/4 "Problèmes
  // rencontrés" — observed on different files each run, not test-specific).
  testTimeout: 20000,
};
