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

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
}

module.exports = withFirebasePodfile;
