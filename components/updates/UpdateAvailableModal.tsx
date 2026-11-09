import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppUpdate } from "@/src/services/appUpdateService";

type Props = {
  visible: boolean;
  update: AppUpdate | null;
  downloading: boolean;
  downloadProgress: number;
  downloadError: string | null;
  onLater: () => void;
  onUpdate: () => void;
};

export default function UpdateAvailableModal({
  visible,
  update,
  downloading,
  downloadProgress,
  downloadError,
  onLater,
  onUpdate,
}: Props) {
  if (!update) {
    return null;
  }

  const canDismiss = !update.required && !downloading;
  const percent = Math.round(downloadProgress * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (canDismiss) {
          onLater();
        }
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          disabled={!canDismiss}
          onPress={onLater}
        />

        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="cloud-download-outline" size={34} color="#2563EB" />
          </View>

          <Text style={styles.title}>
            {update.required ? "Update Required" : "Zleenchat Update Available"}
          </Text>

          <Text style={styles.version}>Version {update.version}</Text>

          <Text style={styles.message}>
            {update.required
              ? "Install this update to continue using Zleenchat."
              : "A newer version of Zleenchat is available with improvements, new features, and bug fixes."}
          </Text>

          {!!update.releaseNotes && (
            <Text style={styles.releaseNotes} numberOfLines={6}>
              {update.releaseNotes}
            </Text>
          )}

          <Text style={styles.installNote}>
            Android will open its installer. Android may ask you to allow app
            installations from Zleenchat.
          </Text>

          {downloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.max(percent, 2)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {percent > 0 ? `Downloading ${percent}%` : "Preparing download"}
              </Text>
              {percent === 0 && (
                <ActivityIndicator size="small" color="#2563EB" />
              )}
            </View>
          )}

          {!!downloadError && (
            <Text style={styles.errorText}>{downloadError}</Text>
          )}

          <View style={styles.buttons}>
            {!update.required && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={onLater}
                disabled={downloading}
                activeOpacity={0.8}
              >
                <Text style={styles.laterText}>Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.updateButton,
                update.required && styles.requiredButton,
                downloading && styles.disabledButton,
              ]}
              onPress={onUpdate}
              disabled={downloading}
              activeOpacity={0.85}
            >
              <Text style={styles.updateText}>
                {downloading
                  ? "Downloading..."
                  : downloadError
                    ? "Try again"
                    : "Update now"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(11, 21, 69, 0.58)",
  },
  card: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "85%",
    borderRadius: 26,
    padding: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    elevation: 18,
  },
  icon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    color: "#0B1545",
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },
  version: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
  },
  message: {
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 14,
  },
  releaseNotes: {
    alignSelf: "stretch",
    color: "#44506D",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
  },
  installNote: {
    color: "#667085",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 14,
  },
  progressContainer: {
    alignSelf: "stretch",
    marginTop: 18,
  },
  progressTrack: {
    height: 7,
    borderRadius: 5,
    backgroundColor: "#E7ECF5",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  progressText: {
    color: "#44506D",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  errorText: {
    color: "#B42318",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 12,
  },
  buttons: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  laterButton: {
    minHeight: 48,
    flex: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F6FB",
  },
  laterText: {
    color: "#44506D",
    fontWeight: "700",
  },
  updateButton: {
    minHeight: 48,
    flex: 1,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  requiredButton: {
    flex: 1,
  },
  disabledButton: {
    opacity: 0.65,
  },
  updateText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
