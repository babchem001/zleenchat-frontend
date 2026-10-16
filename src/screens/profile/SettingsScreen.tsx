import { API_BASE_URL } from "@/src/services/api/apiClient";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Modal,
  TextInput,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getToken } from "@/src/services/storage/tokenService";
import { requestAccountDeletion } from "@/src/services/auth/authService";
import { useAuthStore } from "@/src/store/auth/authStorage";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type Settings = {
  allowDMFromAnyone: boolean;
  allowUplineDM: boolean;
  allowUplineView: boolean;
  publicProfileVisible: boolean;
  hideEmail: boolean;
};

type FeedbackState = {
  visible: boolean;
  type: FeedbackType;
  title: string;
  message: string;
};

export default function MySettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Reuse the application's existing authentication store so the account deletion flow uses the same logout/token-clearing mechanism as the rest of the application.
  const logout = useAuthStore((state) => state.logout);
  const [logoutConfirmationVisible, setLogoutConfirmationVisible] =
    useState(false);

  const [logoutSubmitting, setLogoutSubmitting] = useState(false);

  // Detailed account-deletion warning/consequences modal.
  const [deletionWarningVisible, setDeletionWarningVisible] = useState(false);

  // Existing password re-authentication step.
  const [deletionModalVisible, setDeletionModalVisible] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState("");
  const [deletionSubmitting, setDeletionSubmitting] = useState(false);

  // Keeps the successful deletion state visible until the user continues to the existing login screen.
  const [deletionSuccessVisible, setDeletionSuccessVisible] = useState(false);

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
    setFeedback((previous) => ({
      ...previous,
      visible: false,
    }));
  };

  const fetchMySettings = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      const response = await fetch(`${API_BASE_URL}/settings/my-settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to load settings.");
      }
      setSettings(data);
    } catch (error: any) {
      console.log("Fetch Settings error:", error);

      showFeedback(
        "error",
        "Settings Unavailable",
        error?.message || "We couldn't load your privacy settings.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySettings();
  }, []);

  const updateMySettings = async (key: keyof Settings, value: boolean) => {
    if (!settings) return;

    const previousSettings = settings;

    try {
      setUpdating(true);

      const updatedSettings = {
        ...settings,
        [key]: value,
      };

      setSettings(updatedSettings);

      const token = await getToken();

      const response = await fetch(
        `${API_BASE_URL}/settings/update-my-settings`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            [key]: value,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || "Failed to update settings.");
      }

      setSettings(data);
    } catch (error: any) {
      console.log("Update Settings error:", error);

      setSettings(previousSettings);

      showFeedback(
        "error",
        "Update Failed",
        error?.message || "Failed to update your settings. Please try again.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const beginLogout = () => {
    if (
      logoutSubmitting ||
      deletionSubmitting ||
      deletionWarningVisible ||
      deletionModalVisible ||
      deletionSuccessVisible
    ) {
      return;
    }
    setLogoutConfirmationVisible(true);
  };

  const cancelLogout = () => {
    if (logoutSubmitting) return;
    setLogoutConfirmationVisible(false);
  };

  const confirmLogout = async () => {
    if (logoutSubmitting) return;

    try {
      setLogoutSubmitting(true);

      await logout();

      setLogoutConfirmationVisible(false);
      router.replace("/");
    } catch (error) {
      console.log("Settings logout error:", error);
      setLogoutConfirmationVisible(false);

      showFeedback(
        "error",
        "Logout Failed",
        "We couldn't complete the logout process. Please try again.",
      );
    } finally {
      setLogoutSubmitting(false);
    }
  };

  // Open the detailed warning/consequences screen before any destructive action is allowed to continue.
  const beginAccountDeletion = () => {
    setDeletionWarningVisible(true);
  };

  // The user has explicitly acknowledged the consequences. Move to the existing password re-authentication step.
  const continueAccountDeletion = () => {
    setDeletionWarningVisible(false);

    setDeletionPassword("");
    setDeletionModalVisible(true);
  };

  // Cancel the warning without making any request to the backend.
  const cancelDeletionWarning = () => {
    if (deletionSubmitting) return;

    setDeletionWarningVisible(false);
  };

  const cancelDeletionReauthentication = () => {
    if (deletionSubmitting) return;

    setDeletionModalVisible(false);
    setDeletionPassword("");
  };

  const handleDeletionSuccessContinue = async () => {
    if (logoutSubmitting) return;

    try {
      setLogoutSubmitting(true);
      setDeletionSuccessVisible(false);

      // Reuse the application's existing logout implementation.
      // This clears the stored authentication token and Zustand auth state.
      await logout();

      // STEP 7 CHANGE:
      // Return to the application's root/authentication flow
      // after the successful account deletion logout.
      router.replace("/");
    } catch (error) {
      console.log("Account deletion logout error:", error);

      setLogoutSubmitting(false);

      showFeedback(
        "error",
        "Logout Failed",
        "Your account deletion request was successful, but we couldn't complete the local logout. Please try again.",
      );
    } finally {
      setLogoutSubmitting(false);
    }
  };

  const submitAccountDeletion = async () => {
    if (!deletionPassword.trim()) {
      showFeedback(
        "error",
        "Password Required",
        "Enter your current password to continue.",
      );

      return;
    }

    try {
      setDeletionSubmitting(true);

      const response = await requestAccountDeletion(deletionPassword);

      setDeletionModalVisible(false);
      setDeletionPassword("");

      // The backend has already scheduled the account for deletion.
      // The frontend does not perform the actual deletion locally.
      const scheduledDate = response.deletionScheduledFor
        ? new Date(response.deletionScheduledFor).toLocaleDateString()
        : "the scheduled date";

      // Keep the successful result separate from the generic feedback modal
      // so the user receives a clear final account-deletion confirmation.
      setDeletionSuccessVisible(true);

      console.log(
        "PHASE 7 — STEP 7: Account deletion scheduled:",
        scheduledDate,
      );
    } catch (error: any) {
      console.log("Account deletion error:", error);

      const message =
        error?.message ||
        error?.response?.data?.message ||
        "We couldn't process your account deletion request. Please try again.";

      showFeedback("error", "Deletion Request Failed", message);
    } finally {
      setDeletionSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Ionicons name="settings-outline" size={72} color="#2563EB" />
        <Text style={styles.emptyTitle}>Settings unavailable</Text>
        <Text style={styles.emptySubtitle}>
          We couldn&apos;t load your privacy settings.
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

  const settingItems = [
    {
      key: "allowDMFromAnyone" as const,
      title: "Allow Messages",
      description: "Anyone on the platform can message you",
      icon: "chatbubble-ellipses-outline",
      value: settings.allowDMFromAnyone,
    },
    {
      key: "allowUplineDM" as const,
      title: "Allow Upline Messages",
      description: "Only your upline can message you",
      icon: "people-outline",
      value: settings.allowUplineDM,
    },
    {
      key: "allowUplineView" as const,
      title: "Upline Visibility",
      description: "Only your upline can view your profile",
      icon: "eye-outline",
      value: settings.allowUplineView,
    },
    {
      key: "publicProfileVisible" as const,
      title: "Public Profile Visibility",
      description: "Allow everyone on Zleenchat to view your profile",
      icon: "globe-outline",
      value: settings.publicProfileVisible,
    },
    {
      key: "hideEmail" as const,
      title: "Hide My Email",
      description: "Prevent other users from seeing your email address",
      icon: "mail-outline",
      value: settings.hideEmail,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Decorative Background */}

      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      {/* Header */}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#0B1545" />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Privacy Settings</Text>

          <Text style={styles.headerSubtitle}>
            Control who can interact with you
          </Text>
        </View>
      </View>

      {/* Settings */}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.settingsContainer}
        showsVerticalScrollIndicator={false}
      >
        {settingItems.map((item) => (
          <View key={item.key} style={styles.settingCard}>
            <View style={styles.settingLeft}>
              <View style={styles.iconContainer}>
                <Ionicons name={item.icon as any} size={22} color="#2563EB" />
              </View>

              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>{item.title}</Text>

                <Text style={styles.settingDescription}>
                  {item.description}
                </Text>
              </View>
            </View>

            <Switch
              value={item.value}
              onValueChange={(value) => updateMySettings(item.key, value)}
              disabled={updating}
              trackColor={{
                false: "#CBD5E1",
                true: "#93C5FD",
              }}
              thumbColor={item.value ? "#2563EB" : "#FFFFFF"}
            />
          </View>
        ))}

        <TouchableOpacity
          style={styles.inviteFriendsButton}
          activeOpacity={0.85}
          onPress={() => router.push("/invite-friend")}
        >
          <View style={styles.inviteFriendsButtonIcon}>
            <Ionicons name="person-add-outline" size={23} color="#FFFFFF" />
          </View>

          <Text style={styles.inviteFriendsButtonText}>
            Invite Friends to Zleenchat
          </Text>

          <Ionicons name="arrow-forward" size={21} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.logoutButton,
            logoutSubmitting && styles.logoutButtonDisabled,
          ]}
          activeOpacity={0.85}
          onPress={beginLogout}
          disabled={
            logoutSubmitting ||
            deletionSubmitting ||
            deletionWarningVisible ||
            deletionModalVisible ||
            deletionSuccessVisible
          }
        >
          <View style={styles.logoutButtonIcon}>
            <Ionicons name="log-out-outline" size={22} color="#2563EB" />
          </View>

          <View style={styles.logoutButtonTextContainer}>
            <Text style={styles.logoutButtonText}>Log Out</Text>

            <Text style={styles.logoutButtonDescription}>
              Sign out of your Zleenchat account on this device
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#2563EB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteAccountButton}
          activeOpacity={0.85}
          onPress={beginAccountDeletion}
          disabled={
            deletionSubmitting ||
            deletionWarningVisible ||
            deletionModalVisible ||
            deletionSuccessVisible ||
            logoutSubmitting
          }
        >
          <View style={styles.deleteAccountButtonIcon}>
            <Ionicons name="trash-outline" size={22} color="#DC2626" />
          </View>

          <View style={styles.deleteAccountButtonTextContainer}>
            <Text style={styles.deleteAccountButtonText}>Delete Account</Text>

            <Text style={styles.deleteAccountButtonDescription}>
              Schedule your Zleenchat account for deletion
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={21} color="#DC2626" />
        </TouchableOpacity>
      </ScrollView>

      {updating && (
        <View style={styles.updatingOverlay}>
          <ActivityIndicator size="large" color="#2563EB" />

          <Text style={styles.updatingText}>Saving changes...</Text>
        </View>
      )}

      <Modal
        visible={logoutConfirmationVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelLogout}
      >
        <View style={styles.logoutModalOverlay}>
          <View style={styles.logoutModalCard}>
            <View style={styles.logoutModalIcon}>
              <Ionicons name="log-out-outline" size={29} color="#2563EB" />
            </View>

            <Text style={styles.logoutModalTitle}>Log Out?</Text>

            <Text style={styles.logoutModalDescription}>
              Are you sure you want to log out of your Zleenchat account on this
              device?
            </Text>

            <Text style={styles.logoutModalSecondaryDescription}>
              Your account will remain active. You can sign in again at any
              time.
            </Text>

            <TouchableOpacity
              style={[
                styles.confirmLogoutButton,
                logoutSubmitting && styles.confirmLogoutButtonDisabled,
              ]}
              activeOpacity={0.85}
              onPress={confirmLogout}
              disabled={logoutSubmitting}
            >
              {logoutSubmitting ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />

                  <Text style={styles.confirmLogoutButtonText}>
                    Signing Out...
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />

                  <Text style={styles.confirmLogoutButtonText}>
                    Yes, Log Out
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelLogoutButton}
              activeOpacity={0.85}
              onPress={cancelLogout}
              disabled={logoutSubmitting}
            >
              <Text style={styles.cancelLogoutButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deletionWarningVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelDeletionWarning}
      >
        <View style={styles.deletionModalOverlay}>
          <View style={styles.warningModalCard}>
            <View style={styles.warningIcon}>
              <Ionicons name="warning-outline" size={30} color="#DC2626" />
            </View>

            <Text style={styles.warningModalTitle}>Delete Your Account?</Text>

            <Text style={styles.warningModalIntro}>
              This will immediately disable your Zleenchat account and schedule it
              for deletion.
            </Text>

            <ScrollView
              style={styles.consequencesScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.consequenceRow}>
                <Ionicons
                  name="ban-outline"
                  size={21}
                  color="#DC2626"
                  style={styles.consequenceIcon}
                />

                <View style={styles.consequenceTextContainer}>
                  <Text style={styles.consequenceTitle}>
                    Your account will be disabled
                  </Text>

                  <Text style={styles.consequenceDescription}>
                    You will be logged out and will no longer be able to use
                    normal Zleenchat activity while the deletion is pending.
                  </Text>
                </View>
              </View>

              <View style={styles.consequenceRow}>
                <Ionicons
                  name="time-outline"
                  size={21}
                  color="#D97706"
                  style={styles.consequenceIcon}
                />

                <View style={styles.consequenceTextContainer}>
                  <Text style={styles.consequenceTitle}>
                    Deletion is scheduled, not immediate
                  </Text>

                  <Text style={styles.consequenceDescription}>
                    Your account remains in the deletion retention period until
                    the scheduled deletion date.
                  </Text>
                </View>
              </View>

              <View style={styles.consequenceRow}>
                <Ionicons
                  name="document-text-outline"
                  size={21}
                  color="#2563EB"
                  style={styles.consequenceIcon}
                />

                <View style={styles.consequenceTextContainer}>
                  <Text style={styles.consequenceTitle}>
                    Some historical data is retained
                  </Text>

                  <Text style={styles.consequenceDescription}>
                    Certain records, including historical messages and other
                    records required for platform integrity, may remain retained
                    and associated with an anonymized account identity.
                  </Text>
                </View>
              </View>

              <View style={styles.consequenceRow}>
                <Ionicons
                  name="person-remove-outline"
                  size={21}
                  color="#7C3AED"
                  style={styles.consequenceIcon}
                />

                <View style={styles.consequenceTextContainer}>
                  <Text style={styles.consequenceTitle}>
                    Your profile identity will be anonymized
                  </Text>

                  <Text style={styles.consequenceDescription}>
                    During finalization, your profile identity is anonymized
                    rather than presenting the deleted account as an active
                    user.
                  </Text>
                </View>
              </View>

              <View style={styles.consequenceRow}>
                <Ionicons
                  name="shield-outline"
                  size={21}
                  color="#475569"
                  style={styles.consequenceIcon}
                />

                <View style={styles.consequenceTextContainer}>
                  <Text style={styles.consequenceTitle}>
                    Legal retention may apply
                  </Text>

                  <Text style={styles.consequenceDescription}>
                    Information subject to a valid legal hold may be retained
                    for the applicable legal or compliance requirement.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.warningAcknowledgement}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color="#64748B"
              />

              <Text style={styles.warningAcknowledgementText}>
                Continue only if you understand these consequences.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.continueDeletionButton}
              activeOpacity={0.85}
              onPress={continueAccountDeletion}
            >
              <Text style={styles.continueDeletionButtonText}>
                I Understand — Continue
              </Text>

              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelDeletionButton}
              activeOpacity={0.85}
              onPress={cancelDeletionWarning}
            >
              <Text style={styles.cancelDeletionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deletionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={cancelDeletionReauthentication}
      >
        <View style={styles.deletionModalOverlay}>
          <View style={styles.deletionModalCard}>
            <View style={styles.deletionModalIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={28}
                color="#DC2626"
              />
            </View>

            <Text style={styles.deletionModalTitle}>
              Confirm Account Deletion
            </Text>

            <Text style={styles.deletionModalDescription}>
              For your security, enter your current password to confirm that you
              want to schedule your account for deletion.
            </Text>

            <Text style={styles.deletionPasswordLabel}>Current Password</Text>

            <TextInput
              value={deletionPassword}
              onChangeText={setDeletionPassword}
              placeholder="Enter your current password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!deletionSubmitting}
              style={styles.deletionPasswordInput}
            />

            <TouchableOpacity
              style={[
                styles.confirmDeletionButton,
                deletionSubmitting && styles.confirmDeletionButtonDisabled,
              ]}
              activeOpacity={0.85}
              onPress={submitAccountDeletion}
              disabled={deletionSubmitting}
            >
              {deletionSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmDeletionButtonText}>
                  Confirm Deletion
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelDeletionButton}
              activeOpacity={0.85}
              onPress={cancelDeletionReauthentication}
              disabled={deletionSubmitting}
            >
              <Text style={styles.cancelDeletionButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AppFeedbackModal
        visible={deletionSuccessVisible}
        type="success"
        title="Account Deletion Scheduled"
        message={
          "Your account has been successfully scheduled for deletion. " +
          "Your account is now disabled and will remain retained during " +
          "the applicable deletion period. Historical data that is required " +
          "to be retained may remain in anonymized form."
        }
        buttonText={logoutSubmitting ? "Signing Out..." : "Continue to Sign In"}
        onClose={handleDeletionSuccessContinue}
      />

      {/* Existing generic feedback system */}

      <AppFeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        buttonText="OK"
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

  topBlob: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#E9EEFF",
    top: -80,
    left: -110,
  },

  bottomBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#EEE8FF",
    bottom: -70,
    right: -100,
  },

  topGlow: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(37,99,235,0.04)",
    top: 120,
    alignSelf: "center",
  },

  bottomGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(124,58,237,0.04)",
    bottom: 80,
    alignSelf: "center",
  },

  header: {
    paddingTop: 46,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 4,
  },

  headerText: {
    marginLeft: 14,
    flex: 1,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0B1545",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: "#69708A",
  },

  settingsContainer: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 120,
  },

  settingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 3,
  },

  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 16,
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  settingText: {
    flex: 1,
  },

  settingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B1545",
  },

  settingDescription: {
    marginTop: 3,
    fontSize: 13,
    color: "#69708A",
    lineHeight: 18,
  },

  inviteFriendsButton: {
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: "#7257E8",
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 14,

    shadowColor: "#7257E8",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 5,
  },

  inviteFriendsButtonIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },

  inviteFriendsButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },

  logoutButton: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    marginBottom: 14,
  },

  logoutButtonDisabled: {
    opacity: 0.65,
  },

  logoutButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },

  logoutButtonTextContainer: {
    flex: 1,
    marginRight: 10,
  },

  logoutButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1D4ED8",
  },

  logoutButtonDescription: {
    marginTop: 3,
    fontSize: 12,
    color: "#475569",
    lineHeight: 17,
  },

  logoutModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,21,69,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },

  logoutModalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 24,

    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 10,
  },

  logoutModalIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#DBEAFE",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },

  logoutModalTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
  },

  logoutModalDescription: {
    marginTop: 10,
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
    textAlign: "center",
  },

  logoutModalSecondaryDescription: {
    marginTop: 7,
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    textAlign: "center",
  },

  confirmLogoutButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 22,
  },

  confirmLogoutButtonDisabled: {
    opacity: 0.65,
  },

  confirmLogoutButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 8,
  },

  cancelLogoutButton: {
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#F1F5F9",
  },

  cancelLogoutButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },

  updatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },

  updatingText: {
    marginTop: 16,
    fontSize: 15,
    color: "#0B1545",
    fontWeight: "600",
  },

  emptyTitle: {
    marginTop: 20,
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

  deleteAccountButton: {
    minHeight: 74,
    borderRadius: 20,
    backgroundColor: "#FFF7F7",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },

  deleteAccountButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },

  deleteAccountButtonTextContainer: {
    flex: 1,
    marginRight: 10,
  },

  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#B91C1C",
  },

  deleteAccountButtonDescription: {
    marginTop: 3,
    fontSize: 12,
    color: "#7F1D1D",
    lineHeight: 17,
  },

  deletionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,21,69,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
  },

  warningModalCard: {
    width: "100%",
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 24,

    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 10,
  },

  warningIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },

  warningModalTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
  },

  warningModalIntro: {
    marginTop: 10,
    fontSize: 14,
    color: "#69708A",
    lineHeight: 21,
    textAlign: "center",
  },

  consequencesScroll: {
    marginTop: 20,
    maxHeight: 340,
  },

  consequenceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },

  consequenceIcon: {
    marginTop: 2,
    marginRight: 12,
  },

  consequenceTextContainer: {
    flex: 1,
  },

  consequenceTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B1545",
  },

  consequenceDescription: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
  },

  warningAcknowledgement: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },

  warningAcknowledgementText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#64748B",
  },

  continueDeletionButton: {
    minHeight: 52,
    borderRadius: 15,
    backgroundColor: "#DC2626",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 16,
  },

  continueDeletionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginRight: 8,
  },

  deletionModalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 24,

    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 10,
    },

    elevation: 10,
  },

  deletionModalIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },

  deletionModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
  },

  deletionModalDescription: {
    marginTop: 10,
    fontSize: 14,
    color: "#69708A",
    lineHeight: 21,
    textAlign: "center",
  },

  deletionPasswordLabel: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: "#0B1545",
  },

  deletionPasswordInput: {
    height: 52,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    color: "#0B1545",
    backgroundColor: "#FFFFFF",
  },

  confirmDeletionButton: {
    height: 52,
    borderRadius: 15,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 18,
  },

  confirmDeletionButtonDisabled: {
    opacity: 0.65,
  },

  confirmDeletionButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  cancelDeletionButton: {
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "#F1F5F9",
  },

  cancelDeletionButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
});
