const { withAndroidManifest, withMainActivity, withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withNativeWallet(config) {
  config = withAndroidManifest(config, config => {
    const application = config.modResults.manifest.application[0].$;
    application['android:allowBackup'] = 'false';
    application['android:fullBackupContent'] = 'false';
    application['android:usesCleartextTraffic'] = 'false';
    return config;
  });
  config = withMainActivity(config, config => {
    const marker = 'super.onCreate(null)';
    if (!config.modResults.contents.includes('FLAG_SECURE')) {
      config.modResults.contents = config.modResults.contents.replace(marker,
        `${marker}\n    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)`);
    }
    return config;
  });
  return withAppBuildGradle(config, config => {
    config.modResults.contents = config.modResults.contents.replace('minSdkVersion rootProject.ext.minSdkVersion', 'minSdkVersion 26');
    return config;
  });
};
