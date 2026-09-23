const { withGradleProperties } = require("@expo/config-plugins");

// Only apply the Windows JDK override locally. EAS Build runs on Linux
// where this path does not exist — including it breaks the cloud build.
const IS_WINDOWS = process.platform === "win32";
const JDK_PATH = "C:\\\\Program Files\\\\Eclipse Adoptium\\\\jdk-17.0.20.1+1";
const NDK_VERSION = "27.1.12297006";

module.exports = function withJdkHome(config) {
  return withGradleProperties(config, (config) => {
    // Remove any pre-existing entries so we don't duplicate
    config.modResults = config.modResults.filter(
      (item) =>
        !(item.type === "property" && item.key === "org.gradle.java.home") &&
        !(item.type === "property" && item.key === "ndkVersion")
    );

    // JDK path: Windows only (local dev builds)
    if (IS_WINDOWS) {
      config.modResults.push({
        type: "property",
        key: "org.gradle.java.home",
        value: JDK_PATH,
      });
    }

    // NDK version: portable — always include
    config.modResults.push({
      type: "property",
      key: "ndkVersion",
      value: NDK_VERSION,
    });

    return config;
  });
};