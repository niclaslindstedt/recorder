// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AUDIO ROUTES, Android side: which output the app's sound goes to, for
// the page's Microphone sheet.
//
// The microphone is not this module's. The WebView already lists the
// device's inputs to the page and opens the one the page asks for by
// `deviceId` — the phone's, a wired headset's, a Bluetooth headset's — so
// `routes()` leaves the inputs to the page (`null`), and all this module
// does for them is ask for the Bluetooth permission the WebView needs to
// list a Bluetooth headset at all, when the reader opens the sheet.
//
// The output is. While a page has the microphone open, the WebView puts the
// phone in communication mode, which is the call path: a Bluetooth headset
// goes onto its narrow call link (or loses the sound to the loudspeaker),
// and "record on the phone, listen on the headphones" is lost. With
// Bluetooth headphones chosen, this module takes the phone back out of
// communication mode whenever it is put in, so they play as media (A2DP)
// while the phone's microphone records. The loudspeaker, the earpiece and
// a wired or USB headset are communication devices, and are chosen as one.
//
// It prefers; it never holds. Nothing is touched until the page makes a
// choice, and Automatic hands everything back. Nothing here knows what a
// recording is.

package expo.modules.audioroute

import android.Manifest
import android.content.Context
import android.content.Intent
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.MediaRouter2
import android.os.Build
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Executor

/** The ids the page names in its own words (`src/app/audioHost.ts`). */
private const val SPEAKER = "speaker"
private const val EARPIECE = "earpiece"

class AudioRouteModule : Module() {
  /** The output the page chose; `null` is the system's own. */
  private var output: String? = null
  /** Whether this module has changed anything there is to hand back. */
  private var holding = false
  private var observing = false
  private val main = Handler(Looper.getMainLooper())
  private val onMain = Executor { main.post(it) }
  private var deviceCallback: AudioDeviceCallback? = null
  private var modeListener: AudioManager.OnModeChangedListener? = null

  private val context: Context?
    get() = appContext.reactContext

  private val audio: AudioManager?
    get() = context?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  override fun definition() = ModuleDefinition {
    Name("AudioRoute")

    Events("onRoutesChanged")

    OnCreate { watch() }

    OnDestroy { unwatch() }

    OnStartObserving("onRoutesChanged") { observing = true }

    OnStopObserving("onRoutesChanged") { observing = false }

    // `interactive`: the reader is looking at the choices, so the Bluetooth
    // permission may be asked for. Never otherwise — not at launch.
    AsyncFunction("routes") { interactive: Boolean?, promise: Promise ->
      if (interactive == true) {
        withBluetooth { promise.resolve(routes()) }
      } else {
        promise.resolve(routes())
      }
    }.runOnQueue(Queues.MAIN)

    // The WebView opens the microphone the page asks for by `deviceId`.
    AsyncFunction("setInput") { _: String? -> }

    AsyncFunction("setOutput") { id: String? ->
      output = id
      apply()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("showPicker") { showPicker() }.runOnQueue(Queues.MAIN)
  }

  // --- listing ----------------------------------------------------------------

  /** One output, as the page lists it: an id that outlives a reconnect (a
   *  Bluetooth device's address, not the system's per-connection id) and
   *  the name the device goes by. `null` for what is no place to listen. */
  private fun describe(device: AudioDeviceInfo): Pair<String, String>? {
    val name = device.productName?.toString().orEmpty()
    return when (device.type) {
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> SPEAKER to name
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> EARPIECE to name
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired" to name
      AudioDeviceInfo.TYPE_USB_HEADSET,
      AudioDeviceInfo.TYPE_USB_DEVICE -> "usb:$name" to name
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
      AudioDeviceInfo.TYPE_HEARING_AID,
      TYPE_BLE_HEADSET,
      TYPE_BLE_SPEAKER -> "bt:${device.address.ifEmpty { name }}" to name
      else -> null
    }
  }

  private fun routes(): Map<String, Any?> {
    val am = audio
    val outputs = mutableListOf<Map<String, String>>()
    val seen = mutableSetOf<String>()
    for (device in am?.getDevices(AudioManager.GET_DEVICES_OUTPUTS).orEmpty()) {
      val (id, name) = describe(device) ?: continue
      if (!seen.add(id)) continue
      outputs.add(mapOf("id" to id, "name" to name.ifEmpty { id }))
    }
    return mapOf(
      "inputs" to null,
      "outputs" to outputs,
      "inputNow" to null,
      "outputNow" to null,
      "picker" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R),
    )
  }

  // --- preferring -------------------------------------------------------------

  /** Make the output what was chosen. Called on a choice, again by the page
   *  around every opening of the microphone, and whenever the devices or
   *  the mode change under it. */
  private fun apply() {
    val am = audio ?: return
    val id = output
    if (id == null) {
      if (holding) release(am)
      return
    }
    holding = true
    if (id.startsWith("bt:")) {
      // Media, not a call: the headphones on A2DP, the microphone the
      // page's.
      if (am.mode == AudioManager.MODE_IN_COMMUNICATION) {
        clearCommunicationDevice(am)
        am.mode = AudioManager.MODE_NORMAL
      }
      return
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val device = am.availableCommunicationDevices.firstOrNull { describe(it)?.first == id }
      if (device != null && am.communicationDevice?.id != device.id) {
        am.setCommunicationDevice(device)
      }
    } else {
      @Suppress("DEPRECATION")
      am.isSpeakerphoneOn = id == SPEAKER
    }
  }

  /** Automatic again: hand back what was changed. */
  private fun release(am: AudioManager) {
    holding = false
    clearCommunicationDevice(am)
  }

  private fun clearCommunicationDevice(am: AudioManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      am.clearCommunicationDevice()
    } else {
      @Suppress("DEPRECATION")
      am.isSpeakerphoneOn = false
    }
  }

  private fun watch() {
    val am = audio ?: return
    val callback = object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>) = changed()

      override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) = changed()
    }
    am.registerAudioDeviceCallback(callback, main)
    deviceCallback = callback
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val listener = AudioManager.OnModeChangedListener { apply() }
      am.addOnModeChangedListener(onMain, listener)
      modeListener = listener
    }
  }

  private fun unwatch() {
    val am = audio ?: return
    deviceCallback?.let { am.unregisterAudioDeviceCallback(it) }
    deviceCallback = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      modeListener?.let { am.removeOnModeChangedListener(it) }
    }
    modeListener = null
    if (holding) release(am)
  }

  private fun changed() {
    apply()
    if (observing) sendEvent("onRoutesChanged")
  }

  // --- permission and picker ------------------------------------------------

  /** Run `then` once the WebView may see Bluetooth devices — asking first
   *  on Android 12 and later, where that is a runtime permission. Whatever
   *  the answer, `then` runs: without it the list is only shorter. */
  private fun withBluetooth(then: () -> Unit) {
    val permissions = appContext.permissions
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || permissions == null) {
      then()
      return
    }
    val bluetooth = Manifest.permission.BLUETOOTH_CONNECT
    if (permissions.hasGrantedPermissions(bluetooth)) {
      then()
      return
    }
    permissions.askForPermissions({ main.post { then() } }, bluetooth)
  }

  /** The system's own output switcher. */
  private fun showPicker(): Boolean {
    val ctx = context ?: return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      return MediaRouter2.getInstance(ctx).showSystemOutputSwitcher()
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      ctx.sendBroadcast(
        Intent("com.android.systemui.action.LAUNCH_MEDIA_OUTPUT_DIALOG")
          .setPackage("com.android.systemui")
          .putExtra("package_name", ctx.packageName),
      )
      return true
    }
    return false
  }

  private companion object {
    // Named here so the module builds against an SDK that predates them.
    const val TYPE_BLE_HEADSET = 26
    const val TYPE_BLE_SPEAKER = 27
  }
}
