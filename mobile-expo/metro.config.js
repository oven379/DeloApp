// Metro не должен следить за нативными сборками: Gradle постоянно создаёт/удаляет
// каталоги в android/app/build — на Windows это даёт ENOENT и падает bundler (чёрный экран).
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

const existing = Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [];

config.resolver.blockList = [
  ...existing,
  /[/\\]android[/\\].*/,
  /[/\\]ios[/\\].*/,
];

module.exports = config;
