import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "@/src/services/api/apiClient";
import {
  addUserToGroups,
  getGroupsForAddingUser,
  AddUserGroup,
} from "@/src/services/group/groupService";

import {
  getUserDetails,
  UserDetails,
} from "@/src/services/profile/profileService";

import { useAuthStore } from "@/src/store/auth/authStorage";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type FeedbackState = {
  visible: boolean;
  type: FeedbackType;
  title: string;
  message: string;
  buttonText?: string;
  onClose?: () => void;
};

export default function AddUserToGroupsScreen() {
  const { userId } = useLocalSearchParams<{
    userId: string;
  }>();

  const currentUser = useAuthStore((state) => state.user);

  const currentUserId = currentUser?.sub;
  const targetUserId = Number(userId);

  const [targetUser, setTargetUser] = useState<UserDetails | null>(null);
  const [groups, setGroups] = useState<AddUserGroup[]>([]);

  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(
    new Set(),
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<FeedbackState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
    buttonText: "OK",
  });

  const showFeedback = (
    type: FeedbackType,
    title: string,
    message: string,
    options?: {
      buttonText?: string;
      onClose?: () => void;
    },
  ) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
      buttonText: options?.buttonText || "OK",
      onClose: options?.onClose,
    });
  };

  const closeFeedback = () => {
    const callback = feedback.onClose;

    setFeedback((previous) => ({
      ...previous,
      visible: false,
    }));

    if (callback) {
      callback();
    }
  };

  const loadScreen = useCallback(async () => {
    if (!currentUserId) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      setError("Invalid user.");
      setLoading(false);
      return;
    }

    if (currentUserId === targetUserId) {
      setError("You cannot add yourself to groups.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [user, availableGroups] = await Promise.all([
        getUserDetails(targetUserId),
        getGroupsForAddingUser(targetUserId),
      ]);

      setTargetUser(user);
      setGroups(availableGroups || []);

      // Do not automatically select anything.
      setSelectedGroupIds(new Set());
    } catch (err) {
      console.log("Add user to groups fetch error:", err);
      setError("Unable to load available groups.");
    } finally {
      setLoading(false);
    }
  }, [currentUserId, targetUserId]);

  useEffect(() => {
    loadScreen();
  }, [loadScreen]);

  const toggleGroup = (group: AddUserGroup) => {
    if (group.isAlreadyMember || submitting) {
      return;
    }

    setSelectedGroupIds((previous) => {
      const next = new Set(previous);

      if (next.has(group.id)) {
        next.delete(group.id);
      } else {
        next.add(group.id);
      }

      return next;
    });
  };

  const handleAddToGroups = async () => {
    if (submitting) {
      return;
    }

    const groupIds = Array.from(selectedGroupIds);

    if (groupIds.length === 0) {
      showFeedback(
        "warning",
        "No groups selected",
        "Select at least one group before continuing.",
      );

      return;
    }

    if (!targetUser) {
      return;
    }

    try {
      setSubmitting(true);

      const result = await addUserToGroups(targetUser.id, groupIds);

      const successfulCount =
        result?.results?.filter(
          (item: any) => item.status === "added" || item.status === "restored",
        ).length ?? 0;

      const alreadyMemberCount =
        result?.results?.filter((item: any) => item.status === "already_member")
          .length ?? 0;

      if (successfulCount > 0) {
        showFeedback(
          "success",
          "User added",
          `${targetUser.username} was added to ${successfulCount} group${
            successfulCount === 1 ? "" : "s"
          }.${
            alreadyMemberCount > 0
              ? ` ${alreadyMemberCount} selected group${
                  alreadyMemberCount === 1 ? " was" : "s were"
                } already joined.`
              : ""
          }`,
          {
            buttonText: "Done",
            onClose: () => router.back(),
          },
        );
      } else {
        showFeedback(
          "info",
          "No changes made",
          `${targetUser.username} is already a member of the selected group${
            groupIds.length === 1 ? "" : "s"
          }.`,
        );
      }

      setSelectedGroupIds(new Set());
    } catch (err) {
      console.log("Add user to groups error:", err);

      showFeedback(
        "error",
        "Unable to add user",
        err instanceof Error
          ? err.message
          : "Something went wrong while adding the user.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getAvatarUri = (avatarUrl?: string | null) => {
    if (!avatarUrl) {
      return null;
    }

    return `${API_BASE_URL}${avatarUrl}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />

          <Text style={styles.loadingText}>Loading available groups...</Text>
        </View>

        <AppFeedbackModal
          visible={feedback.visible}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          buttonText={feedback.buttonText}
          onClose={closeFeedback}
        />
      </SafeAreaView>
    );
  }

  if (error || !targetUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={58} color="#EF4444" />

          <Text style={styles.errorTitle}>Something went wrong</Text>

          <Text style={styles.errorText}>
            {error ?? "Unable to load user."}
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.retryButton}
            onPress={loadScreen}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.backTextButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backTextButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>

        <AppFeedbackModal
          visible={feedback.visible}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          buttonText={feedback.buttonText}
          onClose={closeFeedback}
        />
      </SafeAreaView>
    );
  }

  const targetAvatarUri = getAvatarUri(targetUser.avatarUrl);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Decorative Background */}

      <View pointerEvents="none" style={styles.topBlob} />
      <View pointerEvents="none" style={styles.bottomBlob} />
      <View pointerEvents="none" style={styles.topGlow} />
      <View pointerEvents="none" style={styles.bottomGlow} />

      {/* Header */}

      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#0B1545" />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Add to Groups</Text>

          <Text style={styles.headerSubtitle}>
            Select groups for {targetUser.username}
          </Text>
        </View>
      </View>

      {/* Target User */}

      <View style={styles.targetCard}>
        {targetAvatarUri ? (
          <Image
            source={{ uri: targetAvatarUri }}
            style={styles.targetAvatar}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.targetAvatarFallback}>
            <Text style={styles.targetAvatarText}>
              {targetUser.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.targetInfo}>
          <Text style={styles.targetName}>
            {targetUser.firstName} {targetUser.lastName}
          </Text>

          <Text style={styles.targetUsername}>@{targetUser.username}</Text>
        </View>

        <View style={styles.targetIcon}>
          <Ionicons name="person-add-outline" size={22} color="#2563EB" />
        </View>
      </View>

      {/* Selection Summary */}

      <View style={styles.selectionHeader}>
        <View style={styles.selectionHeaderLeft}>
          <Ionicons name="people-outline" size={21} color="#2563EB" />

          <Text style={styles.selectionTitle}>Your Groups</Text>
        </View>

        {selectedGroupIds.size > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{selectedGroupIds.size}</Text>
          </View>
        )}
      </View>

      <Text style={styles.selectionSubtitle}>
        Select the groups where you want to add {targetUser.username}.
      </Text>

      {/* Groups */}

      <FlatList
        data={groups}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          groups.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons name="people-outline" size={42} color="#2563EB" />
            </View>

            <Text style={styles.emptyTitle}>No available groups</Text>

            <Text style={styles.emptySubtitle}>
              You don&apos;t currently administer any groups where you can add
              this user.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedGroupIds.has(item.id);
          const avatarUri = getAvatarUri(item.avatarUrl);

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={item.isAlreadyMember || submitting}
              style={[
                styles.groupCard,
                isSelected && styles.groupCardSelected,
                item.isAlreadyMember && styles.groupCardDisabled,
              ]}
              onPress={() => toggleGroup(item)}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.groupAvatar}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.groupAvatarFallback}>
                  <Ionicons name="people" size={23} color="#2563EB" />
                </View>
              )}

              <View style={styles.groupInfo}>
                <Text numberOfLines={1} style={styles.groupName}>
                  {item.name}
                </Text>

                <Text numberOfLines={1} style={styles.groupStatus}>
                  {item.isAlreadyMember
                    ? `${targetUser.username} is already a member`
                    : isSelected
                      ? "Selected"
                      : "Available"}
                </Text>
              </View>

              <View
                style={[
                  styles.checkbox,
                  isSelected && styles.checkboxSelected,
                  item.isAlreadyMember && styles.checkboxDisabled,
                ]}
              >
                {isSelected && (
                  <Ionicons name="checkmark" size={17} color="#FFFFFF" />
                )}

                {item.isAlreadyMember && (
                  <Ionicons name="checkmark" size={17} color="#64748B" />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Bottom Action */}

      {groups.length > 0 && (
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={selectedGroupIds.size === 0 || submitting}
            style={[
              styles.addButton,
              (selectedGroupIds.size === 0 || submitting) &&
                styles.addButtonDisabled,
            ]}
            onPress={handleAddToGroups}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color="#FFFFFF" />

                <Text style={styles.addButtonText}>
                  Add to{" "}
                  {selectedGroupIds.size > 0
                    ? `${selectedGroupIds.size} group${
                        selectedGroupIds.size === 1 ? "" : "s"
                      }`
                    : "Groups"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* App Feedback Modal */}

      <AppFeedbackModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.title}
        message={feedback.message}
        buttonText={feedback.buttonText}
        onClose={closeFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: "#69708A",
    fontWeight: "500",
  },

  /* Background */

  topBlob: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#E9EEFF",
    top: -85,
    left: -115,
  },

  bottomBlob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#EEE8FF",
    bottom: -75,
    right: -105,
  },

  topGlow: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(37,99,235,0.035)",
    top: 125,
    alignSelf: "center",
  },

  bottomGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(124,58,237,0.035)",
    bottom: 80,
    alignSelf: "center",
  },

  /* Header */

  header: {
    paddingTop: 18,
    paddingHorizontal: 20,
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
    borderWidth: 1,
    borderColor: "#EEF2FF",
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
    flex: 1,
    marginLeft: 14,
  },

  headerTitle: {
    fontSize: 27,
    fontWeight: "800",
    color: "#0B1545",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: "#69708A",
  },

  /* Target */

  targetCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.055,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 4,
  },

  targetAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  targetAvatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
  },

  targetAvatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2563EB",
  },

  targetInfo: {
    flex: 1,
    marginLeft: 13,
  },

  targetName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B1545",
  },

  targetUsername: {
    marginTop: 3,
    fontSize: 13,
    color: "#69708A",
  },

  targetIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
  },

  /* Selection Header */

  selectionHeader: {
    marginTop: 23,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
  },

  selectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  selectionTitle: {
    marginLeft: 8,
    fontSize: 19,
    fontWeight: "700",
    color: "#0B1545",
  },

  countBadge: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },

  countBadgeText: {
    color: "#2563EB",
    fontSize: 12,
    fontWeight: "700",
  },

  selectionSubtitle: {
    marginTop: 5,
    paddingHorizontal: 22,
    fontSize: 13,
    lineHeight: 19,
    color: "#69708A",
  },

  /* Groups */

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 115,
  },

  groupCard: {
    minHeight: 74,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F2FA",
    shadowColor: "#2563EB",
    shadowOpacity: 0.045,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  groupCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#F7F9FF",
  },

  groupCardDisabled: {
    opacity: 0.62,
  },

  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },

  groupAvatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
  },

  groupInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0B1545",
  },

  groupStatus: {
    marginTop: 4,
    fontSize: 12,
    color: "#69708A",
  },

  /* Checkbox */

  checkbox: {
    width: 27,
    height: 27,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#2563EB",
  },

  checkboxDisabled: {
    borderColor: "#CBD5E1",
    backgroundColor: "#E2E8F0",
  },

  /* Bottom */

  bottomContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: 1,
    borderTopColor: "#EEF2FF",
  },

  addButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    shadowColor: "#2563EB",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 6,
  },

  addButtonDisabled: {
    backgroundColor: "#CBD5E1",
    shadowOpacity: 0,
    elevation: 0,
  },

  addButtonText: {
    marginLeft: 8,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  /* Empty */

  emptyListContent: {
    flexGrow: 1,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 35,
    paddingBottom: 100,
  },

  emptyIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "700",
    color: "#0B1545",
    textAlign: "center",
  },

  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#69708A",
    textAlign: "center",
  },

  /* Errors */

  errorTitle: {
    marginTop: 18,
    fontSize: 21,
    fontWeight: "700",
    color: "#0B1545",
  },

  errorText: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 21,
    color: "#69708A",
    textAlign: "center",
  },

  retryButton: {
    marginTop: 23,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#2563EB",
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  backTextButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  backTextButtonText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "700",
  },
});
