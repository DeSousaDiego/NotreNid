const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enableSymlinks = true;

// Expo Router treats every file under src/app as a route. The default
// blockList excludes a __tests__ directory but not this repo's co-located
// `*.test.tsx` convention, so test files were being bundled as routes and
// crashing at runtime with "expect is not defined" (Jest's global, absent
// outside the test environment).
const existingBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : [existingBlockList]),
  /\.test\.[jt]sx?$/,
];

module.exports = config;
