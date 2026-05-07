const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Ensures dynamic frameworks are set in Podfile.properties.json and
 * use_modular_headers! is in the Podfile. Required for Firebase Auth
 * Swift pods to build correctly.
 *
 * TODO: remove this plugin when @react-native-firebase/app plugin
 * handles ios_use_frameworks correctly with this Expo SDK version.
 */
function withDynamicFrameworks(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const iosRoot = cfg.modRequest.platformProjectRoot;

      // Inject ios.useFrameworks into Podfile.properties.json
      const propsPath = path.join(iosRoot, "Podfile.properties.json");
      if (fs.existsSync(propsPath)) {
        const props = JSON.parse(fs.readFileSync(propsPath, "utf8"));
        props["ios.useFrameworks"] = "dynamic";
        fs.writeFileSync(propsPath, JSON.stringify(props, null, 2) + "\n");
      }

      // Add use_modular_headers! to Podfile
      const podfilePath = path.join(iosRoot, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf8");
      if (!podfile.includes("use_modular_headers!")) {
        podfile = podfile.replace(
          /target '.*' do/,
          "$&\n  use_modular_headers!"
        );
        fs.writeFileSync(podfilePath, podfile);
      }

      return cfg;
    },
  ]);
}

module.exports = withDynamicFrameworks;
