// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIO ROUTES, Apple side: which microphone and which output the app's
// audio session prefers, for the page's Microphone sheet.
//
// The page records through WebKit, and WebKit owns the session's category:
// it switches to play-and-record when the microphone opens, with Bluetooth
// microphones allowed. That is why a phone with AirPods in records from the
// AirPods and plays to them over the call link (HFP), narrow and quiet — and
// why "record on the phone, listen on the headphones" is not something a
// page can ask for. This module asks for it. With the phone's own
// microphone (or a wired or USB one) chosen it takes Bluetooth microphones
// out of the session's options, so the headphones stay on the full-quality
// link (A2DP) and the phone listens; with a headset's microphone chosen, or
// Automatic, it leaves them in.
//
// It prefers; it never takes the session over. Nothing is touched until the
// page makes a choice, the category is never changed to anything but what
// WebKit already chose (only its options), and the session is never
// activated from here — WebKit activates it when the microphone opens, and a
// session activated from here would stop another app's music at a moment
// nobody pressed anything. Every time the route changes — WebKit opening the
// microphone, a headset connecting — the choice is put back.
//
// Nothing here knows what a recording is. It lists ports, prefers one, and
// says when they change.

import AVFoundation
import AVKit
import ExpoModulesCore
import UIKit

/// The id the page sends for the phone's own loudspeaker, which iOS lists
/// as a port only while the sound is on it. The page names it in its own
/// words (`src/app/audioHost.ts`).
private let SPEAKER = "speaker"

public class AudioRouteModule: Module {
  /// The input and output the page chose; `nil` is the system's own.
  private var input: String?
  private var output: String?
  /// Whether the page has chosen anything at all. Until it has, the
  /// session is never touched.
  private var chosen = false
  /// Bluetooth microphones seen, by name. While the phone's microphone is
  /// chosen, iOS stops listing a headset's microphone at all; this is how
  /// it is still offered, and found again when it is chosen.
  private var headsetMics: [String: String] = [:]
  /// Outputs seen, by uid, so a headset is still listed while the sound is
  /// forced to the loudspeaker (which takes it out of the route).
  private var seenOutputs: [(uid: String, name: String)] = []
  /// The inputs as last listed. Outside play-and-record the session may
  /// list none at all, and the microphones have not gone anywhere.
  private var lastInputs: [[String: String]] = []
  private var speakerName = "Speaker"
  private var observers: [NSObjectProtocol] = []
  private var observing = false
  private var picker: AVRoutePickerView?
  /// Every session call is made on this one queue, so a route change and a
  /// choice from the page never interleave.
  private let queue = DispatchQueue(label: "recorder.audio-route")

  public func definition() -> ModuleDefinition {
    Name("AudioRoute")

    Events("onRoutesChanged")

    OnCreate {
      self.watch()
    }

    OnDestroy {
      for observer in self.observers {
        NotificationCenter.default.removeObserver(observer)
      }
      self.observers = []
    }

    OnStartObserving("onRoutesChanged") {
      self.observing = true
    }

    OnStopObserving("onRoutesChanged") {
      self.observing = false
    }

    AsyncFunction("routes") { (_: Bool?) -> [String: Any?] in
      self.routes()
    }.runOnQueue(queue)

    AsyncFunction("setInput") { (id: String?) in
      self.chosen = true
      self.input = id
      try self.apply()
    }.runOnQueue(queue)

    AsyncFunction("setOutput") { (id: String?) in
      self.chosen = true
      self.output = id
      try self.apply()
    }.runOnQueue(queue)

    AsyncFunction("showPicker") { () -> Bool in
      self.showPicker()
    }.runOnQueue(.main)
  }

  // MARK: - listing

  private func routes() -> [String: Any?] {
    let session = AVAudioSession.sharedInstance()
    let route = session.currentRoute

    var inputs: [[String: String]] = []
    for port in session.availableInputs ?? [] {
      if isBluetoothMic(port.portType) { headsetMics[port.portName] = port.uid }
      inputs.append(["id": port.uid, "name": port.portName])
    }
    if inputs.isEmpty { inputs = lastInputs } else { lastInputs = inputs }
    // A headset playing over A2DP whose microphone is out of the options:
    // offered under the uid it had when it was listed.
    for port in route.outputs where port.portType == .bluetoothA2DP {
      if let uid = headsetMics[port.portName],
        !inputs.contains(where: { $0["id"] == uid })
      {
        inputs.append(["id": uid, "name": port.portName])
      }
    }

    var outputs: [[String: String]] = []
    for port in route.outputs {
      if port.portType == .builtInSpeaker {
        speakerName = port.portName
        continue
      }
      if port.portType == .builtInReceiver { continue }
      remember(port)
      outputs.append(["id": port.uid, "name": port.portName])
    }
    // Forced to the loudspeaker, the headphones are out of the route; they
    // are still where the reader may want the sound back.
    if output == SPEAKER {
      for seen in seenOutputs where !outputs.contains(where: { $0["id"] == seen.uid }) {
        outputs.append(["id": seen.uid, "name": seen.name])
      }
    }
    outputs.append(["id": SPEAKER, "name": speakerName])

    return [
      "inputs": inputs,
      "outputs": outputs,
      "inputNow": route.inputs.first?.portName,
      "outputNow": route.outputs.first?.portName,
      "picker": true,
    ]
  }

  private func remember(_ port: AVAudioSessionPortDescription) {
    seenOutputs.removeAll { $0.uid == port.uid }
    seenOutputs.insert((uid: port.uid, name: port.portName), at: 0)
    if seenOutputs.count > 8 { seenOutputs.removeLast() }
  }

  private func isBluetoothMic(_ type: AVAudioSession.Port) -> Bool {
    type == .bluetoothHFP || type == .bluetoothLE
  }

  // MARK: - preferring

  /// The options the session should carry: WebKit's, with Bluetooth
  /// microphones taken out when a microphone that is not a headset's is
  /// chosen — which is what keeps Bluetooth headphones on A2DP.
  private func options(for session: AVAudioSession) -> AVAudioSession.CategoryOptions {
    var options = session.categoryOptions
    options.insert(.allowBluetoothA2DP)
    if let id = input, !headsetMics.values.contains(id) {
      options.remove(.allowBluetooth)
    } else {
      options.insert(.allowBluetooth)
    }
    if output == SPEAKER { options.insert(.defaultToSpeaker) }
    return options
  }

  /// Put the choice back. Only while the microphone is open — the one
  /// category where an input can be preferred or the loudspeaker forced —
  /// and only what differs, so the route change this causes settles at
  /// once.
  private func apply() throws {
    guard chosen else { return }
    let session = AVAudioSession.sharedInstance()
    guard session.category == .playAndRecord else { return }

    let wanted = options(for: session)
    if session.categoryOptions != wanted {
      try session.setCategory(.playAndRecord, mode: session.mode, options: wanted)
    }

    let port = input.flatMap { id in
      session.availableInputs?.first { $0.uid == id }
    }
    if session.preferredInput?.uid != port?.uid {
      try session.setPreferredInput(port)
    }

    let speaker = session.currentRoute.outputs.contains { $0.portType == .builtInSpeaker }
    if output == SPEAKER && !speaker {
      try session.overrideOutputAudioPort(.speaker)
    } else if output != SPEAKER && output != nil && speaker {
      try session.overrideOutputAudioPort(.none)
    }
  }

  private func watch() {
    let center = NotificationCenter.default
    let changed: (Notification) -> Void = { [weak self] _ in
      guard let self else { return }
      self.queue.async {
        try? self.apply()
        if self.observing { self.sendEvent("onRoutesChanged") }
      }
    }
    observers.append(
      center.addObserver(
        forName: AVAudioSession.routeChangeNotification, object: nil, queue: nil,
        using: changed))
    observers.append(
      center.addObserver(
        forName: AVAudioSession.mediaServicesWereResetNotification, object: nil,
        queue: nil, using: changed))
  }

  // MARK: - the system's picker

  /// The system's own output menu — AirPlay and every Bluetooth device —
  /// opened as though its button had been pressed. Kept in the window,
  /// invisible, because the menu is presented from it.
  private func showPicker() -> Bool {
    guard
      let window = UIApplication.shared.connectedScenes
        .compactMap({ ($0 as? UIWindowScene)?.keyWindow }).first
    else { return false }
    let view = picker ?? AVRoutePickerView(frame: CGRect(x: 0, y: 0, width: 1, height: 1))
    view.alpha = 0.011
    if view.superview !== window { window.addSubview(view) }
    picker = view
    guard let button = view.subviews.compactMap({ $0 as? UIButton }).first else {
      return false
    }
    button.sendActions(for: .touchUpInside)
    return true
  }
}
