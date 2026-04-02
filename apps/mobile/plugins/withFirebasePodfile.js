const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withFirebasePodfile(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;

      // Fix Podfile for Firebase static frameworks
      const podfilePath = path.join(projectRoot, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf-8");

      if (!podfile.includes("$RNFirebaseAsStaticFramework")) {
        podfile = podfile.replace(
          "prepare_react_native_project!",
          "$RNFirebaseAsStaticFramework = true\n\nprepare_react_native_project!"
        );
      }

      // Allow non-modular includes in framework modules (Firebase imports React headers)
      if (!podfile.includes("CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES")) {
        podfile = podfile.replace(
          "react_native_post_install(",
          `# Allow Firebase pods to import React-Core non-modular headers
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end

    react_native_post_install(`
        );
      }

      fs.writeFileSync(podfilePath, podfile);

      // Fix AppDelegate.swift — add FirebaseApp.configure() if missing
      const appDelegatePath = path.join(
        projectRoot,
        "CourtIQ",
        "AppDelegate.swift"
      );
      if (fs.existsSync(appDelegatePath)) {
        let appDelegate = fs.readFileSync(appDelegatePath, "utf-8");

        if (!appDelegate.includes("FirebaseApp.configure()")) {
          appDelegate = appDelegate.replace(
            "let delegate = ReactNativeDelegate()",
            "FirebaseApp.configure()\n    let delegate = ReactNativeDelegate()"
          );
          fs.writeFileSync(appDelegatePath, appDelegate);
        }
      }

      return cfg;
    },
  ]);
}

module.exports = withFirebasePodfile;
