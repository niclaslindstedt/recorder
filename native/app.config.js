// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Expo config, as a FUNCTION rather than a static app.json so the app's
// marketing version can be read from the web app's `package.json`. The wrapper
// has no version of its own — it ships one build of the recorder, and the
// two must never disagree about which one. Store build numbers are
// auto-incremented by EAS (see eas.json), so nothing here is bumped by hand.

const { version } = require("../package.json");

// The listing's name and identifier, and the container the document syncs
// through. Build variables rather than literals — see ./identifiers.js.
const {
  DISPLAY_NAME,
  BUNDLE_ID,
  ICLOUD_CONTAINER,
} = require("./identifiers.js");

// The light theme's page background (`index.html`'s light `theme-color`).
// Only paints the splash and the chrome before the page reports its own.
const BRAND_BG = "#ffffff";

// The near-black the app mark is cut from (scripts/generate-icons.mjs's BG).
// The adaptive icon's foreground runs to the edges of its tile, so the layer
// behind it has to be the same ink or the launcher's mask shows a seam.
const MARK_INK = "#12101a";

// The EAS project this app builds under. `eas init` prints the id; paste it
// here or pass it in the environment (which is what CI does), because
// `eas init` cannot write into a dynamic config. Left unset, the project is
// simply unlinked and `eas build` will ask — it is not a build failure.
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? "";

module.exports = () => ({
  expo: {
    name: DISPLAY_NAME,
    slug: "recorder",
    version,
    // The Record screen is a column — meter, spectrum, the button — that
    // reflows beside the library where the window is wide enough, so a
    // phone on its side is a supported shape and the app is not pinned.
    orientation: "default",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    icon: "./assets/icon.png",
    // The URL scheme is the bundle id — reverse-DNS, as RFC 8252 §7.1 asks of
    // a private-use scheme, so it is this listing's own and no other app can
    // claim it. `se.agilator.recorder` in production, `dev.local.recorder` in a
    // plain checkout; never committed.
    scheme: BUNDLE_ID,
    backgroundColor: BRAND_BG,
    assetBundlePatterns: ["**/*"],

    ios: {
      supportsTablet: true,
      bundleIdentifier: BUNDLE_ID,
      entitlements: {
        // iCloud Documents: the app's own ubiquity container, which is what
        // `modules/icloud-store` reads and writes. Without all three of these
        // keys the container URL resolves to nil at runtime and the backend
        // reports itself unavailable — which is a misconfiguration, not a
        // state the user can fix.
        "com.apple.developer.icloud-container-identifiers": [ICLOUD_CONTAINER],
        "com.apple.developer.ubiquity-container-identifiers": [
          ICLOUD_CONTAINER,
        ],
        "com.apple.developer.icloud-services": ["CloudDocuments"],
      },
      infoPlist: {
        // Publishes the container's `Documents` folder to the Files app under
        // the listing's own name, so the user can see, copy and back up the
        // recordings the app keeps there — each space's index and the audio
        // files beside it. Without this the container syncs but is invisible
        // — a recording its owner cannot open. `Any`, because the files sit
        // in a folder per space under `Documents`.
        NSUbiquitousContainers: {
          [ICLOUD_CONTAINER]: {
            NSUbiquitousContainerIsDocumentScopePublic: true,
            NSUbiquitousContainerSupportedFolderLevels: "Any",
            NSUbiquitousContainerName: DISPLAY_NAME,
          },
        },
        // The microphone is the app. iOS shows this string the first time the
        // page's `getUserMedia` asks, and App Review reads it against what
        // the app does: it records what the user presses Record for, keeps it
        // on the device, and sends nothing anywhere the user did not connect.
        NSMicrophoneUsageDescription:
          "The microphone is used to record your voice memos. Recordings stay on your device unless you connect your own cloud storage.",

        // The bundled build is served over plain HTTP on the loopback
        // interface. ATS is left ON — only localhost is excepted, so nothing
        // else in the app may fall back to cleartext.
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          NSAllowsLocalNetworking: true,
          NSExceptionDomains: {
            localhost: {
              NSExceptionAllowsInsecureHTTPLoads: true,
              NSIncludesSubdomains: false,
            },
          },
        },
        // Skips the App Store export-compliance prompt: no non-exempt crypto.
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: BUNDLE_ID,
      // The microphone, which is what the app is for, and the camera, for
      // the pairing QR code — and nothing else: the wrapper reads no other
      // sensor, no contact and no file outside its own sandbox, and Play's
      // data-safety form is answered against this list. The WebView asks the
      // OS for the microphone the first time the page's `getUserMedia` does
      // (react-native-webview grants a page's media request once the app
      // holds the permission), so nothing is asked for at launch. iCloud is
      // Apple's, so on Android the app is otherwise the web app served from
      // inside the download.
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.CAMERA",
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: MARK_INK,
      },
    },

    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 180,
          resizeMode: "contain",
          backgroundColor: BRAND_BG,
        },
      ],
      // The bundled static server (lighttpd, via
      // @dr.pogodin/react-native-static-server) needs Android minSdk 28, and
      // the loopback origin is plain HTTP so cleartext has to be permitted.
      [
        "expo-build-properties",
        { android: { minSdkVersion: 28, usesCleartextTraffic: true } },
      ],
      // The in-app QR scanner (src/QrScanner.tsx): the camera is asked for the
      // first time the reader taps Scan on the pairing sheet, never at launch.
      // The string is what iOS shows in that prompt, and App Review reads it
      // against what the app does — the camera, only, for the pairing code,
      // no picture kept. The microphone is the page's, asked for through the
      // WebView (see `NSMicrophoneUsageDescription` above), never through the
      // camera plugin — a scanner that could record would be a second reason
      // for a permission the app already has one for. English is the only
      // language the app ships; a second one adds its translation of this
      // string through Expo's `locales` in the same change.
      [
        "expo-camera",
        {
          cameraPermission:
            "The camera is used only to scan the pairing code that connects this app to your storage server. No picture is kept.",
          microphonePermission: false,
          recordAudioAndroid: false,
        },
      ],
    ],

    extra: {
      // NO remote URL here, deliberately. The app serves the copy of the time
      // report bundled inside it (assets/webroot.zip) from a loopback server —
      // that is what makes it work offline, and what makes it an app rather
      // than a viewer for a website (App Store guideline 4.2). To point a
      // debug build at a deployed slot, set EXPO_PUBLIC_RECORDER_URL at build
      // time; src/config.ts reads that env var directly.
      ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
    },
  },
});
