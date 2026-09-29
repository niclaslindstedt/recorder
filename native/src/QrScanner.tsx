// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMERA, mounted only while the page waits on a scan (`App.tsx` renders
// it for one open request, see `scanQrBridge.ts`).
//
// It asks for the camera then — when the reader tapped Scan, never at launch —
// reads the first QR code it sees, and closes. No picture is taken and no
// frame is kept: the preview goes to the screen and only the decoded text goes
// back to the page. A refusal is answered as `denied` and not asked again; the
// page says what to do (Settings, or paste the code) in its own language.
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  scanLabel,
  type ScanQrAnswer,
  type ScanQrRequest,
} from "./scanQrBridge";

export function QrScanner({
  request,
  onAnswer,
}: {
  request: ScanQrRequest;
  onAnswer: (answer: ScanQrAnswer) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [done, setDone] = useState(false);
  const answered = useRef(false);
  const asked = useRef(false);

  // Exactly one answer, whichever way it ends. The camera reports the same
  // code many times a second, so every later call is dropped here.
  const finish = (answer: ScanQrAnswer) => {
    if (answered.current) return;
    answered.current = true;
    setDone(true); // unmounts the camera before the page hears back
    onAnswer(answer);
  };

  // Ask once, now that the reader asked to scan.
  useEffect(() => {
    if (!permission || permission.granted || asked.current) return;
    asked.current = true;
    if (!permission.canAskAgain) {
      finish({ ok: false, reason: "denied" });
      return;
    }
    requestPermission().then(
      (response) => {
        if (!response.granted) finish({ ok: false, reason: "denied" });
      },
      () => finish({ ok: false, reason: "unavailable" }),
    );
  });

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => finish({ ok: true, text: null })}
    >
      <View style={styles.fill}>
        {permission?.granted && !done ? (
          <CameraView
            style={styles.fill}
            facing="back"
            animateShutter={false}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => finish({ ok: true, text: data })}
            onMountError={({ message }) =>
              finish({ ok: false, reason: "unavailable", error: message })
            }
          />
        ) : null}
        <SafeAreaView edges={["bottom"]} style={styles.bar}>
          <Text style={styles.hint}>
            {scanLabel(request, "hint", "Point the camera at the code")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => finish({ ok: true, text: null })}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          >
            <Text style={styles.buttonLabel}>
              {scanLabel(request, "cancel", "Cancel")}
            </Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  hint: { color: "#fff", fontSize: 15, marginBottom: 12, textAlign: "center" },
  button: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  pressed: { opacity: 0.8 },
  buttonLabel: { color: "#141a26", fontSize: 16, fontWeight: "600" },
});
