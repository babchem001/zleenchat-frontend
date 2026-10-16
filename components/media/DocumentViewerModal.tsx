import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import * as IntentLauncher from "expo-intent-launcher";
import * as FileSystem from "expo-file-system/legacy";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type Props = {
  visible: boolean;
  documentUri: string;
  fileName?: string;
  onClose: () => void;
};

type FeedbackState = {
  visible: boolean;
  type: FeedbackType;
  title: string;
  message: string;
};

export default function DocumentViewerModal({
  visible,
  documentUri,
  fileName,
  onClose,
}: Props) {
  const [feedback, setFeedback] = useState<FeedbackState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
    });
  };

  const closeFeedback = () => {
    setFeedback((current) => ({
      ...current,
      visible: false,
    }));
  };

  const openDocument = async () => {
    try {
      if (!documentUri) {
        showFeedback(
          "error",
          "Document Not Found",
          "The document could not be found.",
        );
        return;
      }

      const fileInfo = await FileSystem.getInfoAsync(documentUri);

      if (!fileInfo.exists) {
        showFeedback(
          "error",
          "Document Unavailable",
          "This document no longer exists on your device.",
        );
        return;
      }

      if (Platform.OS === "android") {
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: documentUri,
          flags: 1,
          type: "application/pdf",
        });

        return;
      }

      showFeedback(
        "info",
        "Unsupported",
        "Document viewing on iOS will be added separately.",
      );
    } catch (error) {
      console.log("OPEN DOCUMENT ERROR:", error);

      showFeedback(
        "error",
        "Unable to Open Document",
        "Something went wrong while trying to open this document.",
      );
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
      >
        <View style={styles.container}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.icon}>📄</Text>

          <Text style={styles.fileName}>{fileName || "Document"}</Text>

          <TouchableOpacity
            style={styles.openButton}
            onPress={openDocument}
            activeOpacity={0.85}
          >
            <Text style={styles.openButtonText}>Open Document</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <AppFeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        buttonText="OK"
        onClose={closeFeedback}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },

  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
  },

  closeText: {
    fontSize: 28,
    fontWeight: "700",
  },

  icon: {
    fontSize: 72,
    marginBottom: 20,
  },

  fileName: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 30,
  },

  openButton: {
    backgroundColor: "#25D366",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },

  openButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
