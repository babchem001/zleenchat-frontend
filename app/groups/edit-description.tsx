import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import {
  getGroupDetails,
  updateGroupDescription,
} from "@/src/services/group/groupService";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

export default function EditDescriptionScreen() {
  const { groupId } = useLocalSearchParams<{
    groupId: string;
  }>();

  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    title: string;
    message: string;
  }>({
    type: "info",
    title: "",
    message: "",
  });

  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedback({
      type,
      title,
      message,
    });

    setFeedbackVisible(true);
  };

  const closeFeedback = () => {
    setFeedbackVisible(false);
  };

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    try {
      if (!groupId) {
        return;
      }

      const group = await getGroupDetails(Number(groupId));

      setDescription(group.description || "");
    } catch (error) {
      console.log("Failed to load group description:", error);
    }
  };

  const handleSave = async () => {
    if (!groupId || saving) {
      return;
    }

    try {
      setSaving(true);

      await updateGroupDescription(Number(groupId), description.trim());

      router.back();
    } catch (error) {
      console.log("Failed to update group description:", error);

      showFeedback(
        "error",
        "Update Failed",
        "Unable to update the group description. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const characterCount = description.length;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

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
          >
            <Ionicons name="arrow-back" size={25} color="#0B1545" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Group description</Text>

          {/* Keeps the title visually centered. */}
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Add group description</Text>

          <View style={styles.inputCard}>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Write a description for your group..."
              placeholderTextColor="#7B8198"
              multiline
              maxLength={200}
              textAlignVertical="top"
              style={styles.input}
            />

            <Text style={styles.characterCount}>{characterCount}/200</Text>
          </View>

          <Text style={styles.note}>
            The group description is visible to all members.
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={saving}
            onPress={handleSave}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        buttonText="OK"
        onClose={closeFeedback}
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

    width: 230,
    height: 230,

    borderRadius: 115,

    backgroundColor: "#EAF0FF",

    top: 175,
    left: -145,

    opacity: 0.9,
  },

  blobTopRight: {
    position: "absolute",

    width: 220,
    height: 220,

    borderRadius: 110,

    backgroundColor: "#F0EAFF",

    top: 330,
    right: -130,

    opacity: 0.82,
  },

  blobBottomLeft: {
    position: "absolute",

    width: 245,
    height: 245,

    borderRadius: 123,

    backgroundColor: "#EEF3FF",

    bottom: 55,
    left: -155,

    opacity: 0.85,
  },

  blobBottomRight: {
    position: "absolute",

    width: 205,
    height: 205,

    borderRadius: 103,

    backgroundColor: "#F2ECFF",

    bottom: 25,
    right: -115,

    opacity: 0.8,
  },

  header: {
    height: 86,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    paddingHorizontal: 22,

    backgroundColor: "#FFFFFF",
  },

  backButton: {
    width: 48,
    height: 48,

    borderRadius: 16,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E8ECF7",

    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 3,
  },

  headerTitle: {
    flex: 1,

    marginHorizontal: 16,

    textAlign: "center",

    fontSize: 24,
    fontWeight: "700",

    color: "#0B1545",
  },

  headerSpacer: {
    width: 48,
  },

  content: {
    flex: 1,

    paddingHorizontal: 24,
    paddingTop: 42,
  },

  sectionTitle: {
    marginLeft: 6,
    marginBottom: 18,

    fontSize: 22,
    fontWeight: "600",

    color: "#20285A",
  },

  inputCard: {
    minHeight: 320,

    borderRadius: 26,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,
    borderColor: "#E3E7F2",

    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,

    shadowColor: "#182B75",
    shadowOpacity: 0.08,
    shadowRadius: 14,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 4,
  },

  input: {
    flex: 1,

    minHeight: 240,

    padding: 0,

    fontSize: 17,

    lineHeight: 25,

    color: "#0B1545",
  },

  characterCount: {
    alignSelf: "flex-end",

    marginTop: 8,

    fontSize: 14,
    fontWeight: "500",

    color: "#A3AAC0",
  },

  note: {
    marginTop: 22,
    marginHorizontal: 2,

    fontSize: 15,

    lineHeight: 22,

    color: "#737B96",
  },

  saveButton: {
    height: 62,
    marginTop: 36,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 4,
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
