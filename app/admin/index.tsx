import { API_BASE_URL } from "@/src/services/api/apiClient";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useEffect, useState, useCallback } from "react";
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "@/src/store/auth/authStorage";
import { useSocket } from "@/hooks/useSocket";
import {
  getMyProfile,
  uploadAvatar,
  updateAvatar,
  type Profile,
} from "@/src/services/profile/profileService";
import {
  getSystemStatus,
  getDashboardStats,
  getRecentActivities,
  type SystemStatus,
  type DashboardStats,
  type RecentActivity,
} from "@/src/services/admin/adminService";
import AdminBackground from "@/src/components/admin/AdminBackground";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const { socketRef, connected } = useSocket();

  const firstName = user?.firstName || "Admin";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [avatarActionVisible, setAvatarActionVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemStatusLoading, setSystemStatusLoading] = useState(true);
  const [systemStatusError, setSystemStatusError] = useState(false);

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(
    null,
  );
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(true);
  const [dashboardStatsError, setDashboardStatsError] = useState(false);

  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(
    [],
  );
  const [recentActivitiesLoading, setRecentActivitiesLoading] = useState(true);
  const [recentActivitiesError, setRecentActivitiesError] = useState(false);

  const [feedback, setFeedback] = useState<{
    visible: boolean;
    type: FeedbackType;
    title: string;
    message: string;
  }>({
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

  const loadSystemStatus = useCallback(async () => {
    try {
      setSystemStatusLoading(true);
      setSystemStatusError(false);

      const data = await getSystemStatus();

      setSystemStatus(data);
    } catch (error) {
      console.log("Admin system status fetch error:", error);

      setSystemStatus(null);
      setSystemStatusError(true);
    } finally {
      setSystemStatusLoading(false);
    }
  }, []);

  /* =========================
     LOAD DASHBOARD STATS
  ========================== */

  const loadDashboardStats = useCallback(async () => {
    try {
      setDashboardStatsLoading(true);
      setDashboardStatsError(false);

      const data = await getDashboardStats();

      setDashboardStats(data);
    } catch (error) {
      console.log("Admin dashboard stats fetch error:", error);

      setDashboardStats(null);
      setDashboardStatsError(true);
    } finally {
      setDashboardStatsLoading(false);
    }
  }, []);

  /* =========================
     LOAD RECENT ACTIVITIES
  ========================== */

  const loadRecentActivities = useCallback(async () => {
    try {
      setRecentActivitiesLoading(true);
      setRecentActivitiesError(false);

      const data = await getRecentActivities();

      setRecentActivities(data);
    } catch (error) {
      console.log("Recent activities fetch error:", error);

      setRecentActivities([]);
      setRecentActivitiesError(true);
    } finally {
      setRecentActivitiesLoading(false);
    }
  }, []);

  /* =========================
     REAL-TIME UPDATES
  ========================== */

  useEffect(() => {
    if (!connected) {
      return;
    }

    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    const handleDashboardStatsUpdated = () => {
      loadDashboardStats();
      loadRecentActivities();
    };

    socket.on("adminDashboardStatsUpdated", handleDashboardStatsUpdated);

    return () => {
      socket.off("adminDashboardStatsUpdated", handleDashboardStatsUpdated);
    };
  }, [connected, socketRef, loadDashboardStats, loadRecentActivities]);

  /* =========================
     LOAD ADMIN PROFILE
  ========================== */

  const loadAdminProfile = async () => {
    try {
      setProfileLoading(true);

      const data = await getMyProfile();

      setProfile(data);
    } catch (error) {
      console.log("Admin profile fetch error:", error);
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    loadAdminProfile();
  }, []);

  /* =========================
     SCREEN FOCUS
  ========================== */

  useFocusEffect(
    useCallback(() => {
      loadSystemStatus();
      loadDashboardStats();
      loadRecentActivities();
    }, [loadSystemStatus, loadDashboardStats, loadRecentActivities]),
  );

  /* =========================
     AVATAR ACTIONS
  ========================== */

  const pickFromGallery = async () => {
    setAvatarActionVisible(false);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      showFeedback(
        "warning",
        "Permission required",
        "Please allow photo library access to choose a profile picture.",
      );

      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    setSelectedImage(asset.uri);

    await handleAvatarUpload(asset);
  };

  const takePhoto = async () => {
    setAvatarActionVisible(false);

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      showFeedback(
        "warning",
        "Permission required",
        "Please allow camera access to take a profile picture.",
      );

      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    setSelectedImage(asset.uri);

    await handleAvatarUpload(asset);
  };

  const handleAvatarUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setUploadingAvatar(true);

      const file = {
        uri: asset.uri,
        fileName: asset.fileName || "avatar.jpg",
        type: asset.mimeType || "image/jpeg",
      };

      const response = profile?.avatarUrl
        ? await updateAvatar(file)
        : await uploadAvatar(file);

      if (!response) {
        throw new Error("Avatar upload failed");
      }

      setSelectedImage(null);

      await loadAdminProfile();

      showFeedback(
        "success",
        "Success",
        "Profile picture updated successfully.",
      );
    } catch (error) {
      console.log("Admin avatar upload error:", error);

      showFeedback(
        "error",
        "Upload failed",
        "We couldn't update your profile picture. Please try again.",
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarPress = () => {
    setAvatarActionVisible(true);
  };

  /* =========================
     ACTIVITY HELPERS
  ========================== */

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "USER_REGISTERED":
        return "person-add-outline";

      case "GROUP_CREATED":
      case "GROUP_UPDATED":
        return "people-outline";

      case "INVITATION_CODE_GENERATED":
        return "ticket-outline";

      case "SETTINGS_UPDATED":
        return "settings-outline";

      default:
        return "ellipse-outline";
    }
  };

  const getActivityIconColor = (type: string) => {
    switch (type) {
      case "USER_REGISTERED":
        return "#2563EB";

      case "GROUP_CREATED":
      case "GROUP_UPDATED":
        return "#16B364";

      case "INVITATION_CODE_GENERATED":
        return "#2563EB";

      case "SETTINGS_UPDATED":
        return "#7C3AED";

      default:
        return "#667085";
    }
  };

  /* =========================
     SYSTEM STATUS HELPERS
  ========================== */

  const getSystemStatusTitle = () => {
    if (systemStatusLoading) {
      return "Checking system status...";
    }

    if (systemStatusError) {
      return "Unable to check system status";
    }

    switch (systemStatus?.status) {
      case "healthy":
        return "Everything is running smoothly";

      case "degraded":
        return "Some services are experiencing problems";

      case "unhealthy":
        return "The system is currently unavailable";

      default:
        return "System status unavailable";
    }
  };

  const getSystemStatusLabel = () => {
    if (systemStatusLoading) {
      return "Checking";
    }

    if (systemStatusError) {
      return "Unavailable";
    }

    switch (systemStatus?.status) {
      case "healthy":
        return "Operational";

      case "degraded":
        return "Degraded";

      case "unhealthy":
        return "Offline";

      default:
        return "Unknown";
    }
  };

  const getSystemStatusColor = () => {
    if (systemStatusLoading) {
      return "#98A2B3";
    }

    if (systemStatusError) {
      return "#F04438";
    }

    switch (systemStatus?.status) {
      case "healthy":
        return "#16C784";

      case "degraded":
        return "#F79009";

      case "unhealthy":
        return "#F04438";

      default:
        return "#98A2B3";
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AdminBackground>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {/* =========================
              HEADER
          ========================== */}

          <View style={styles.header}>
            <View style={styles.headerAvatarContainer}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleAvatarPress}
                disabled={uploadingAvatar}
                style={styles.avatarTouchable}
              >
                {profile?.avatarUrl ? (
                  <Image
                    source={{
                      uri: profile.avatarUrl.startsWith("http")
                        ? profile.avatarUrl
                        : `${API_BASE_URL}${profile.avatarUrl}`,
                    }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={34} color="#7A8299" />
                  </View>
                )}

                {uploadingAvatar && (
                  <View style={styles.avatarUploadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>

              <View style={styles.onlineIndicator} />
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Admin Dashboard</Text>

              <View style={styles.headerWelcomeRow}>
                <Text style={styles.headerSubtitle}>Welcome back, Admin</Text>

                <View style={styles.firstNamePill}>
                  <Text style={styles.firstNamePillText}>{firstName}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* =========================
              SYSTEM STATUS
          ========================== */}

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.systemStatusCard}
            onPress={() => router.push("/admin/system-status" as any)}
          >
            <View
              style={[
                styles.statusIconContainer,
                {
                  backgroundColor: systemStatusError
                    ? "#F04438"
                    : systemStatus?.status === "degraded"
                      ? "#F79009"
                      : systemStatus?.status === "unhealthy"
                        ? "#F04438"
                        : "#5865F2",
                },
              ]}
            >
              {systemStatusLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={
                    systemStatusError
                      ? "alert-circle-outline"
                      : systemStatus?.status === "healthy"
                        ? "shield-checkmark-outline"
                        : systemStatus?.status === "degraded"
                          ? "warning-outline"
                          : "close-circle-outline"
                  }
                  size={30}
                  color="#FFFFFF"
                />
              )}
            </View>

            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>System Status</Text>

              <Text style={styles.statusSubtitle}>
                {getSystemStatusTitle()}
              </Text>
            </View>

            <View style={styles.liveContainer}>
              <View
                style={[
                  styles.liveDot,
                  {
                    backgroundColor: getSystemStatusColor(),
                  },
                ]}
              />

              <Text style={styles.liveText}>{getSystemStatusLabel()}</Text>
            </View>
          </TouchableOpacity>

          {/* =========================
              OVERVIEW
          ========================== */}

          <Text style={styles.sectionTitle}>Overview</Text>

          <View style={styles.overviewRow}>
            <View style={styles.overviewCard}>
              <View style={styles.overviewIconBlue}>
                <Ionicons name="people-outline" size={25} color="#5865F2" />
              </View>

              <View style={styles.overviewInfo}>
                <Text style={styles.overviewNumber}>
                  {dashboardStatsLoading
                    ? "—"
                    : dashboardStatsError
                      ? "—"
                      : (dashboardStats?.totalUsers ?? 0).toLocaleString()}
                </Text>

                <Text style={styles.overviewLabel}>Total Users</Text>

                {!dashboardStatsLoading &&
                  !dashboardStatsError &&
                  dashboardStats !== null &&
                  dashboardStats.usersGrowthPercent !== null && (
                    <View style={styles.growthRow}>
                      <Ionicons
                        name={
                          dashboardStats.usersGrowthPercent >= 0
                            ? "arrow-up"
                            : "arrow-down"
                        }
                        size={14}
                        color={
                          dashboardStats.usersGrowthPercent >= 0
                            ? "#16B364"
                            : "#F04438"
                        }
                      />

                      <Text
                        style={[
                          styles.growthText,
                          {
                            color:
                              dashboardStats.usersGrowthPercent >= 0
                                ? "#16B364"
                                : "#F04438",
                          },
                        ]}
                      >
                        {Math.abs(dashboardStats.usersGrowthPercent).toFixed(1)}
                        %
                      </Text>
                    </View>
                  )}

                {!dashboardStatsLoading && !dashboardStatsError && (
                  <Text style={styles.growthCaption}>vs last 7 days</Text>
                )}
              </View>
            </View>

            <View style={styles.overviewCard}>
              <View style={styles.overviewIconGreen}>
                <Ionicons name="people-outline" size={25} color="#16B364" />
              </View>

              <View style={styles.overviewInfo}>
                <Text style={styles.overviewNumber}>
                  {dashboardStatsLoading
                    ? "—"
                    : dashboardStatsError
                      ? "—"
                      : (dashboardStats?.totalGroups ?? 0).toLocaleString()}
                </Text>

                <Text style={styles.overviewLabel}>Groups</Text>

                {!dashboardStatsLoading &&
                  !dashboardStatsError &&
                  dashboardStats !== null &&
                  dashboardStats.groupsGrowthPercent !== null && (
                    <View style={styles.growthRow}>
                      <Ionicons
                        name={
                          dashboardStats.groupsGrowthPercent >= 0
                            ? "arrow-up"
                            : "arrow-down"
                        }
                        size={14}
                        color={
                          dashboardStats.groupsGrowthPercent >= 0
                            ? "#16B364"
                            : "#F04438"
                        }
                      />

                      <Text
                        style={[
                          styles.growthText,
                          {
                            color:
                              dashboardStats.groupsGrowthPercent >= 0
                                ? "#16B364"
                                : "#F04438",
                          },
                        ]}
                      >
                        {Math.abs(dashboardStats.groupsGrowthPercent).toFixed(
                          1,
                        )}
                        %
                      </Text>
                    </View>
                  )}

                {!dashboardStatsLoading && !dashboardStatsError && (
                  <Text style={styles.growthCaption}>vs last 7 days</Text>
                )}
              </View>
            </View>
          </View>

          {/* =========================
              QUICK ACTIONS
          ========================== */}

          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.quickActionCard}
              onPress={() => router.push("/admin/invitations")}
            >
              <View style={styles.quickIconBlue}>
                <Ionicons name="ticket-outline" size={30} color="#2563EB" />
              </View>

              <Text style={styles.quickActionTitle}>Invitation Codes</Text>

              <Text style={styles.quickActionSubtitle}>
                Generate, manage codes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.quickActionCard}
              onPress={() => router.push("/admin/groups")}
            >
              <View style={styles.quickIconGreen}>
                <Ionicons name="people-outline" size={30} color="#16B364" />
              </View>

              <Text style={styles.quickActionTitle}>Groups</Text>

              <Text style={styles.quickActionSubtitle}>Monitor all groups</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.quickActionCard}
              onPress={() => router.push("/admin/settings")}
            >
              <View style={styles.quickIconPurple}>
                <Ionicons name="settings-outline" size={30} color="#7C3AED" />
              </View>

              <Text style={styles.quickActionTitle}>Settings</Text>

              <Text style={styles.quickActionSubtitle}>Admin settings</Text>
            </TouchableOpacity>
          </View>

          {/* =========================
              RECENT ACTIVITY
          ========================== */}

          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitleActivity}>Recent Activity</Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                // Activity route will be added when
                // the full Recent Activity screen is implemented.
              }}
            >
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityCard}>
            {recentActivitiesLoading ? (
              <View style={styles.activityStateContainer}>
                <ActivityIndicator size="small" color="#5865F2" />

                <Text style={styles.activityStateText}>
                  Loading recent activity...
                </Text>
              </View>
            ) : recentActivitiesError ? (
              <View style={styles.activityStateContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color="#F04438"
                />

                <Text style={styles.activityStateText}>
                  Unable to load recent activity
                </Text>

                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.activityRetryButton}
                  onPress={loadRecentActivities}
                >
                  <Text style={styles.activityRetryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : recentActivities.length === 0 ? (
              <View style={styles.activityStateContainer}>
                <Ionicons name="time-outline" size={28} color="#98A2B3" />

                <Text style={styles.activityStateText}>
                  No recent activity yet
                </Text>
              </View>
            ) : (
              recentActivities.map((activity, index) => (
                <TouchableOpacity
                  key={activity.id}
                  activeOpacity={0.8}
                  style={[
                    styles.activityRow,
                    index !== recentActivities.length - 1 &&
                      styles.activityRowBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.activityIconContainer,
                      {
                        backgroundColor:
                          activity.type === "GROUP_CREATED" ||
                          activity.type === "GROUP_UPDATED"
                            ? "#EFFAF4"
                            : activity.type === "INVITATION_CODE_GENERATED"
                              ? "#EEF4FF"
                              : activity.type === "SETTINGS_UPDATED"
                                ? "#F3EEFF"
                                : "#EEF4FF",
                      },
                    ]}
                  >
                    <Ionicons
                      name={getActivityIcon(activity.type) as any}
                      size={24}
                      color={getActivityIconColor(activity.type)}
                    />
                  </View>

                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>

                    <Text style={styles.activitySubtitle} numberOfLines={1}>
                      {activity.subtitle}
                    </Text>
                  </View>

                  <View style={styles.activityRight}>
                    <Text style={styles.activityTime}>
                      {activity.createdAt}
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#71809A"
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {/* =========================
            AVATAR ACTION SHEET
        ========================== */}

        <Modal
          visible={avatarActionVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAvatarActionVisible(false)}
        >
          <View style={styles.actionModalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setAvatarActionVisible(false)}
            />

            <View style={styles.actionSheet}>
              <View style={styles.actionSheetHandle} />

              <Text style={styles.actionSheetTitle}>Profile Photo</Text>

              {profile?.avatarUrl && (
                <TouchableOpacity
                  style={styles.actionItem}
                  activeOpacity={0.8}
                  onPress={() => {
                    setAvatarActionVisible(false);
                    setImageViewerVisible(true);
                  }}
                >
                  <View style={styles.actionIconBlue}>
                    <Ionicons name="eye-outline" size={22} color="#2563EB" />
                  </View>

                  <View style={styles.actionItemTextContainer}>
                    <Text style={styles.actionItemTitle}>View Photo</Text>

                    <Text style={styles.actionItemSubtitle}>
                      View your current profile picture
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionItem}
                activeOpacity={0.8}
                onPress={takePhoto}
              >
                <View style={styles.actionIconBlue}>
                  <Ionicons name="camera-outline" size={22} color="#2563EB" />
                </View>

                <View style={styles.actionItemTextContainer}>
                  <Text style={styles.actionItemTitle}>Take Photo</Text>

                  <Text style={styles.actionItemSubtitle}>Use your camera</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                activeOpacity={0.8}
                onPress={pickFromGallery}
              >
                <View style={styles.actionIconPurple}>
                  <Ionicons name="images-outline" size={22} color="#7C3AED" />
                </View>

                <View style={styles.actionItemTextContainer}>
                  <Text style={styles.actionItemTitle}>
                    Choose from Gallery
                  </Text>

                  <Text style={styles.actionItemSubtitle}>
                    Select a photo from your device
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelAction}
                activeOpacity={0.8}
                onPress={() => setAvatarActionVisible(false)}
              >
                <Text style={styles.cancelActionText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* =========================
            IMAGE VIEWER
        ========================== */}

        <Modal
          visible={imageViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageViewerVisible(false)}
        >
          <View style={styles.imageViewer}>
            <TouchableOpacity
              style={styles.imageViewerClose}
              onPress={() => setImageViewerVisible(false)}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>

            {profile?.avatarUrl && (
              <Image
                source={{
                  uri: profile.avatarUrl.startsWith("http")
                    ? profile.avatarUrl
                    : `${API_BASE_URL}${profile.avatarUrl}`,
                }}
                style={styles.fullAvatarImage}
              />
            )}
          </View>
        </Modal>

        {/* =========================
            APP FEEDBACK MODAL
        ========================== */}

        <AppFeedbackModal
          visible={feedback.visible}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={closeFeedback}
        />
      </AdminBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 32,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },

  headerAvatarContainer: {
    width: 96,
    height: 78,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },

  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#F2F4F8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },

  onlineIndicator: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 7,
    backgroundColor: "#16C784",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    right: 10,
    bottom: 4,
    marginRight: 6,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0B1545",
    letterSpacing: -0.8,
  },

  headerSubtitle: {
    marginBottom: 3,
    fontSize: 15,
    color: "#5E6785",
  },

  headerWelcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  },

  firstNamePill: {
    marginLeft: 7,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#DCE7FF",
  },

  firstNamePillText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2563EB",
  },

  systemStatusCard: {
    minHeight: 100,
    borderRadius: 28,
    backgroundColor: "#F0F2FF",
    borderWidth: 1,
    borderColor: "#E1E5FF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    marginTop: 25,
  },

  statusIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "#5865F2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 20,
  },

  statusTextContainer: {
    flex: 1,
  },

  statusTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B1545",
  },

  statusSubtitle: {
    marginTop: 5,
    fontSize: 12,
    color: "#5E6785",
    lineHeight: 23,
  },

  liveContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },

  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#16C784",
    marginRight: 5,
  },

  liveText: {
    fontSize: 14,
    color: "#5E6785",
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0B1545",
    marginTop: 20,
  },

  overviewRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 15,
  },

  overviewCard: {
    flex: 1,
    height: 120,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EDF0F7",
    paddingHorizontal: 14,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#1A4FFF",
    shadowOpacity: 0.045,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 7,
    },

    elevation: 3,
  },

  overviewIconBlue: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "#F0F1FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },

  overviewIconGreen: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: "#EFFAF4",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    flexShrink: 0,
  },

  overviewInfo: {
    flex: 1,
    minWidth: 0,
  },

  overviewNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B1545",
    letterSpacing: -0.7,
  },

  overviewLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
    color: "#5E6785",
  },

  growthRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  growthText: {
    marginLeft: 3,
    fontSize: 12,
    fontWeight: "700",
  },

  growthCaption: {
    marginTop: 1,
    fontSize: 10,
    color: "#69758F",
  },

  quickActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 40,
  },

  quickActionCard: {
    flex: 1,
    marginTop: 15,
    minHeight: 100,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9EDF5",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 18,

    shadowColor: "#1A4FFF",
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 3,
  },

  quickIconBlue: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  quickIconGreen: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#EFFAF4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  quickIconPurple: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#F3EEFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },

  quickActionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
    lineHeight: 21,
  },

  quickActionSubtitle: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 15,
    color: "#65718C",
    textAlign: "center",
  },

  activityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  sectionTitleActivity: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0B1545",
  },

  viewAll: {
    fontSize: 17,
    fontWeight: "600",
    color: "#2563EB",
  },

  activityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#E9EDF5",
    overflow: "hidden",

    shadowColor: "#1A4FFF",
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 3,
  },

  activityRow: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F6",
  },

  activityAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F2F4F8",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  activityOnlineDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#16C784",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    right: -1,
    bottom: 0,
  },

  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    marginRight: 12,
  },

  activityContent: {
    flex: 1,
    minWidth: 0,
  },

  activityTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1545",
  },

  activitySubtitle: {
    marginTop: 5,
    fontSize: 13,
    color: "#69758F",
  },

  activityRight: {
    alignItems: "flex-end",
    justifyContent: "center",
    marginLeft: 6,
  },

  activityTime: {
    fontSize: 13,
    color: "#69758F",
    marginBottom: 5,
  },

  avatarTouchable: {
    position: "relative",
  },

  avatarUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 34,
    backgroundColor: "rgba(11,21,69,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  actionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,21,69,0.35)",
    justifyContent: "flex-end",
  },

  actionSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
  },

  actionSheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D9DEE8",
    alignSelf: "center",
    marginBottom: 20,
  },

  actionSheetTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0B1545",
    marginBottom: 16,
  },

  actionItem: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },

  actionIconBlue: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  actionIconPurple: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F3EEFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  actionItemTextContainer: {
    flex: 1,
  },

  actionItemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B1545",
  },

  actionItemSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#69758F",
  },

  cancelAction: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F4F6FA",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },

  cancelActionText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#5E6785",
  },

  imageViewer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    justifyContent: "center",
    alignItems: "center",
  },

  imageViewerClose: {
    position: "absolute",
    top: 58,
    right: 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  fullAvatarImage: {
    width: "90%",
    height: "70%",
    resizeMode: "contain",
  },

  overviewErrorText: {
    fontSize: 30,
    fontWeight: "700",
    color: "#98A2B3",
  },

  activityStateContainer: {
    minHeight: 180,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  activityStateText: {
    marginTop: 12,
    fontSize: 14,
    color: "#69758F",
    textAlign: "center",
  },

  activityRetryButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#EEF4FF",
  },

  activityRetryText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2563EB",
  },
});
