import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ScrollView,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";

import {
  blockUser,
  unblockUser,
  getUserDetails,
  UserDetails,
} from "@/src/services/profile/profileService";
import { getConversationMessages } from "@/src/services/chat/chatService";
import { Message } from "@/src/types/chat.types";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { decryptRemoteThumbnail } from "@/src/utils/thumbnailPipeline";

import { API_BASE_URL } from "@/src/services/api/apiClient";
import { useGroupCreationStore } from "@/src/store/group/groupCreationStore";

type UserMediaContentType = "IMAGE" | "VIDEO" | "FILE" | "LINK";

type UserMediaPreviewProps = {
  message: Message;
  contentType: UserMediaContentType;
};

const getAbsoluteMediaUri = (uri?: string | null) => {
  if (!uri) {
    return null;
  }

  return uri.startsWith("http") ? uri : `${API_BASE_URL}${uri}`;
};

const getLinkHost = (content?: string | null) => {
  const match = content?.match(
    /https?:\/\/[^\s<>]+|(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/[^\s<>]*)?/i,
  );

  if (!match) {
    return content?.trim() || "Link shared";
  }

  return match[0]
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .replace(/[.,;!?)]+$/, "");
};

const UserMediaPreview: React.FC<UserMediaPreviewProps> = ({
  message,
  contentType,
}) => {
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      setPreviewUri(null);

      const localThumbnail = message.thumbnailUri || message.cachedThumbnailUri;
      if (localThumbnail) {
        if (active) {
          setPreviewUri(localThumbnail);
        }
        return;
      }

      if (message.thumbnailUrl) {
        if (message.encryptedThumbnailKey && message.thumbnailIV) {
          const decryptedThumbnail = await decryptRemoteThumbnail({
            thumbnailUrl: message.thumbnailUrl,
            encryptedThumbnailKey: message.encryptedThumbnailKey,
            thumbnailIV: message.thumbnailIV,
            thumbnailAuthTag: message.thumbnailAuthTag || "",
          });

          if (active) {
            setPreviewUri(decryptedThumbnail);
          }
        } else if (active) {
          setPreviewUri(getAbsoluteMediaUri(message.thumbnailUrl));
        }
        return;
      }

      if (contentType !== "IMAGE" && contentType !== "VIDEO") {
        return;
      }

      const localMedia =
        message.decryptedUri || message.cachedMediaUri || message.localUri;
      if (localMedia) {
        if (active) {
          setPreviewUri(localMedia);
        }
        return;
      }

      if (!message.mediaUrl) {
        return;
      }

      if (
        message.isMediaEncrypted &&
        message.encryptedMediaKey &&
        message.mediaKeyIV
      ) {
        const decryptedMedia = await decryptRemoteMedia({
          mediaUrl: message.mediaUrl,
          encryptedMediaKey: message.encryptedMediaKey,
          mediaKeyIV: message.mediaKeyIV,
          mediaKeyAuthTag: message.mediaKeyAuthTag,
          mimeType: message.mimeType,
          fileName: message.fileName,
        });

        if (active) {
          setPreviewUri(decryptedMedia);
        }
      } else if (active) {
        setPreviewUri(getAbsoluteMediaUri(message.mediaUrl));
      }
    };

    loadPreview().catch((error) => {
      console.warn("Unable to load user media preview:", error);
    });

    return () => {
      active = false;
    };
  }, [
    contentType,
    message.cachedMediaUri,
    message.cachedThumbnailUri,
    message.decryptedUri,
    message.encryptedMediaKey,
    message.encryptedThumbnailKey,
    message.fileName,
    message.isMediaEncrypted,
    message.localUri,
    message.mediaKeyIV,
    message.mediaKeyAuthTag,
    message.mediaUrl,
    message.mimeType,
    message.thumbnailAuthTag,
    message.thumbnailIV,
    message.thumbnailUri,
    message.thumbnailUrl,
  ]);

  if (contentType === "IMAGE" || contentType === "VIDEO") {
    return (
      <View style={styles.mediaPreviewTile}>
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            style={styles.mediaPreviewImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.mediaPreviewFallback} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.mediaPreviewTile}>
      <Text numberOfLines={3} style={styles.mediaPreviewText}>
        {contentType === "FILE"
          ? message.fileName?.trim() || "File shared"
          : getLinkHost(message.messageContent)}
      </Text>
    </View>
  );
};

export default function UserDetailsScreen() {
  const { userId } = useLocalSearchParams();

  const parsedUserId = Number(userId);

  const setTargetUser = useGroupCreationStore((state) => state.setTargetUser);

  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUserDetails = useCallback(async () => {
    if (!parsedUserId) {
      setError("Invalid user.");
      setLoading(false);
      return;
    }

    try {
      setError(null);

      const response = await getUserDetails(parsedUserId);

      setUserDetails(response);
    } catch (err) {
      console.log("User details fetch error:", err);
      setError("Unable to load user details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [parsedUserId]);

  const fetchConversationMessages = useCallback(async () => {
    if (!parsedUserId) {
      setConversationMessages([]);
      setMediaLoading(false);
      return;
    }

    setMediaLoading(true);

    try {
      const response = await getConversationMessages(parsedUserId);
      setConversationMessages(
        Array.isArray(response?.messages) ? response.messages : [],
      );
    } catch (err) {
      console.log("User media messages fetch error:", err);
      setConversationMessages([]);
    } finally {
      setMediaLoading(false);
    }
  }, [parsedUserId]);

  const latestMediaMessages = useMemo(
    () =>
      conversationMessages
        .filter((message) => {
          const contentType = String(message.contentType || "").toUpperCase();

          return (
            !message.deletedForAll &&
            message.type !== "SYSTEM" &&
            ["IMAGE", "VIDEO", "FILE", "LINK"].includes(contentType)
          );
        })
        .sort(
          (messageA, messageB) =>
            new Date(messageB.createdAt).getTime() -
            new Date(messageA.createdAt).getTime(),
        )
        .slice(0, 5),
    [conversationMessages],
  );

  useFocusEffect(
    useCallback(() => {
      fetchUserDetails();
      fetchConversationMessages();
    }, [fetchUserDetails, fetchConversationMessages]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUserDetails(), fetchConversationMessages()]);
  };

  const handleMessage = () => {
    router.back();
  };

  const handleSearchChat = () => {
    router.push({
      pathname: "/chats/[userId]",
      params: {
        userId: parsedUserId.toString(),
        username: userDetails?.username ?? "",
        avatarUrl: userDetails?.avatarUrl ?? "",
        search: "true",
      },
    });
  };

  const handleBlock = async () => {
    if (!userDetails || blocking) {
      return;
    }

    try {
      setBlocking(true);

      if (userDetails.blockStatus.iBlockedThem) {
        await unblockUser(parsedUserId);
      } else {
        await blockUser(parsedUserId);
      }

      await fetchUserDetails();
    } catch (error) {
      console.log("Block/unblock error:", error);
    } finally {
      setBlocking(false);
    }
  };

  const handleCreateGroupWithUser = () => {
    if (!userDetails || !parsedUserId) {
      return;
    }

    setTargetUser({
      id: parsedUserId,
      username: userDetails.username,
      avatarUrl: userDetails.avatarUrl ?? null,
    });

    router.push("/(tabs)/group");
  };

  const handleAddToGroups = () => {
    if (!userDetails || !parsedUserId) {
      return;
    }

    router.push({
      pathname: "/groups/add-user-to-groups",
      params: {
        userId: parsedUserId.toString(),
      },
    });
  };

  const formatLastSeen = (date: string | null) => {
    if (!date) {
      return "Offline";
    }

    return new Date(date).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const avatarUri =
    userDetails?.avatarUrl != null
      ? `${API_BASE_URL}${userDetails.avatarUrl}`
      : null;

  const fullName = userDetails
    ? `${userDetails.firstName} ${userDetails.lastName}`
    : "";

  const location = userDetails
    ? [
        userDetails.location.city,
        userDetails.location.state,
        userDetails.location.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />

          <Text style={styles.loadingText}>Loading user details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !userDetails) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />

          <Text style={styles.errorTitle}>Something went wrong</Text>

          <Text style={styles.errorText}>{error ?? "User not found."}</Text>

          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ================= Background ================= */}

      <View pointerEvents="none" style={styles.blobTopLeft} />
      <View pointerEvents="none" style={styles.blobTopRight} />
      <View pointerEvents="none" style={styles.blobBottomLeft} />
      <View pointerEvents="none" style={styles.blobBottomRight} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ================= Header ================= */}

        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#0B1545" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>User Details</Text>

          <View style={{ width: 42 }} />
        </View>

        {/* ================= Hero ================= */}

        <View style={styles.heroSection}>
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {userDetails.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.heroOnlineDot,
                {
                  backgroundColor: userDetails.online ? "#22C55E" : "#9CA3AF",
                },
              ]}
            />
          </View>

          <Text style={styles.fullName}>{fullName}</Text>

          <Text style={styles.username}>@{userDetails.username}</Text>

          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: userDetails.online ? "#22C55E" : "#9CA3AF",
                },
              ]}
            />

            <Text style={styles.statusPillText}>
              {userDetails.online
                ? "Online"
                : userDetails.lastSeen
                  ? `Last seen ${formatLastSeen(userDetails.lastSeen)}`
                  : "Offline"}
            </Text>
          </View>
        </View>

        {/* ================= Primary Actions ================= */}

        <View style={styles.primaryActions}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryActionCard}
            onPress={handleMessage}
          >
            <View
              style={[styles.primaryActionIcon, { backgroundColor: "#EEF4FF" }]}
            >
              <Ionicons name="chatbubble-ellipses" size={24} color="#2563EB" />
            </View>

            <Text style={styles.primaryActionText}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryActionCard}
            onPress={handleSearchChat}
          >
            <View
              style={[styles.primaryActionIcon, { backgroundColor: "#EEF4FF" }]}
            >
              <Ionicons name="search-outline" size={27} color="#2563EB" />
            </View>

            <Text style={styles.primaryActionText}>Search Chat</Text>
          </TouchableOpacity>
        </View>

        {/* ================= About ================= */}

        <View style={styles.section}>
          <View style={styles.aboutCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color="#2563EB"
                />
              </View>

              <Text style={styles.cardTitle}>About</Text>
            </View>

            {!!userDetails.bio && (
              <Text style={styles.bioText}>{userDetails.bio}</Text>
            )}

            {!userDetails.bio && (
              <Text style={styles.emptyBio}>No bio provided.</Text>
            )}

            <View style={styles.aboutDivider} />

            <View style={styles.aboutInfoRow}>
              <Ionicons name="calendar-outline" size={21} color="#2563EB" />

              <Text style={styles.aboutInfoLabel}>Member Since</Text>

              <Text style={styles.aboutInfoValue}>
                {new Date(userDetails.memberSince).toLocaleDateString(
                  undefined,
                  {
                    month: "short",
                    year: "numeric",
                  },
                )}
              </Text>
            </View>

            <View style={styles.aboutInfoRow}>
              <Ionicons name="location-outline" size={21} color="#2563EB" />

              <Text style={styles.aboutInfoLabel}>Location</Text>

              <Text style={styles.aboutInfoValue} numberOfLines={1}>
                {location || "Not provided"}
              </Text>
            </View>

            <View style={styles.aboutInfoRow}>
              <Ionicons name="time-outline" size={21} color="#2563EB" />

              <Text style={styles.aboutInfoLabel}>Local Time</Text>

              <Text style={styles.aboutInfoValue}>
                {userDetails.location.timezone ?? "Not provided"}
              </Text>
            </View>
          </View>
        </View>

        {/* ================= Shared Media ================= */}

        <View style={styles.section}>
          <View style={styles.mediaParentCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <Ionicons name="folder-outline" size={23} color="#2563EB" />

                <Text style={styles.sectionHeaderTitle}>
                  Media, Links & Docs
                </Text>
              </View>

              {latestMediaMessages.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.mediaViewAllButton}
                  onPress={() =>
                    router.push({
                      pathname: "/shared-media" as any,
                      params: {
                        userId: parsedUserId.toString(),
                        username: userDetails.username,
                      },
                    })
                  }
                >
                  <Text style={styles.mediaViewAllText}>View all</Text>
                </TouchableOpacity>
              )}
            </View>

            {mediaLoading ? (
              <ActivityIndicator
                size="small"
                color="#2563EB"
                style={styles.mediaLoading}
              />
            ) : latestMediaMessages.length > 0 ? (
              <View style={styles.mediaPreviewRow}>
                {latestMediaMessages.map((message) => {
                  const contentType = String(
                    message.contentType,
                  ).toUpperCase() as UserMediaContentType;

                  return (
                    <TouchableOpacity
                      key={message.id}
                      activeOpacity={0.85}
                      style={styles.mediaPreviewButton}
                      onPress={() =>
                        router.push({
                          pathname: "/shared-media" as any,
                          params: {
                            userId: parsedUserId.toString(),
                            username: userDetails.username,
                            initialTab: contentType,
                          },
                        })
                      }
                    >
                      <UserMediaPreview
                        message={message}
                        contentType={contentType}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.noMediaMessages}>No Media Messages</Text>
            )}
          </View>
        </View>

        {/* ================= Common Groups ================= */}

        <View style={styles.section}>
          <View style={styles.commonGroupsCard}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="people-outline" size={23} color="#2563EB" />

              <Text style={styles.sectionHeaderTitle}>Groups in Common</Text>

              {userDetails.commonGroups.count > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {userDetails.commonGroups.count}
                  </Text>
                </View>
              )}
            </View>

            {/* Create Group */}

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.groupActionRow}
              onPress={handleCreateGroupWithUser}
            >
              <View style={styles.groupActionIcon}>
                <Ionicons name="people-outline" size={21} color="#2563EB" />
              </View>

              <Text style={styles.groupActionText}>
                Create group with {userDetails.username}
              </Text>

              <Ionicons name="chevron-forward" size={20} color="#2563EB" />
            </TouchableOpacity>

            {/* Add To Groups */}

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.groupRow}
              onPress={handleAddToGroups}
            >
              <View style={styles.groupRowIcon}>
                <Ionicons name="person-add-outline" size={21} color="#2563EB" />
              </View>

              <View style={styles.groupRowContent}>
                <Text style={styles.groupName}>Add to groups</Text>

                <Text style={styles.groupSubtext}>
                  Add this user to groups you administer
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#69708A" />
            </TouchableOpacity>

            {/* Common Groups */}

            {userDetails.commonGroups.groups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupRow}
                activeOpacity={0.85}
                onPress={() =>
                  router.push({
                    pathname: "/groups/[groupId]",
                    params: {
                      groupId: group.id.toString(),
                    },
                  })
                }
              >
                {group.avatarUrl ? (
                  <Image
                    source={{
                      uri: `${API_BASE_URL}${group.avatarUrl}`,
                    }}
                    style={styles.groupAvatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.groupAvatar}>
                    <Ionicons name="people" size={19} color="#2563EB" />
                  </View>
                )}

                <View style={styles.groupRowContent}>
                  <Text style={styles.groupName}>{group.name}</Text>

                  <Text style={styles.groupSubtext}>Common group</Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#69708A" />
              </TouchableOpacity>
            ))}

            {userDetails.commonGroups.count === 0 && (
              <Text style={styles.noGroupsText}>
                You don&apos;t share any groups.
              </Text>
            )}
          </View>
        </View>

        {/* ================= Block User ================= */}

        <View style={styles.section}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={blocking}
            onPress={handleBlock}
            style={[
              styles.blockUserRow,
              blocking && styles.blockUserRowDisabled,
            ]}
          >
            {blocking ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons
                name={
                  userDetails.blockStatus.iBlockedThem
                    ? "lock-closed-outline"
                    : "ban-outline"
                }
                size={23}
                color="#DC2626"
              />
            )}

            <Text style={styles.blockUserText}>
              {userDetails.blockStatus.iBlockedThem
                ? "Unblock User"
                : "Block User"}
            </Text>

            <Ionicons name="chevron-forward" size={21} color="#0B1545" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    paddingBottom: 45,
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

  errorTitle: {
    marginTop: 18,
    fontSize: 21,
    fontWeight: "700",
    color: "#0B1545",
  },

  errorText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 14,
    color: "#69708A",
    lineHeight: 21,
  },

  retryButton: {
    marginTop: 24,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  backButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  backButtonText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 14,
  },

  blobTopLeft: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#E9EEFF",
    top: 55,
    left: -125,
    opacity: 0.85,
  },

  blobTopRight: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#EEE8FF",
    top: 120,
    right: -115,
    opacity: 0.75,
  },

  blobBottomLeft: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#EEF4FF",
    bottom: 15,
    left: -140,
    opacity: 0.8,
  },

  blobBottomRight: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#F1ECFF",
    bottom: -30,
    right: -105,
    opacity: 0.7,
  },

  header: {
    height: 66,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerBackButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B1545",
  },

  heroSection: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 18,
  },

  avatarWrapper: {
    position: "relative",
  },

  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },

  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
  },

  avatarFallbackText: {
    fontSize: 38,
    fontWeight: "700",
    color: "#2563EB",
  },

  heroOnlineDot: {
    position: "absolute",
    right: 3,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },

  fullName: {
    marginTop: 14,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "700",
    color: "#0B1545",
    textAlign: "center",
  },

  username: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "500",
    color: "#69708A",
  },

  statusPill: {
    marginTop: 10,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#F0F2FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },

  statusPillText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#315CEB",
  },

  primaryActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 2,
  },

  primaryActionCard: {
    flex: 1,
    height: 92,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 5,
  },

  primaryActionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryActionText: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "600",
    color: "#0B1545",
  },

  section: {
    marginTop: 18,
    paddingHorizontal: 20,
  },

  aboutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 17,
    shadowColor: "#2563EB",
    shadowOpacity: 0.055,
    shadowRadius: 13,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 5,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "700",
    color: "#0B1545",
  },

  bioText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#1D2A55",
  },

  emptyBio: {
    marginTop: 10,
    fontSize: 14,
    color: "#69708A",
  },

  aboutDivider: {
    height: 1,
    backgroundColor: "#EEF2FF",
    marginVertical: 13,
  },

  aboutInfoRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 2,
  },

  aboutInfoLabel: {
    marginLeft: 11,
    fontSize: 14,
    color: "#69708A",
    flex: 1,
  },

  aboutInfoValue: {
    marginLeft: 10,
    maxWidth: "48%",
    fontSize: 14,
    fontWeight: "600",
    color: "#0B1545",
    textAlign: "right",
  },

  mediaParentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingTop: 16,
    paddingBottom: 13,
    shadowColor: "#2563EB",
    shadowOpacity: 0.055,
    shadowRadius: 13,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 5,
    overflow: "hidden",
  },

  sectionHeaderRow: {
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  sectionHeaderTitle: {
    marginLeft: 9,
    fontSize: 18,
    fontWeight: "700",
    color: "#0B1545",
  },

  mediaViewAllButton: {
    paddingVertical: 5,
    paddingLeft: 12,
  },

  mediaViewAllText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "600",
  },

  mediaPreviewRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 13,
  },

  mediaPreviewButton: {
    flex: 1,
    minWidth: 0,
    aspectRatio: 1,
    borderRadius: 15,
    overflow: "hidden",
  },

  mediaPreviewTile: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderWidth: 1,
    borderColor: "#F0F2FA",
    borderRadius: 15,
    backgroundColor: "#FAFBFF",
  },

  mediaPreviewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },

  mediaPreviewFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#EEF4FF",
  },

  mediaPreviewText: {
    width: "100%",
    color: "#334155",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    textAlign: "center",
  },

  mediaLoading: {
    paddingVertical: 26,
  },

  noMediaMessages: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    color: "#69708A",
    fontSize: 14,
    textAlign: "center",
  },

  commonGroupsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: "#2563EB",
    shadowOpacity: 0.055,
    shadowRadius: 13,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 5,
  },

  countBadge: {
    marginLeft: 8,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },

  countBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },

  groupActionRow: {
    minHeight: 50,
    marginTop: 13,
    paddingHorizontal: 11,
    borderRadius: 13,
    backgroundColor: "#F0F3FF",
    flexDirection: "row",
    alignItems: "center",
  },

  groupActionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  groupActionText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "#315CEB",
  },

  groupRow: {
    minHeight: 59,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2FF",
    flexDirection: "row",
    alignItems: "center",
  },

  groupRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },

  groupRowContent: {
    flex: 1,
    marginLeft: 11,
  },

  groupName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0B1545",
  },

  groupSubtext: {
    marginTop: 2,
    fontSize: 12,
    color: "#69708A",
  },

  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
  },

  groupAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },

  noGroupsText: {
    paddingVertical: 14,
    textAlign: "center",
    fontSize: 13,
    color: "#69708A",
  },

  blockUserRow: {
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#DC2626",
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  blockUserRowDisabled: {
    opacity: 0.65,
  },

  blockUserText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#DC2626",
  },
});
