const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withFirebasePodfile(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      // Add use_modular_headers! right after the target line
      if (!podfile.includes("use_modular_headers!")) {
        podfile = podfile.replace(
          /target '.*' do/,
          "$&\n  use_modular_headers!"
        );
      }

      // Add use_frameworks! :linkage => :dynamic for Firebase Swift pods
      if (!podfile.includes("use_frameworks! :linkage => :dynamic")) {
        podfile = podfile.replace(
          /use_modular_headers!/,
          "use_modular_headers!\n  use_frameworks! :linkage => :dynamic"
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
}

module.exports = withFirebasePodfile;
