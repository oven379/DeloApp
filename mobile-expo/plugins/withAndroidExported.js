const { withAndroidManifest } = require("@expo/config-plugins");

const COMPONENTS = ["activity", "service", "receiver", "provider"];

function ensureExported(manifest) {
  const root = manifest.manifest;
  if (!root) return manifest;

  // Ensure tools namespace for merge overrides
  if (!root.$) root.$ = {};
  if (!root.$["xmlns:tools"]) root.$["xmlns:tools"] = "http://schemas.android.com/tools";

  const application = root.application;
  if (!application || !Array.isArray(application)) return manifest;

  for (const app of application) {
    for (const tag of COMPONENTS) {
      const items = app[tag];
      if (!Array.isArray(items)) continue;
      for (const el of items) {
        if (!el.$) el.$ = {};
        if (el.$["android:exported"] === undefined) {
          const hasIntentFilter = Array.isArray(el["intent-filter"]) && el["intent-filter"].length > 0;
          el.$["android:exported"] = hasIntentFilter ? "true" : "false";
        }
      }
    }

    // Override exported for merged library components (fixes "android:exported missing" from dependencies)
    const overrides = [
      { tag: "provider", name: "expo.modules.filesystem.FileSystemFileProvider", exported: "false" },
    ];
    for (const { tag, name, exported } of overrides) {
      if (!app[tag]) app[tag] = [];
      const exists = app[tag].some((el) => el.$?.["android:name"] === name);
      if (!exists) {
        app[tag].push({
          $: {
            "android:name": name,
            "android:exported": exported,
            "tools:replace": "android:exported",
          },
        });
      }
    }
  }
  return manifest;
}

function withAndroidExported(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = ensureExported(config.modResults);
    return config;
  });
}

module.exports = withAndroidExported;
