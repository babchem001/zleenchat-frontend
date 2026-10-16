import React, { forwardRef, useMemo } from "react";
import { Text, TouchableOpacity, StyleSheet, View } from "react-native";

import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";

import { Ionicons } from "@expo/vector-icons";

type Props = {
  onPhoto: () => void;
  onVideo: () => void;
  onAudio: () => void;
  onDocument: () => void;
};

const AttachmentBottomSheet = forwardRef<BottomSheet, Props>(
  ({ onPhoto, onVideo, onAudio, onDocument }, ref) => {
    const snapPoints = useMemo(() => ["58%"], []);

    const closeSheet = () => {
      if (ref && typeof ref !== "function" && ref.current) {
        ref.current.close();
      }
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="attach-outline" size={23} color="#4F46E5" />
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Send attachment</Text>

              <Text style={styles.subtitle}>
                Choose what you want to share.
              </Text>
            </View>
          </View>

          {/* Attachment Options */}
          <View style={styles.optionsContainer}>
            {/* Photo */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.option}
              onPress={onPhoto}
            >
              <View style={[styles.iconContainer, styles.photoIconContainer]}>
                <Ionicons name="image-outline" size={22} color="#4F46E5" />
              </View>

              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Photo</Text>

                <Text style={styles.optionSubtitle}>
                  Share a photo from your device
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={19} color="#A1A1AA" />
            </TouchableOpacity>

            {/* Video */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.option}
              onPress={onVideo}
            >
              <View style={[styles.iconContainer, styles.videoIconContainer]}>
                <Ionicons name="videocam-outline" size={22} color="#7C3AED" />
              </View>

              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Video</Text>

                <Text style={styles.optionSubtitle}>
                  Share a video from your device
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={19} color="#A1A1AA" />
            </TouchableOpacity>

            {/* Audio */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.option}
              onPress={onAudio}
            >
              <View style={[styles.iconContainer, styles.audioIconContainer]}>
                <Ionicons
                  name="musical-notes-outline"
                  size={22}
                  color="#DB2777"
                />
              </View>

              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Audio</Text>

                <Text style={styles.optionSubtitle}>Share an audio file</Text>
              </View>

              <Ionicons name="chevron-forward" size={19} color="#A1A1AA" />
            </TouchableOpacity>

            {/* Document */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.option}
              onPress={onDocument}
            >
              <View
                style={[styles.iconContainer, styles.documentIconContainer]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={22}
                  color="#0891B2"
                />
              </View>

              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Document</Text>

                <Text style={styles.optionSubtitle}>
                  Share a document or file
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={19} color="#A1A1AA" />
            </TouchableOpacity>
          </View>

          {/* Cancel */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.cancelButton}
            onPress={closeSheet}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

AttachmentBottomSheet.displayName = "AttachmentBottomSheet";

export default AttachmentBottomSheet;

const styles = StyleSheet.create({
  background: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  handleIndicator: {
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#D4D4D8",
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },

  /* Header */

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 22,
  },

  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    marginRight: 13,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#18181B",
    letterSpacing: -0.2,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#71717A",
  },

  /* Options */

  optionsContainer: {
    backgroundColor: "#F8F8FA",
    borderRadius: 18,
    overflow: "hidden",
  },

  option: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginRight: 13,
  },

  photoIconContainer: {
    backgroundColor: "#EEF2FF",
  },

  videoIconContainer: {
    backgroundColor: "#F5F3FF",
  },

  audioIconContainer: {
    backgroundColor: "#FDF2F8",
  },

  documentIconContainer: {
    backgroundColor: "#ECFEFF",
  },

  optionTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  optionTitle: {
    fontSize: 15.5,
    fontWeight: "600",
    color: "#18181B",
  },

  optionSubtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 17,
    color: "#71717A",
  },

  /* Cancel */

  cancelButton: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F5",
    marginTop: 14,
  },

  cancelText: {
    fontSize: 15.5,
    fontWeight: "600",
    color: "#3F3F46",
  },
});
