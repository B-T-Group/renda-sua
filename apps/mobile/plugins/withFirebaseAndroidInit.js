/**
 * Ensures Firebase is initialized on Android before FCM / expo-notifications touch Firebase APIs.
 * google-services.json + com.google.gms.google-services still required (see app.json + prebuild).
 *
 * expo-notifications uses `implementation` for firebase-messaging, so Firebase is not on the app
 * module's compile classpath; we add the same dependency here for MainApplication + future native code.
 */
const { withAppBuildGradle, withMainApplication } = require('expo/config-plugins');

const FIREBASE_IMPORT = 'import com.google.firebase.FirebaseApp';
const FIREBASE_MESSAGING_DEP = "implementation 'com.google.firebase:firebase-messaging:25.0.1'";

function withFirebaseAndroidInit(config) {
  config = withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;
    if (typeof contents !== 'string' || contents.includes('com.google.firebase:firebase-messaging')) {
      return mod;
    }
    contents = contents.replace(/dependencies\s*\{\s*\n/, `dependencies {\n    ${FIREBASE_MESSAGING_DEP}\n`);
    mod.modResults.contents = contents;
    return mod;
  });

  return withMainApplication(config, (mod) => {
    let contents = mod.modResults.contents;
    if (typeof contents !== 'string') {
      return mod;
    }
    if (contents.includes('FirebaseApp.initializeApp')) {
      return mod;
    }
    if (!contents.includes(FIREBASE_IMPORT)) {
      contents = contents.replace(
        /import android\.app\.Application\n/,
        `import android.app.Application\n${FIREBASE_IMPORT}\n`
      );
    }
    const anchor = 'super.onCreate()\n    DefaultNewArchitectureEntryPoint';
    if (!contents.includes(anchor)) {
      return mod;
    }
    contents = contents.replace(
      anchor,
      `super.onCreate()
    if (FirebaseApp.getApps(this).isEmpty()) {
      FirebaseApp.initializeApp(this)
    }
    DefaultNewArchitectureEntryPoint`
    );
    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withFirebaseAndroidInit;
