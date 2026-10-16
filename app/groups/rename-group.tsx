import { useState } from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { renameGroup } from "@/src/services/group/groupService";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

export default function RenameGroupScreen() {
  const { groupId } = useLocalSearchParams<{
    groupId: string;
  }>();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [navigateBackOnClose, setNavigateBackOnClose] = useState(false);

  const showFeedback = (
    type: FeedbackType,
    title: string,
    message: string,
    shouldNavigateBack = false,
  ) => {
    setFeedbackType(type);
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setNavigateBackOnClose(shouldNavigateBack);
    setFeedbackVisible(true);
  };

  const handleCloseFeedback = () => {
    setFeedbackVisible(false);

    if (navigateBackOnClose) {
      setNavigateBackOnClose(false);
      router.back();
    }
  };

  const handleRename = async () => {
    const trimmed = name.trim();

    if (!trimmed) {
      showFeedback(
        "warning",
        "Group Name Required",
        "Group name cannot be empty.",
      );
      return;
    }

    try {
      setLoading(true);

      await renameGroup(Number(groupId), trimmed);

      showFeedback(
        "success",
        "Group Renamed",
        "The group name has been updated successfully.",
        true,
      );
    } catch (error) {
      console.log("Rename group error:", error);

      showFeedback(
        "error",
        "Rename Failed",
        "Unable to rename the group. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      <View pointerEvents="none" style={styles.blobTopLeft} />
      <View pointerEvents="none" style={styles.blobTopRight} />
      <View pointerEvents="none" style={styles.blobBottomLeft} />
      <View pointerEvents="none" style={styles.blobBottomRight} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={25} color="#0B1545" />
          </TouchableOpacity>

          <Text style={styles.title}>Rename Group</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter new group name"
              placeholderTextColor="#7A849B"
              style={styles.input}
              maxLength={50}
              autoCapitalize="sentences"
              autoCorrect
              returnKeyType="done"
              onSubmitEditing={handleRename}
              editable={!loading}
            />

            <Text style={styles.characterCount}>{name.length}/50</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.88}
            disabled={loading}
            onPress={handleRename}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>
              {loading ? "Renaming..." : "Rename Group"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        buttonText="OK"
        onClose={handleCloseFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboardContainer: {
    flex: 1,
  },

  blobTopLeft: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#E9EEFF",
    top: 160,
    left: -130,
    opacity: 0.9,
  },

  blobTopRight: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#EEE8FF",
    top: 160,
    right: -100,
    opacity: 0.82,
  },

  blobBottomLeft: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "#EEF4FF",
    bottom: 30,
    left: -150,
    opacity: 0.85,
  },

  blobBottomRight: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#F1ECFF",
    bottom: 35,
    right: -105,
    opacity: 0.8,
  },

  header: {
    height: 92,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    backgroundColor: "transparent",
  },

  backButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#2563EB",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  title: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: 14,
    fontSize: 28,
    fontWeight: "700",
    color: "#0B1545",
    letterSpacing: -0.4,
  },

  headerSpacer: {
    width: 48,
  },

  formContainer: {
    paddingHorizontal: 24,
    paddingTop: 50,
  },

  inputContainer: {
    minHeight: 134,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E5EA",
    borderRadius: 22,
    shadowColor: "#0B1545",
    shadowOpacity: 0.035,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
    position: "relative",
  },

  input: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 42,
    fontSize: 17,
    fontWeight: "500",
    color: "#0B1545",
  },

  characterCount: {
    position: "absolute",
    right: 20,
    bottom: 18,
    fontSize: 14,
    fontWeight: "500",
    color: "#7A849B",
  },

  button: {
    height: 64,
    marginTop: 26,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 4,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
});
