import { API_BASE_URL } from "@/src/services/api/apiClient";
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  TextInput,
  Modal,
  StatusBar,
  ScrollView,
} from "react-native";

import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";

import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getToken } from "@/src/services/storage/tokenService";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type Profile = {
  id: number;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
};

type FeedbackState = {
  visible: boolean;
  type: FeedbackType;
  title: string;
  message: string;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState("");

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageModal, setImageModal] = useState(false);

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

  /*
   * Close feedback modal.
   */
  const closeFeedback = () => {
    setFeedback((current) => ({
      ...current,
      visible: false,
    }));
  };

  const fetchProfile = useCallback(async () => {
    try {
      const token = await getToken();

      const res = await fetch(`${API_BASE_URL}/profile/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      setProfile(data);
      setBio(data.bio || "");
    } catch (error) {
      console.log("Profile fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  /*
   * Update Bio.
   */
  const handleUpdateBio = async () => {
    try {
      const token = await getToken();

      const response = await fetch(`${API_BASE_URL}/profile/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({ bio }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(errorData?.message || "Unable to update your bio.");
      }

      await fetchProfile();

      showFeedback(
        "success",
        "Bio Updated",
        "Your profile bio has been updated successfully.",
      );
    } catch (error: any) {
      console.log("Bio update error:", error);

      showFeedback(
        "error",
        "Update Failed",
        error?.message || "Unable to update your bio. Please try again.",
      );
    }
  };

  /*
   * Pick image.
   */
  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showFeedback(
          "warning",
          "Permission Required",
          "Please allow access to your photos so you can select a profile picture.",
        );

        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Image picker error:", error);

      showFeedback(
        "error",
        "Unable to Select Photo",
        "Something went wrong while opening your photo library. Please try again.",
      );
    }
  };

  /*
   * Upload avatar.
   */
  const confirmUpload = async () => {
    if (!selectedImage) return;

    try {
      setUploading(true);

      const token = await getToken();

      const formData = new FormData();

      formData.append("avatar", {
        uri: selectedImage,
        name: "avatar.jpg",
        type: "image/jpeg",
      } as any);

      const endpoint = profile?.avatarUrl
        ? "/profile/update-avatar"
        : "/profile/upload-avatar";

      const method = profile?.avatarUrl ? "PUT" : "POST";

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(
          errorData?.message || "Unable to update your profile photo.",
        );
      }

      setSelectedImage(null);

      await fetchProfile();

      showFeedback(
        "success",
        "Photo Updated",
        "Your profile photo has been updated successfully.",
      );
    } catch (error: any) {
      console.log("Upload avatar error:", error);

      showFeedback(
        "error",
        "Upload Failed",
        error?.message ||
          "Unable to update your profile photo. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  /*
   * Delete avatar.
   */
  const deleteAvatar = async () => {
    try {
      const token = await getToken();

      const response = await fetch(`${API_BASE_URL}/profile/delete-avatar`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(
          errorData?.message || "Unable to remove your profile photo.",
        );
      }

      await fetchProfile();

      showFeedback(
        "success",
        "Photo Removed",
        "Your profile photo has been removed successfully.",
      );
    } catch (error: any) {
      console.log("Delete avatar error:", error);

      showFeedback(
        "error",
        "Unable to Remove Photo",
        error?.message ||
          "Unable to remove your profile photo. Please try again.",
      );
    }
  };

  /*
   * Download Image.
   */
  const downloadImage = async () => {
    if (!profile?.avatarUrl) return;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== "granted") {
        showFeedback(
          "warning",
          "Permission Required",
          "Please allow media access in your device settings to save this image.",
        );

        return;
      }

      const fileUrl = `${API_BASE_URL}${profile.avatarUrl}`;

      const fileUri = (FileSystem as any).documentDirectory + "avatar.jpg";

      const downloadResult = await FileSystem.downloadAsync(fileUrl, fileUri);

      const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);

      await MediaLibrary.createAlbumAsync("Download", asset, false);

      showFeedback(
        "success",
        "Image Saved",
        "The profile photo has been saved to your gallery.",
      );
    } catch (error) {
      console.log("Download error:", error);

      showFeedback(
        "error",
        "Download Failed",
        "Unable to download the image. Please try again.",
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <ActivityIndicator size="large" color="#2563EB" />

        <AppFeedbackModal
          visible={feedback.visible}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={closeFeedback}
        />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <Ionicons name="person-circle-outline" size={72} color="#2563EB" />

        <Text style={styles.emptyTitle}>Profile unavailable</Text>

        <Text style={styles.emptySubtitle}>
          We couldn&apos;t load your profile.
        </Text>

        <AppFeedbackModal
          visible={feedback.visible}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={closeFeedback}
        />
      </View>
    );
  }

  const fullName = `${profile.user.firstName} ${profile.user.lastName}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Decorative Background */}

      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      {/* Settings */}

      <TouchableOpacity
        style={styles.settingsButton}
        activeOpacity={0.85}
        onPress={() => router.push("/profile/settings" as any)}
      >
        <Ionicons name="settings-outline" size={22} color="#0B1545" />
      </TouchableOpacity>

      {/* Scroll Content */}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}

        <View style={styles.avatarSection}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setImageModal(true)}
            style={styles.avatarWrapper}
          >
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.avatar} />
            ) : profile.avatarUrl ? (
              <Image
                source={{
                  uri: `${API_BASE_URL}${profile.avatarUrl}`,
                }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {profile.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.cameraButton} onPress={pickImage}>
              <Ionicons name="camera" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </TouchableOpacity>

          <Text style={styles.name}>{fullName}</Text>

          <Text style={styles.username}>@{profile.username}</Text>
        </View>

        {/* Email */}
        {profile?.user?.email ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Email</Text>
            <Text style={styles.cardValue}>{profile.user.email}</Text>
          </View>
        ) : null}

        {/* About */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>About</Text>

          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Write something..."
            placeholderTextColor="#94A3B8"
            multiline
            style={styles.bioInput}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={handleUpdateBio}
          >
            <Text style={styles.primaryButtonText}>
              {profile.bio ? "Update Bio" : "Save Bio"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Avatar Actions */}

        {(selectedImage || profile.avatarUrl) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Photo</Text>

            {selectedImage && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={confirmUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save Photo</Text>
                )}
              </TouchableOpacity>
            )}

            {profile.avatarUrl && (
              <TouchableOpacity
                style={styles.secondaryDangerButton}
                onPress={deleteAvatar}
              >
                <Text style={styles.secondaryDangerText}>Delete Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* Image Preview */}

      <Modal visible={imageModal} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setImageModal(false)}
          >
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.fullImage} />
          ) : profile.avatarUrl ? (
            <Image
              source={{
                uri: `${API_BASE_URL}${profile.avatarUrl}`,
              }}
              style={styles.fullImage}
            />
          ) : null}

          {profile.avatarUrl && (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={downloadImage}
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />

              <Text style={styles.downloadText}>Download</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* Global Screen Feedback */}

      <AppFeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        onClose={closeFeedback}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 30,
  },

  /* Decorative Background */

  topBlob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#E9EEFF",
    top: -90,
    left: -120,
  },

  bottomBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#EEE8FF",
    bottom: -80,
    right: -100,
  },

  topGlow: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(37,99,235,0.04)",
    top: 140,
    alignSelf: "center",
  },

  bottomGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(124,58,237,0.04)",
    bottom: 100,
    alignSelf: "center",
  },

  /* Settings */

  settingsButton: {
    position: "absolute",
    top: 46,
    right: 22,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,

    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 4,
  },

  /* Content */

  content: {
    paddingTop: 70,
    paddingHorizontal: 22,
    paddingBottom: 120,
  },

  /* Avatar */

  avatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },

  avatarWrapper: {
    position: "relative",
  },

  avatar: {
    width: 118,
    height: 118,
    borderRadius: 59,
  },

  avatarPlaceholder: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarPlaceholderText: {
    fontSize: 40,
    fontWeight: "700",
    color: "#2563EB",
  },

  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,

    width: 36,
    height: 36,
    borderRadius: 18,

    backgroundColor: "#2563EB",

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 3,
    borderColor: "#FFFFFF",
  },

  name: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
  },

  username: {
    marginTop: 4,
    fontSize: 15,
    color: "#69708A",
    textAlign: "center",
  },

  /* Cards */

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,

    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 3,
  },

  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#69708A",
    marginBottom: 8,
  },

  cardValue: {
    fontSize: 16,
    color: "#0B1545",
    lineHeight: 24,
  },

  bioInput: {
    minHeight: 90,
    borderRadius: 16,
    backgroundColor: "#F7F9FC",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#0B1545",
    fontSize: 15,
    textAlignVertical: "top",
  },

  /* Buttons */

  primaryButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },

  secondaryDangerButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFF1F2",
    justifyContent: "center",
    alignItems: "center",
  },

  secondaryDangerText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 15,
  },

  /* Empty */

  emptyTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "700",
    color: "#0B1545",
    textAlign: "center",
  },

  emptySubtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#69708A",
    textAlign: "center",
    lineHeight: 22,
  },

  /* Modal */

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalClose: {
    position: "absolute",
    top: 60,
    right: 24,
    zIndex: 10,
  },

  fullImage: {
    width: "90%",
    height: "70%",
    resizeMode: "contain",
  },

  downloadButton: {
    marginTop: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 16,
  },

  downloadText: {
    marginLeft: 8,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
