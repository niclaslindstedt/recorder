# The native wrapper

A **thin** Expo / React Native shell around the recorder, so it can ship to
the App Store and Google Play — and so it can do the two things a PWA cannot:
run entirely from inside its own download, and keep the document in the
reader's own **iCloud**.

Thin is the design, not an aspiration. The wrapper:

- packs the built web app into `assets/webroot.zip`, unpacks it on first
  launch and serves it from a **loopback HTTP server** (`src/local-server.ts`);
- points a `WebView` at that origin, and gets out of the way — on iOS the
  WebView runs edge to edge and the page pads itself with
  `env(safe-area-inset-*)`, as the installed PWA does; on Android the
  safe-area bands are painted in the page's own background; on both, the
  status bar's clock and icons are light or dark from the background the page
  reports (`src/injected.ts`), never from the phone's appearance; off-origin
  links go to the system browser, and Android's back button drives the
  WebView's history;
- offers the page an **iCloud document store** (`src/icloudBridge.ts` →
  `src/icloud.ts` → `modules/icloud-store`), which the app's own sync engine
  drives exactly as it drives Dropbox;
- opens a cloud provider's sign-in in an **authentication session** when the
  page asks for one (`src/authSessionBridge.ts` → `src/authSession.ts` →
  `expo-web-browser`) — see [Signing in to Dropbox](#signing-in-to-dropbox);
- hands an export to the **share sheet** when the page saves a file
  (`src/saveFileBridge.ts` → `src/saveFile.ts` → `expo-sharing`) — see
  [Exporting a file](#exporting-a-file);
- opens the **camera to read a pairing code** when the reader taps Scan on
  the storage server's pairing sheet (`src/scanQrBridge.ts` →
  `src/QrScanner.tsx` → `expo-camera`) — see
  [Scanning a pairing code](#scanning-a-pairing-code);
- prefers the **microphone and output** the page's Microphone sheet chose,
  through the phone's own audio session (`src/audioRouteBridge.ts` →
  `src/audioRoute.ts` → `modules/audio-route`) — see
  [Choosing the microphone and output](#choosing-the-microphone-and-output).

That is the entire list, and it is deliberately not empty: **App Store
guideline 4.2 rejects a build that is only a viewer for a website**, so the
wrapper has to do things the browser cannot. The self-contained bundle and
iCloud are those things. Adding a third is allowed; adding one that makes
`src/` aware of this wrapper is not.

**Nothing in the repo's `src/` knows this exists.** iCloud, which the web app
has to _offer_ in its storage picker, works without breaking that rule: the
app looks for a document-store **capability** on `window`
(`src/app/cloudHost.ts`) and this installs one, so a browser — which has none
— simply does not show the backend. The app never asks what it is running
inside.

The wrapper also decides nothing about the recordings. It moves bytes: a file
in, a file out. What a day adds up to, what a break counts for and how two
devices' edits reconcile are the web app's, in `src/app/day.ts`, `report.ts`
and `merge.ts`.

## Layout

| Path                       | What it is                                                                                                                                                                                                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`                  | The whole app: a WebView, a spinner, and a failure screen.                                                                                                                                                                                                                                    |
| `src/local-server.ts`      | Unpacks `assets/webroot.zip` and serves it on a **fixed** loopback port.                                                                                                                                                                                                                      |
| `src/injected.ts`          | The theme reporter injected into the page, the status-bar style chosen from its report, and the service-worker teardown.                                                                                                                                                                      |
| `src/icloudBridge.ts`      | **Pure.** The injected store host, and the request/response plumbing. Tested from the root.                                                                                                                                                                                                   |
| `src/icloudWire.ts`        | **Import-free.** The shapes that cross the bridge, and nothing else.                                                                                                                                                                                                                          |
| `src/icloud.ts`            | Answers a store request through the native module, and maps a failure to its kind.                                                                                                                                                                                                            |
| `src/authSessionBridge.ts` | **Pure.** The injected sign-in provider (`window.__ossAuthSession`) and its request/response plumbing. Tested from the root.                                                                                                                                                                  |
| `src/authSession.ts`       | Opens one sign-in in an authentication session (`expo-web-browser`) and hands back where it ended.                                                                                                                                                                                            |
| `src/saveFileBridge.ts`    | **Pure.** The `save-file` descriptor (`window.__ossShell`), the request check, and the script that answers the page. Tested from the root.                                                                                                                                                    |
| `src/saveFile.ts`          | Writes one export to the cache and opens the share sheet (`expo-file-system`, `expo-sharing`).                                                                                                                                                                                                |
| `src/scanQrBridge.ts`      | **Pure.** The `scan-qr` descriptor (`window.__ossShell`), the request check, the origin check, and the script that answers the page. Tested from the root.                                                                                                                                    |
| `src/QrScanner.tsx`        | The camera, mounted only while the page waits on a scan: asks for the camera then, reads one QR code, keeps no frame (`expo-camera`).                                                                                                                                                         |
| `src/audioRouteBridge.ts`  | **Pure.** The injected audio-route host (`window.__recorderAudioHost`), the request check, and the scripts that answer the page and tell it the routes changed. Tested from the root.                                                                                                         |
| `src/audioRouteWire.ts`    | **Import-free.** The shapes that cross the audio-route bridge.                                                                                                                                                                                                                                |
| `src/audioRoute.ts`        | Answers a route request through the native module, and passes its route-change events on.                                                                                                                                                                                                     |
| `src/scriptText.ts`        | **Import-free.** Splicing text safely into an injected script; shared by the bridges.                                                                                                                                                                                                         |
| `modules/icloud-store/`    | A local Expo module: list / read / write / remove inside the app's iCloud container.                                                                                                                                                                                                          |
| `modules/audio-route/`     | A local Expo module (Swift and Kotlin): lists the phone's inputs and outputs, prefers the chosen ones, and says when they change.                                                                                                                                                             |
| `scripts/bundle-web.mjs`   | Builds the web app as the store edition (`VITE_EDITION=store`) and as a shell (`VITE_SHELL_BUILD=on`: no service worker, no update prompt), named `APP_DISPLAY_NAME` (env, then `.env`, then `Recorder`), and packs `dist/` into `assets/webroot.zip`, refusing a webroot with `sw.js` in it. |

`ios/` and `android/` are **prebuild output**: regenerated from `app.config.js`
by `expo prebuild --clean`, gitignored, and the source of truth for nothing.
Never edit them.

## Working on it

```sh
make native-install      # or: npm --prefix native install
make native-bundle       # build the web app into assets/webroot.zip
make native-typecheck
make native-prebuild     # inspect what the config generates
```

Then run it on a device or simulator (needs Xcode / Android Studio):

```sh
cd native
npm run ios        # bundles the web app first, then expo run:ios
npm run android
```

`npm run bundle` must have run at least once before any native build — the
wrapper serves that zip, and without it the app launches to a blank screen.

To point a build at a deployed slot instead of the bundled copy (debugging
only — a store build must never do this):

```sh
EXPO_PUBLIC_RECORDER_URL=https://recorder.niclaslindstedt.se/preview/ npm run ios
```

## iCloud

One index per space, `recorder-<space>.json`, and the recordings beside it in
a folder `recorder-<space>/`, in the app's own iCloud container under
`Documents` — which is the folder iCloud publishes to the **Files app**, so
the reader can open, copy and delete the files holding their own recordings.
A recording that synced to a place its owner could not see would be a worse
answer than not syncing at all.

It appears in **Settings → Cloud sync** beside Dropbox, and
there is no OAuth: the container belongs to the device's iCloud account, so
"connecting" is choosing it. Signing in and out of iCloud happens in iOS
Settings, which is why the app re-asks whether the store is usable every time
the page is shown again.

### How the bytes get there

```
the app's sync engine (src/app/useSyncEngine.ts)
   │  a StorageAdapter over the host — src/app/cloudHost.ts
   ▼
window.__recorderCloudHost           — installed by src/icloudBridge.ts
   │  postMessage ⇅ injectJavaScript
   ▼
App.tsx → src/icloud.ts → modules/icloud-store
   │
   ▼
iCloud.se.agilator.recorder/Documents/recorder-default.json
```

The operations are the framework's `FileStore` — `list`, `read`, `write`,
`remove` — plus `readBytes` and `writeBytes` for the recordings' files in the
folder beside the index, which is what lets the document go through the app's
ordinary per-record merge, and the files through its ordinary sweep, with no
iCloud-shaped special case anywhere in `src/`.

**The container id is pinned in three files that must agree**: `app.config.js`
(all three iCloud entitlements), `modules/icloud-store/index.ts`, and its
Swift twin. Changing it after release strands every document already synced
under the old one.

## Exporting a file

On the web every file the app hands over — the specification PDF, the invoice
file, the backup — is a download: an anchor clicked at a `blob:` URL. In a
WebView that click goes nowhere, because nothing on the phone can open a URL
that exists only inside the page. So every export goes through the
framework's `saveFile`, and this wrapper implements the native half of its
`save-file` contract (oss-framework's `docs/native-shell.md`):

```
Report / Settings → saveFile({ blob | text, filename })   (oss-framework)
   │  window.__ossShell lists "save-file" — injected before the page loads
   │  postMessage { type: "oss-framework/save-file", id, filename, mimeType, base64 }
   ▼
App.tsx → src/saveFile.ts → the cache → Sharing.shareAsync(file)
   │  the reader saves to Files, AirDrops or mails it; the sheet closes
   ▼
injectJavaScript: "oss-framework/save-file-result" { id, ok } — saveFile resolves
```

As with iCloud, the page asks for a **capability**, not for this wrapper: a
browser advertises nothing and keeps its download. The file is written under
the name the page gave (its last path component only) into a directory of its
own in the cache, and the next export deletes it: the wrapper keeps no more
than the latest one, logs nothing of it and hands it to nothing but the sheet.
A failure comes back as data (`ok: false`) and the page says so. A `blob:` or
`data:` URL that still reaches the WebView as a navigation is refused rather
than handed to the system browser, which could not open it either.

## Scanning a pairing code

Pairing the app with the reader's own storage server takes a one-time code,
shown as a QR code by the server's console or by another of the reader's
devices. The phone's own camera app would open that code's link in the
browser — the website, not this app — so the pairing sheet offers **Scan**
instead, and this wrapper implements the native half of the framework's
`scan-qr` contract (oss-framework's `docs/native-shell.md`):

```
Settings → Your server → Scan → scanStorageCode({ labels })   (oss-framework)
   │  window.__ossShell lists "scan-qr" — injected before the page loads
   │  postMessage { type: "oss-framework/scan-qr", version: 1, id, labels }
   ▼
App.tsx (the page's own origin only) → src/QrScanner.tsx → expo-camera
   │  the camera is asked for now, on the first Scan; one QR code, then it closes
   ▼
injectJavaScript: "oss-framework/scan-qr-result" { id, ok, text | reason }
```

The page checks the text is a pairing code and takes it down the same path
as a pasted one; the paste field stays, and a reader who refuses the camera
pastes. The camera is never mounted or asked for at launch. No picture is
taken and no frame is kept: only the decoded text leaves the scanner, into
the answer script and nowhere else — the code is a one-time secret, so it is
never logged. A second request while the scanner is open, an unknown version
or a request from any page but the bundled one is refused. The permission
string in `app.config.js` says exactly that (the camera, only, for the
pairing code, no picture kept), and neither platform gets the microphone.

## Choosing the microphone and output

The page chooses a microphone by `deviceId` and an output by `setSinkId`
where its browser has it. Inside the app neither is enough. WebKit has no
`setSinkId`, and on both platforms the WebView, opening the microphone, puts
the phone on its call path: with a Bluetooth headset connected, the
headset's microphone records and the headset plays over its narrow call
link. "Record on the phone, listen on the headphones" is a question about
the system's audio session, which only the app holds. So the wrapper offers
the page an **audio-route host** — a capability, like iCloud's, which the
page finds through `src/app/audioHost.ts` and never asks what offered it:

```
Record → Microphone → a row
   │  src/app/useAudioRouting.ts — a host is present, so its lists, not the browser's
   ▼
window.__recorderAudioHost.setInput(id) / setOutput(id) / routes() / showPicker()
   │  postMessage (request)  /  injectJavaScript (answer)
   ▼
App.tsx (the page's own origin only) → src/audioRoute.ts → modules/audio-route
   │  iOS: AVAudioSession   Android: AudioManager
   ▼
a route change → injectJavaScript: "recorder:audio-routes" → the page reads its lists again
```

- **iOS** answers for both sides. The inputs are the session's own
  (`availableInputs`). With the phone's microphone (or a wired or USB one)
  chosen, the module takes Bluetooth microphones out of the session's
  options while WebKit has the microphone open, so a Bluetooth headset
  stays on A2DP and the phone records; with a headset's microphone chosen,
  it prefers that port. Outputs are the route's own plus the loudspeaker
  (forced with `overrideOutputAudioPort`), and **More outputs…** opens the
  system's `AVRoutePickerView`.
- **Android** answers for the output only (`inputs: null`): the WebView
  already lists the phone's microphones to the page and opens the one it
  names by `deviceId`. With Bluetooth headphones chosen, the module takes
  the phone back out of communication mode whenever the WebView puts it in,
  so they play as media; the loudspeaker, the earpiece and a wired or USB
  headset are set as the communication device. **More outputs…** opens the
  system's output switcher. Opening the sheet asks once for
  `BLUETOOTH_CONNECT`, without which the WebView cannot see a paired
  headset at all — never at launch, and there is no scanning.

The module prefers; it never holds the session. Nothing is touched until the
page makes a choice, Automatic hands everything back, the iOS session is
never activated from here (WebKit activates it when the microphone opens),
and nothing about a choice is stored natively — the page keeps it and says it
again each time it opens the microphone, and the module puts it back on
every route change.

## Signing in to Dropbox

The page's own Dropbox sign-in is a redirect: consent at dropbox.com, then
back to the page's origin with a code, which the page trades for tokens using
the PKCE verifier it kept in `sessionStorage`. That cannot finish in here. The
providers refuse consent inside an embedded WebView, so `App.tsx` sends an
off-origin page to Safari — and Dropbox would then redirect **Safari** to
`http://localhost:8331…`, an origin it has not registered, in a browser that
does not hold the verifier.

So the wrapper offers the page an **authentication session**
(`ASWebAuthenticationSession` on iOS, a Custom Tab on Android): a browser sheet
over the app that closes as soon as the provider redirects to the app's own
scheme, and hands that URL back.

```
Settings → Cloud sync → Dropbox
   │  src/app/useSyncEngine.ts — getAuthSessionHost() is present, so
   │  connectDropboxAuthSession(appKey, host)   (oss-framework)
   ▼
window.__ossAuthSession.open(authorizeUrl)   — installed by src/authSessionBridge.ts
   │  postMessage (request)  /  injectJavaScript (answer)
   ▼
App.tsx → src/authSession.ts → WebBrowser.openAuthSessionAsync(url, "<bundle id>://oauth")
   │  the reader consents in the sheet; Dropbox redirects to
   │  <bundle id>://oauth?code=…&state=dropbox and the sheet closes
   ▼
the page checks the state, trades the code (same verifier, same redirect URI)
```

As with iCloud, the page asks for a **capability**, not for this wrapper: the
host lives at `window.__ossAuthSession`, a name the framework owns
(`AUTH_SESSION_HOST_PROPERTY`), so the website — which has no host — keeps its
redirect flow and the desktop app keeps its loopback one. The wrapper never
sees a token: it opens an `https:` URL (nothing else is accepted) and returns
the callback URL, unread; a closed sheet comes back as `null`, which the page
takes as "cancelled" and leaves the backend as it was.

**The redirect URI is `<scheme>://oauth`, and the scheme is the bundle id**
(`app.config.js`'s `scheme` is `BUNDLE_ID` from `identifiers.js` — reverse-DNS,
as RFC 8252 §7.1 asks of a private-use scheme). So the store build returns on
**`se.agilator.recorder://oauth`**, and a plain checkout on
`dev.local.recorder://oauth`. Dropbox requires the exact URI to be registered: the
Dropbox app behind `VITE_DROPBOX_APP_KEY` must list `se.agilator.recorder://oauth`
under **Settings → OAuth 2 → Redirect URIs** in the
[App Console](https://www.dropbox.com/developers/apps), next to the website's
and the desktop app's (add `dev.local.recorder://oauth` too to sign in from a
development build). Without it Dropbox shows "Invalid redirect_uri" in the
sheet.

Other off-origin links are unchanged: they still leave for the system browser.

## Things that will bite you

- **The port in `src/local-server.ts` is fixed on purpose.** A web origin is
  scheme + host + port, and `localStorage` is keyed by origin — so a random
  port would hand the WebView an empty store on every launch, and every
  recording the user made would appear to vanish.
- **`localhost`, not `127.0.0.1`.** App Transport Security blocks the literal
  address from `WKWebView` even with exception domains declared. The failure
  mode is a silent blank page on iOS.
- **There is no service worker, and any old one is unregistered.** The site
  is built as a shell (`scripts/web-build.mts`), so the webroot has no
  `sw.js`, and `src/injected.ts` still unregisters a worker an older build may
  have left. The origin is stable across app updates, so such a worker would
  keep answering from its precache after a store update had already unpacked
  the new one.
- **The audio-route bridge is three strings that must agree with `src/`**:
  the property (`window.__recorderAudioHost`), the announcement
  (`recorder:audio-host`) and the change event (`recorder:audio-routes`) —
  plus the four method names and the `speaker` / `earpiece` ids the page
  names in its own words. A mismatch is a Microphone sheet that quietly
  falls back to the browser's lists; `tests/native_audio_route_test.ts` pins
  them.
- **A file iCloud has listed is not a file iCloud has downloaded.** The Swift
  side waits for the bytes and reports a timeout as a failure, never as an
  empty document — because an empty document is a valid one, and the app
  would merge it as such and push over what was really there.

## Releasing

See [`RELEASING.md`](RELEASING.md).
