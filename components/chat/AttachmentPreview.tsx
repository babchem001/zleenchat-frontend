import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  attachment: any;
  onRemove: () => void;
};

export default function AttachmentPreview({ attachment, onRemove }: Props) {
  const isImage = attachment?.mimeType?.startsWith("image");
  const isVideo = attachment?.mimeType?.startsWith("video");
  const isAudio = attachment?.mimeType?.startsWith("audio");
  const isFile = attachment?.contentType === "FILE";

  return (
    <View style={styles.container}>
      {isImage && (
        <View style={styles.mediaPreviewContainer}>
          <Image
            source={{
              uri: attachment.uri,
            }}
            style={styles.image}
            contentFit="cover"
          />
        </View>
      )}

      {isVideo && (
        <View style={styles.mediaPreviewContainer}>
          <Image
            source={{
              uri: attachment.thumbnailUri || attachment.uri,
            }}
            style={styles.video}
            contentFit="cover"
          />

          <View style={styles.videoOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={22} color="#FFFFFF" />
            </View>
          </View>
        </View>
      )}

      {isAudio && (
        <View style={styles.fileContainer}>
          <View style={[styles.fileIcon, styles.audioIconContainer]}>
            <Ionicons name="musical-notes-outline" size={23} color="#DB2777" />
          </View>

          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {attachment.name || "Audio file"}
            </Text>

            <Text style={styles.fileType}>Audio</Text>
          </View>
        </View>
      )}

      {isFile && (
        <View style={styles.fileContainer}>
          {attachment.thumbnailUri ? (
            <Image
              source={{
                uri: attachment.thumbnailUri,
              }}
              style={styles.documentThumbnail}
              contentFit="contain"
            />
          ) : (
            <View style={[styles.fileIcon, styles.documentIconContainer]}>
              <Ionicons
                name="document-text-outline"
                size={23}
                color="#0891B2"
              />
            </View>
          )}

          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {attachment.name || "Document"}
            </Text>

            <Text style={styles.fileType}>
              {attachment.contentType || "Document"}
            </Text>
          </View>
        </View>
      )}

      {attachment.uploadStatus && (
        <View style={styles.statusContainer}>
          <View style={styles.statusDot} />

          <Text style={styles.processingStatus}>{attachment.uploadStatus}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Remove attachment"
      >
        <Ionicons name="close" size={18} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 10,
    marginBottom: 8,
    padding: 10,
    borderRadius: 18,

    // Subtle elevation for Android
    elevation: 2,

    // Subtle shadow for iOS
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },

  mediaPreviewContainer: {
    width: 105,
    height: 105,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F4F4F5",
  },

  image: {
    width: "100%",
    height: "100%",
  },

  video: {
    width: "100%",
    height: "100%",
  },

  videoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },

  playButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(24, 24, 27, 0.78)",
    paddingLeft: 2,
  },

  fileContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingRight: 42,
  },

  fileIcon: {
    width: 54,
    height: 54,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  audioIconContainer: {
    backgroundColor: "#FDF2F8",
  },

  documentIconContainer: {
    backgroundColor: "#ECFEFF",
  },

  documentThumbnail: {
    width: 54,
    height: 54,
    borderRadius: 12,
    marginRight: 13,
    backgroundColor: "#F4F4F5",
  },

  fileInfo: {
    flex: 1,
    justifyContent: "center",
  },

  fileName: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#18181B",
  },

  fileType: {
    marginTop: 4,
    fontSize: 12.5,
    color: "#71717A",
  },

  statusContainer: {
    position: "absolute",
    left: 10,
    bottom: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4F46E5",
    marginRight: 5,
  },

  processingStatus: {
    fontSize: 11.5,
    color: "#52525B",
    fontWeight: "500",
  },

  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#18181B",
  },
});
