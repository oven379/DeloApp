const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

/**
 * Reanimated и react-native-worklets оба поставляют libworklets.so — без pickFirst сборка AAB падает на mergeReleaseNativeLibs.
 */
function withPickFirstLibworklets(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const gradlePropertiesPath = path.join(
        config.modRequest.platformProjectRoot,
        "gradle.properties"
      );
      if (!fs.existsSync(gradlePropertiesPath)) return config;
      let contents = await fs.promises.readFile(gradlePropertiesPath, "utf8");
      if (contents.includes("libworklets.so")) return config;
      const line = "\n# react-native-reanimated + react-native-worklets (duplicate native lib)\nandroid.packagingOptions.pickFirsts=**/libworklets.so\n";
      await fs.promises.appendFile(gradlePropertiesPath, line, "utf8");
      return config;
    },
  ]);
}

module.exports = withPickFirstLibworklets;
