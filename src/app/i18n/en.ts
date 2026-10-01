// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The English catalog — the app's single source of user-facing copy, and (as
// the fallback language) the source of the compile-time message-key type. Add
// a string here first; `t()` won't type-check against a key this file doesn't
// carry.
//
// `{name}`-style placeholders interpolate at call time. Keep the surrounding
// sentence in the catalog rather than concatenating fragments at the call
// site: a translator needs the whole sentence to move its words around.

import { APP_NAME } from "../appName.ts";

export const en = {
  app: {
    // The listing's name in an app build, the project's on the website (see
    // `appName.ts`) — which is why the sentences that name the app below are
    // templates over it.
    name: APP_NAME,
    tagline: "Voice memos that stay yours",
  },

  nav: {
    record: "Record",
    library: "Recordings",
    settings: "Settings",
  },

  common: {
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    add: "Add",
    edit: "Edit",
    remove: "Remove",
    rename: "Rename",
    done: "Done",
    back: "Back",
    today: "Today",
    yesterday: "Yesterday",
    // A file the phone could not hand to the share sheet (the website's
    // download cannot fail this way).
    exportFailed: "Could not export {file}: {reason}",
    minutes: "min",
    hours: "h",
    seconds: "s",
  },

  // The Record screen: its four modes — Ready, Listening, Recording, Review.
  record: {
    title: "Record",
    start: "Start recording",
    stop: "Stop",
    pause: "Pause",
    resume: "Resume",
    discard: "Discard",
    ready: "Ready to record",
    recording: "Recording",
    paused: "Paused",
    starting: "Opening the microphone…",
    saving: "Saving…",
    level: "Input level",
    spectrum: "Spectrum",
    // The lamp is drawn as a glyph (a wave with its top cut off, `styles.css`);
    // the word is what a reader without the stylesheet gets.
    clip: "Too loud",
    clipping: "Too loud",
    clippedHint: "Too loud — move away from the sound source",
    kind: {
      compact: "Compact",
      lossless: "Lossless",
    },
    denied:
      "The microphone is off for this app. Allow it in the browser's settings for this site, or in Settings on the phone, and try again.",
    unavailable: "No microphone could be opened on this device.",
    failed: "Recording failed: {reason}",
    // Under the timer while a take runs: what it is and where it goes.
    recordingTo: "{quality} · to {folder}",
    saveTo: "Save to",
    tapToRecord: "Tap to record",
    // Review: the take in memory, getting its name.
    name: "Title",
    newRecording: "New recording",
    noFolder: "No folder",
    peak: "Peak",
    listenBack: "Listen back",
    clippedTimes: "Clipped {count}×",
    saved: "Saved “{title}”",
    discarded: "Recording discarded",
    discardConfirm: "Discard this recording?",
    discardHint: "The take is thrown away; nothing is kept.",
  },

  // Listening: the microphone open, nothing kept — for setting a level.
  listen: {
    invite: "Check your level",
    inviteHint:
      "Hear the room and set your input before you record. Nothing is kept.",
    start: "Listen",
    stop: "Stop",
    title: "Listening",
    nothingKept: "— nothing is kept",
    room: "Room",
    peak: "Peak",
    headroom: "Headroom",
    verdict: {
      silent: "Nothing heard yet — is the right microphone on?",
      quiet: "Under the target — move closer, or raise the input",
      good: "Good level",
      loud: "Over the target — move back a little",
      hot: "Almost too loud — back off a little",
      clipping: "Too loud — move away from the sound source",
    },
  },

  // The take so far, under the meter while recording.
  stats: {
    peak: "Peak",
    clips: "Clips",
    size: "Size",
    left: "Room for",
  },

  // What the Record screen draws while listening and recording.
  visualizer: {
    label: "Visualizer",
    overview: "The whole take so far",
    wave: "Waveform",
    waveLabel:
      "Waveform of the last few seconds, with the target level, {low} to {high} dB, shaded across it",
    spectrum: "Spectrum",
    spectrogram: "Spectrogram",
    caption: {
      wave: "Waveform · aim for {low} to {high} dB",
      spectrum: "Spectrum · low to high",
      spectrogram: "Spectrogram · frequency over time",
    },
    hint: {
      wave: "The sound's shape scrolling by, on the meter's decibel scale, with the target level shaded across it: grey is under it, the accent is in it, amber is over it and red is too hot. The target is chosen on the Record screen's Quality sheet.",
      spectrum:
        "How loud each frequency is right now, from bass on the left to treble on the right.",
      spectrogram:
        "Frequencies over time, brighter where louder — hum, hiss and a voice's harmonics show as lines.",
    },
  },

  // The looks (`look.ts`): each of the framework's palettes, named for what
  // it feels like to work in rather than where it came from.
  look: {
    day: "By day",
    night: "By night",
    label: "Look",
    dayHint: "What the app wears while the device is light.",
    nightHint: "What the app wears while the device is dark.",
    dark: {
      studio: {
        name: "Studio",
        mood: "A quiet control room. Nothing competes with the sound.",
      },
      vinyl: {
        name: "Vinyl",
        mood: "Warm browns and amber, like a valve amp glowing.",
      },
      neon: {
        name: "Neon",
        mood: "City lights after midnight, blue and electric.",
      },
      velvet: {
        name: "Velvet",
        mood: "Stage curtains and a purple spotlight.",
      },
      dusk: {
        name: "Dusk",
        mood: "Rose and gold as the light goes down.",
      },
      fjord: {
        name: "Fjord",
        mood: "Cool northern blues, calm as still water.",
      },
      dreampop: {
        name: "Dream pop",
        mood: "Soft pastels on a night sky.",
      },
      lagoon: {
        name: "Lagoon",
        mood: "Deep teal and brass, like tape under water.",
      },
    },
    light: {
      studio: {
        name: "Studio",
        mood: "White walls and daylight. Clean and out of the way.",
      },
      paper: {
        name: "Paper",
        mood: "Cream stock and ink, like a songwriter's notebook.",
      },
      dawn: {
        name: "Dawn",
        mood: "Morning light on linen, soft and warm.",
      },
      watercolour: {
        name: "Watercolour",
        mood: "Pale washes and bright pigment.",
      },
    },
  },

  // The equalizer (`eq.ts`, `EqSheet.tsx`): a low cut and five bands named
  // for what they do, heard in the player and baked into an export, never
  // written into the recording.
  eq: {
    title: "Equalizer",
    caption: "EQ",
    custom: "Custom",
    curve: "The EQ's curve, from 20 Hz to 20 kHz",
    presets: "Starting points",
    knobs: "Bands",
    knobHint:
      "Drag up or down, or use the arrow keys. All the way down is off. Double-tap to put it back to 0.",
    lowCut: "Low cut",
    lowCutHint:
      "Takes out rumble under 80 Hz — traffic, handling, the air conditioning.",
    compare: "Compare",
    compareHint: "Hear it without the EQ while this is on.",
    reset: "Flat",
    db: "{value} dB",
    off: "Off",
    band: {
      bass: { name: "Bass", hz: "100 Hz", hint: "Weight and boom" },
      warmth: { name: "Warmth", hz: "300 Hz", hint: "Body — or mud" },
      mids: { name: "Mids", hz: "1 kHz", hint: "Honk and punch" },
      presence: {
        name: "Presence",
        hz: "3.5 kHz",
        hint: "How clearly words come through",
      },
      air: { name: "Air", hz: "10 kHz", hint: "Sparkle and breath" },
    },
    preset: {
      flat: "Flat",
      podcast: "Podcast",
      warm: "Warm",
      bright: "Bright",
      rumble: "No rumble",
      lofi: "Lo-fi",
    },
    forRecord:
      "New takes start with this EQ. It is kept beside each recording and never written into it, so it can be changed later in the player.",
    forRecording:
      "Heard here and baked into exports. The recording itself is not changed: Flat brings it back as it was.",
    player: "Equalizer: {name}",
    exportLine: "Through its EQ: {name}",
    monitor: {
      title: "Hear yourself through it",
      hint: "Put headphones on first. If it hears itself through a speaker, it stops.",
      start: "Monitor",
      stop: "Stop",
      starting: "Opening the microphone…",
      on: "Monitoring. Nothing is kept.",
      denied: "The microphone is blocked for this site.",
      failed: "The microphone could not be opened here.",
      feedback:
        "Stopped: it was hearing itself through the speaker. Put headphones on and start it again.",
    },
  },

  // The Quality sheet: how the next take is kept.
  quality: {
    title: "Quality",
    custom: "Custom",
    bitrate: "Bitrate, kbit/s",
    flac: "FLAC",
    perMinute: "≈{size}/min",
    preset: {
      memo: "Memo",
      standard: "Standard",
      high: "High",
      lossless: "Lossless",
    },
    presetHint: {
      memo: "Speech and reminders — the smallest files",
      standard: "Voices and interviews",
      high: "Music and rehearsals, near CD",
      lossless: "Every sample, as FLAC — for mixing and mastering",
    },
  },

  // The target level, on the Quality sheet: where a take's peaks should
  // land for what is being recorded (`target.ts`).
  target: {
    title: "Target level",
    hint: "Where the peaks should land, shaded on the waveform. Over −3 dB is always too hot.",
    range: "{low} to {high} dB",
    value: "{db} dB",
    preset: {
      voice: "Voice",
      music: "Music",
      live: "Loud",
      ambience: "Ambience",
      custom: "Custom",
    },
    presetHint: {
      voice:
        "Speech, interviews and memos — the meter's own good zone, with room for a laugh.",
      music:
        "Instruments and singing — a little hotter and steadier, the usual advice for tracking.",
      live: "Drums, a band, anything that jumps — more headroom for the hit you didn't see coming.",
      ambience:
        "A room, birdsong, a field recording — quiet by nature; turning it up only adds hiss.",
      custom: "Your own range.",
    },
    low: "Lowest peak",
    high: "Highest peak",
    lower: "Lower {edge}",
    raise: "Raise {edge}",
  },

  // The Recordings screen: the list, the search, the trash.
  library: {
    title: "Recordings",
    search: "Search",
    searchPlaceholder: "Search titles, notes and folders",
    searchHint: "Looks through every folder in this space.",
    scope: "Showing {scope} — change",
    all: "All recordings",
    favorites: "Favorites",
    trash: "Recently deleted",
    trashHint: "Kept for {days} days, then removed everywhere.",
    empty: "No recordings yet",
    emptyHint: "Press Record, and the first one lands here.",
    emptyFolder: "Nothing in this folder",
    emptySearch: "Nothing matches “{query}”",
    emptyTrash: "Nothing deleted recently",
    count: "{count} recordings",
    countOne: "1 recording",
    fetching: "Not on this device yet",
    favorite: "Favorite",
    unfavorite: "Remove from favorites",
    move: "Move to folder",
    export: "Export…",
    share: "Share the file",
    restore: "Put back",
    deleteForever: "Delete for good",
    deleteForeverConfirm: "Delete “{title}” for good?",
    deleteForeverHint:
      "It is removed from this device and from every synced copy.",
    deleted: "Moved to Recently deleted",
    restored: "Put back",
    space: "Space",
    spaces: "Spaces",
    sort: {
      newest: "Newest first",
      oldest: "Oldest first",
      title: "By title",
      longest: "Longest first",
    },
  },

  // The player sheet.
  player: {
    title: "Recording",
    play: "Play",
    pause: "Pause",
    skipBack: "Back {seconds} seconds",
    skipForward: "Forward {seconds} seconds",
    position: "Position",
    speed: "Speed",
    speedIs: "Speed {rate} — change",
    folder: "Folder: {folder} — move",
    notes: "Notes",
    notesPlaceholder: "Add a note",
    details: "Details",
    recorded: "Recorded",
    duration: "Length",
    size: "Size",
    format: "Format",
    sampleRate: "Sample rate",
    channels: "Channels",
    mono: "Mono",
    stereo: "Stereo",
    peak: "Loudest peak",
    clipped: "Clipped",
    clippedNone: "No clipping",
    clippedTimes: "{count} times",
    loading: "Loading the recording…",
    missing:
      "This recording's file is not on this device yet. It arrives with the next sync.",
    playFailed: "The recording could not be played: {reason}",
    rename: "Rename",
  },

  // The export sheet.
  export: {
    title: "Export",
    format: "Format",
    wav: "WAV",
    flac: "FLAC",
    mp3: "MP3",
    formatHint: {
      wav: "Uncompressed. Every program opens it; the largest file.",
      flac: "Lossless and about half the size of WAV.",
      mp3: "Small and plays everywhere; some of the sound is dropped.",
    },
    depth: "Bit depth",
    depthBits: "{bits}-bit",
    depthFloat: "32-bit float",
    level: "Compression",
    levelName: {
      "0": "Fast",
      "5": "Normal",
      "8": "Best",
    },
    bitrate: "Bitrate",
    kbps: "{kbps} kbit/s",
    rate: "Sample rate",
    rateKeep: "As recorded",
    mono: "Mono",
    monoHint:
      "Fold both channels into one. Half the file, and nothing a voice memo needs is lost.",
    run: "Export",
    outcome: "≈{size} · {rate} · {channels} {format}",
    working: "Encoding…",
    fetchingEncoder: "Fetching the MP3 encoder…",
    done: "Exported {file}",
    shared: "Shared {file}",
    original: "Share the original file",
    originalHint:
      "The take as the device kept it — {format}, no re-encoding and no EQ.",
  },

  // The folder picker: the library's scope, Move, and a take's destination.
  folders: {
    title: "Folders",
    show: "Show",
    menu: "More for {name}",
    create: "Create",
    inside: "Inside",
    deleted: "Folder deleted",
    add: "New folder",
    addIn: "New folder in “{name}”",
    name: "Name",
    namePlaceholder: "Folder name",
    rename: "Rename folder",
    move: "Move folder",
    moveTo: "Move to",
    top: "Top level",
    delete: "Delete folder",
    deleteConfirm: "Delete “{name}”?",
    deleteHint:
      "The recordings and folders inside it move up one level. No recording is deleted.",
    up: "Move up",
    down: "Move down",
  },

  spaces: {
    heading: "Spaces",
    blurb:
      "A space is a separate library with its own folders and its own file on a backend — Personal and Work, or one per client.",
    newAction: "New space",
    namePlaceholder: "Space name",
    nameLabel: "Name",
    create: "Create",
    nameRequired: "A space needs a name.",
    colorLabel: "Color",
    glyphLabel: "Symbol",
    glyphNone: "None",
    renameAction: "Rename",
    deleteAction: "Delete",
    deleteConfirm: "Forget “{name}” on this device?",
    switchTo: "Open {name}",
    defaultBadge: "Default",
    manage: "Manage spaces",
    current: "Space: {name}",
    expand: "Show spaces",
    collapse: "Hide spaces",
    personal: "Personal",
    forgot: "Space forgotten on this device",
    onBackend: "Spaces on {name}",
    onBackendHint:
      "Spaces another device keeps on the same backend. Open one to sync it here.",
    open: "Open",
  },

  settings: {
    title: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "Device",
    recording: "Record screen",
    recordingKind: "Keep a take as",
    recordingKindHint: {
      compact:
        "The device's own encoder, in the container it offers. Small files — a minute is under a megabyte.",
      lossless:
        "Every sample the microphone heard, as FLAC. About four megabytes a minute, and nothing lost.",
    },
    recordingBitrate: "Bitrate",
    voiceProcessing: "Voice processing",
    voiceProcessingHint:
      "Ask the device to cancel echo, suppress noise and level the volume, the way a call does. Off records what the microphone hears.",
    visualizer: "Visualizer",
    playback: "Playback",
    skipSeconds: "Skip buttons move",
    exportDefaults: "Export defaults",
    exportDefaultsHint:
      "What the export sheet starts on. Every export can change them.",
    spaces: "Spaces",
    spacesHint:
      "Separate libraries, each with its own folders and its own synced file.",
    manageSpaces: "Manage spaces",
    sync: "Storage",
    syncHint:
      "Off by default. Connect your own Dropbox, or a storage server you run yourself, to keep a copy there and sync between devices.",
    syncHintICloud:
      "Off by default. Keep a copy in your own iCloud, Dropbox or storage server to sync between devices.",
    backend: "Backend",
    connected: "Connected to {name}",
    localOnly: "Kept on this device only",
    saveNow: "Save now",
    reload: "Reload",
    disconnect: "Disconnect",
    files: "Recordings on {name}",
    filesIdle: "Every recording is on both sides.",
    filesRunning: "Moving recordings… {done} of {total}",
    filesLast: "Last sweep: {sent} sent, {fetched} fetched, {removed} removed",
    filesFailed: "{count} could not be moved — see the log",
    filesRun: "Sync recordings now",
    spacesOnBackend: "Spaces on the backend",
    listSpaces: "Look for spaces",
    noSpacesOnBackend: "No other spaces found.",
    data: "Your data",
    export: "Download the index",
    exportHint:
      "A JSON file naming every recording and folder in this space — the titles, the dates, the notes — without the audio.",
    import: "Restore an index",
    importHint:
      "Merges the file into what is here — the newer copy of each entry wins.",
    imported: "Restored {count} new entries",
    importFailed: `That file is not a ${APP_NAME} index.`,
    deleteAll: "Delete everything in this space",
    deleteAllHint:
      "Removes every recording and folder in this space from this device. A connected copy is not touched.",
    deleteAllConfirm: "Delete everything in this space on this device?",
    deleted: "Everything deleted",
    developer: "Developer",
    devMode: "Developer mode",
    devModeHint: "Show demo data, the log panel and the document size.",
    demoData: "Demo data",
    demoDataHint:
      "Swap in a library of invented recordings for this session. Nothing on this device or on a backend is touched; a reload restores your own.",
    demoDataOn: "Showing demo data",
    demoDataOff: "Back to your own recordings",
    captureLogs: "Capture console output",
    captureLogsHint: "Mirror console messages into the log panel below.",
    documentSize: "Document size",
    about: "About",
    version: "Version",
    build: "Build",
    privacy: `${APP_NAME} keeps your recordings on this device. Nothing is sent anywhere unless you connect your own cloud account or storage server, and then only there. The microphone is used only while you record, and the phone app's camera only when you tap Scan to read a pairing code; no picture is kept.`,
  },

  encryption: {
    headline: "Encrypt the copy",
    required: "The copy on {name} is always encrypted.",
    on: "The copy is encrypted with a passphrase remembered on this device.",
    checking: "Checking the copy on {name}…",
    paused: "Waiting for the passphrase",
    changedHint:
      "The passphrase was changed on another device. Enter the new one to carry on.",
    unreachable: "{name} could not be reached.",
    set: "Set a passphrase",
    unlockSubmit: "Unlock",
    change: "Change passphrase",
    retry: "Try again",
    createTitle: "Encrypt the copy",
    createHint:
      "The copy on {name} — the index and every recording — is sealed with this passphrase on this device before it leaves. Nobody, not the provider and not us, can open it without the passphrase.",
    unlockTitle: "Unlock the copy",
    unlockHint: "The copy on {name} is encrypted. Enter its passphrase.",
    changedTitle: "The passphrase changed",
    changeTitle: "Change the passphrase",
    changeHint: "The copy on {name} is re-sealed under the new passphrase.",
    noRecovery:
      "There is no way back without it: a forgotten passphrase leaves the copy on {name} unreadable. The recordings on this device are not affected.",
    passphrase: "Passphrase",
    confirm: "Confirm passphrase",
    createSubmit: "Encrypt",
    changeSubmit: "Change",
    tooShort: "At least {min} characters",
    mismatch: "The two passphrases differ",
    wrong: "That passphrase does not open the copy",
    offline: "{name} could not be reached — try again when online",
    failed: "Something went wrong",
    working: "Working…",
    off: "The copy is kept as it is; turn encryption on to seal it.",
  },

  sync: {
    syncedTo: "Synced to {name}",
  },

  selfHosted: {
    title: "Connect to your server",
    intro:
      "A storage server you run yourself — at home or on a host you choose. Your recordings are encrypted on this device before they leave it; the server only ever holds ciphertext.",
    codeLabel: "Pairing code",
    codeHint:
      "Make one in your server's admin console (Accounts → Pair device) or with storage-server pair, then scan its QR code with this phone's camera or paste the link here. A code from one of your other devices works too.",
    codeHintScan:
      "Make one in your server's admin console (Accounts → Pair device) or with storage-server pair, then tap Scan and point this phone at its QR code — or paste the link here. A code from one of your other devices works too.",
    scan: "Scan",
    scanHint: "Point the camera at the pairing code",
    scanDenied:
      "Camera access is off for this app. Allow it in Settings, or paste the code.",
    scanUnavailable: "The camera could not be opened. Paste the code instead.",
    scanInvalid: "That QR code is not a pairing code.",
    codePlaceholder: "oss-storage://pair?…",
    deviceLabel: "This device's name",
    connect: "Connect",
    codeEmpty: "Paste or scan a pairing code first.",
    codeInvite:
      "That is an invite to someone's shared space, not a pairing code for this device.",
    codeInvalid: "That is not a pairing code: {reason}",
    codeInvalidPlain: "That is not a pairing code.",
    pairing: "Pairing with {server}…",
    newAccountTitle: "Make your keys",
    newAccount: `This is the first device on this account. ${APP_NAME} will now make the encryption key for your recordings — here, on this device. The server never sees it.`,
    makeKeys: "Make my keys",
    recoveryTitle: "Your recovery key",
    recovery:
      "Write this down or store it in your password manager. It is the only way back to your recordings if you lose every device, and nobody — not the server, not us — can recover it for you.",
    copy: "Copy",
    copied: "Copied",
    savedIt: "I have stored my recovery key somewhere safe",
    done: "Done",
    existingTitle: "Get your keys",
    existing:
      "This account already has keys on another device. Approve this device there — Settings → Your server → Approve — and check it shows this code:",
    waiting: "Waiting for approval…",
    orRecovery: "Or type your recovery key",
    recoveryPlaceholder: "XXXX-XXXX-…",
    recover: "Use recovery key",
    recoverFailed: "That recovery key does not match this account.",
    server: "Server",
    addDevice: "Add a device",
    addDeviceTitle: "Add a device",
    addDeviceHint: `Scan this with your other phone's camera, or paste the link into ${APP_NAME} there. It works once, for {minutes} minutes, and carries your keys — show it only to your own devices.`,
    expires: "Expires in {time}",
    expired: "Expired — close and make a new one",
    approvals: "Waiting for approval",
    approvalsHint:
      "Approve only a device you are holding, and only if it shows the same code.",
    approve: "Approve",
    noApprovals: "No device is waiting.",
    checkApprovals: "Check for devices",
    newRecovery: "Make a new recovery key",
    newRecoveryConfirm: "Make a new recovery key?",
    newRecoveryHint:
      "The old one stops working. Store the new one before you close this.",
    unpair: "Unpair this device",
    unpairConfirm: "Unpair this device?",
    unpairHint:
      "Its keys are erased from this device, so it must be paired again to sync. Your recordings stay on this device and on the server.",
    unreachable: "Server unreachable — working on this device's copy",
    needsKeys: "Paired, waiting for this device's keys",
    finish: "Finish connecting",
  },

  // A new version: the toast, and About's check.
  update: {
    available: "A new version is ready",
    reload: "Reload",
    reloading: "Reloading…",
    check: "Check for updates",
    checking: "Checking…",
    upToDate: "This is the latest version",
    unavailable: "Updates can't be checked here",
    hint: "The app looks for a new version by itself and offers a reload when one has landed. Your recordings stay where they are.",
  },
} as const;

export type Catalog = typeof en;
