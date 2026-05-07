const { withAppDelegate } = require("@expo/config-plugins");

/**
 * Adds Firebase Auth URL handling to AppDelegate so the reCAPTCHA
 * redirect from Safari works correctly when APNs is unavailable
 * (free Apple Developer account without push notifications).
 *
 * TODO: when paid Apple Developer account is active, re-enable push
 * notifications so APNs silent push verification replaces the
 * reCAPTCHA fallback. Better UX, no Safari redirect.
 */
function withFirebaseAuthUrl(config) {
  return withAppDelegate(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // Add FirebaseAuth import if missing
    if (!contents.includes("import FirebaseAuth")) {
      contents = contents.replace(
        "import FirebaseCore",
        "import FirebaseCore\nimport FirebaseAuth"
      );
    }

    // Add Auth.auth().canHandle(url) to the URL handler
    if (!contents.includes("Auth.auth().canHandle(url)")) {
      contents = contents.replace(
        "return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)",
        "if Auth.auth().canHandle(url) { return true }\n    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)"
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withFirebaseAuthUrl;
