import { API_BASE_URL } from "@/src/services/api/apiClient";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthStore } from "@/src/store/auth/authStorage";
import {
  getAdminGroupDetails,
  getAdminGroupMessages,
} from "@/src/services/admin/adminService";
import { Message } from "@/src/types/chat.types";
import { useSocket } from "@/hooks/useSocket";

type MonitorTab = "MESSAGES" | "MEMBERS" | "DELETED" | "EDITED" | "SYSTEM";

export default function AdminGroupDetailsScreen() {
  const { groupId } = useLocalSearchParams<{
    groupId: string;
  }>();

  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<MonitorTab>("MESSAGES");

  const [showLatestButton, setShowLatestButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showInspector, setShowInspector] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { socketRef, connected } = useSocket();

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.sub;

  const hasAcceptedInvitation =
    group?.members?.some(
      (member: any) =>
        Number(member.userId) === Number(currentUserId) &&
        member.role === "ADMIN",
    ) ?? false;

  // ============================================================
  // DATA
  // ============================================================

  const fetchGroup = useCallback(async () => {
    try {
      setLoading(true);

      const details = await getAdminGroupDetails(Number(groupId));
      const groupMessages = await getAdminGroupMessages(Number(groupId));

      setGroup(details);
      setMessages(groupMessages);
    } catch (error) {
      console.log("ADMIN GROUP MONITOR ERROR:", error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const scheduleGroupRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      fetchGroup();
    }, 250);
  }, [fetchGroup]);

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const refreshGroup = ({ groupId: updatedGroupId }: any) => {
      if (Number(updatedGroupId) !== Number(groupId)) {
        return;
      }

      scheduleGroupRefresh();
    };

    socket.on("groupMembersUpdated", refreshGroup);
    socket.on("memberJoined", refreshGroup);
    socket.on("groupAvatarUpdated", refreshGroup);
    socket.on("adminInvitationAccepted", refreshGroup);
    socket.on("groupDescriptionUpdated", refreshGroup);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      socket.off("groupMembersUpdated", refreshGroup);
      socket.off("memberJoined", refreshGroup);
      socket.off("groupAvatarUpdated", refreshGroup);
      socket.off("adminInvitationAccepted", refreshGroup);
      socket.off("groupDescriptionUpdated", refreshGroup);
    };
  }, [connected, groupId, scheduleGroupRefresh]);

  // ============================================================
  // HELPERS
  // ============================================================

  const resolveMediaUrl = (mediaUrl?: string | null) => {
    if (!mediaUrl) return null;

    return mediaUrl.startsWith("http")
      ? mediaUrl
      : `${API_BASE_URL}${mediaUrl}`;
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
    });
  };

  const getDateLabel = (date: string) => {
    const messageDate = new Date(date);
    const today = new Date();

    const messageDay = new Date(
      messageDate.getFullYear(),
      messageDate.getMonth(),
      messageDate.getDate(),
    );

    const todayDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );

    const diff =
      (todayDay.getTime() - messageDay.getTime()) / (1000 * 60 * 60 * 24);

    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";

    return messageDate.toLocaleDateString([], {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatMessageTime = (date: string) =>
    new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const getMemberDisplayName = (member: any) => {
    return (
      `${member?.user?.firstName ?? ""} ${
        member?.user?.lastName ?? ""
      }`.trim() || "Unknown User"
    );
  };

  const getUsername = (member: any) => {
    return member?.user?.profile?.username
      ? `@${member.user.profile.username}`
      : "@unknown";
  };

  const getMessageSenderName = (message: any) => {
    return (
      `${message?.sender?.firstName ?? ""} ${
        message?.sender?.lastName ?? ""
      }`.trim() || "Unknown User"
    );
  };

  // ============================================================
  // MESSAGE FILTERING
  // ============================================================

  const filteredMessages = messages.filter((message: any) => {
    const query = searchQuery.trim().toLowerCase();

    const fullName = getMessageSenderName(message).toLowerCase();

    const username = message.sender?.profile?.username?.toLowerCase() ?? "";

    const content = message.messageContent?.toLowerCase() ?? "";

    const matchesSearch =
      !query ||
      fullName.includes(query) ||
      username.includes(query) ||
      content.includes(query);

    if (!matchesSearch) {
      return false;
    }

    switch (activeTab) {
      case "MESSAGES":
        return message.type === "GROUP";

      case "DELETED":
        return message.deletedForAll === true;

      case "EDITED":
        return !!message.editedAt;

      case "SYSTEM":
        return message.type === "SYSTEM";

      default:
        return true;
    }
  });

  const moderationStats = {
    totalMessages: messages.filter((message: any) => message.type === "GROUP")
      .length,

    deletedMessages: messages.filter((message: any) => message.deletedForAll)
      .length,

    editedMessages: messages.filter((message: any) => !!message.editedAt)
      .length,

    totalMembers: group?.memberCount ?? group?.members?.length ?? 0,

    createdDate: group?.createdAt
      ? new Date(group.createdAt).toLocaleDateString([], {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })
      : "-",
  };

  // ============================================================
  // SCROLL
  // ============================================================

  useEffect(() => {
    if (!isNearBottom || activeTab !== "MESSAGES") {
      return;
    }

    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({
        animated: true,
      });
    });
  }, [filteredMessages.length, isNearBottom, activeTab]);

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);

    setShowLatestButton(distanceFromBottom > 500);
    setIsNearBottom(distanceFromBottom < 200);
  };

  // ============================================================
  // HIGHLIGHT SEARCH
  // ============================================================

  const renderHighlightedText = (text?: string) => {
    if (!text) return null;

    const query = searchQuery.trim();

    if (!query) {
      return <Text style={styles.messageText}>{text}</Text>;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(`(${escapedQuery})`, "ig");
    const parts = text.split(regex);

    return (
      <Text style={styles.messageText}>
        {parts.map((part, index) => (
          <Text
            key={index}
            style={
              part.toLowerCase() === query.toLowerCase()
                ? styles.highlightText
                : undefined
            }
          >
            {part}
          </Text>
        ))}
      </Text>
    );
  };

  // ============================================================
  // SENDER GROUPING
  // ============================================================

  const shouldShowSenderHeader = (current: any, previous: any) => {
    if (!previous) return true;

    if (current.type !== "GROUP") return true;
    if (previous.type !== "GROUP") return true;

    if (current.senderId !== previous.senderId) {
      return true;
    }

    const diffMinutes =
      (new Date(current.createdAt).getTime() -
        new Date(previous.createdAt).getTime()) /
      (1000 * 60);

    return diffMinutes > 10;
  };

  // ============================================================
  // SYSTEM MESSAGE
  // ============================================================

  const getSystemMessageText = (message: any) => {
    const sender = message.sender?.profile?.username ?? "Someone";

    switch (message.groupSystemEvent) {
      case "MEMBER_ADDED":
        return `${sender} added ${
          message.targetUser?.profile?.username ?? "a member"
        }`;

      case "MEMBER_REMOVED":
        return `${sender} removed ${
          message.targetUser?.profile?.username ?? "a member"
        }`;

      case "MEMBER_LEFT":
        return `${sender} left`;

      case "GROUP_CREATED":
        return `${sender} created this group`;

      case "GROUP_RENAMED":
        return message.messageContent
          ? `${sender} renamed the group to "${message.messageContent}"`
          : `${sender} renamed the group`;

      case "GROUP_AVATAR_UPDATED":
        return `${sender} updated the group photo`;

      case "GROUP_AVATAR_REMOVED":
        return `${sender} removed the group photo`;

      case "GROUP_DESCRIPTION_CHANGED":
        return `${sender} updated the group description`;

      default:
        return message.messageContent || "Group activity";
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <View style={styles.loadingOrb}>
          <ActivityIndicator size="large" color={COLORS.purple} />
        </View>

        <Text style={styles.loadingText}>Loading group monitor...</Text>
      </SafeAreaView>
    );
  }

  // ============================================================
  // MAIN UI
  // ============================================================

  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative background */}
      <View pointerEvents="none" style={styles.backgroundDecoration}>
        <View style={styles.lavenderBlobTop} />
        <View style={styles.mintBlobTop} />
        <View style={styles.lavenderBlobBottom} />
        <View style={styles.mintBlobBottom} />
      </View>

      {/* ======================================================
          TOP NAVIGATION
      ======================================================= */}

      <View
        style={[
          styles.topBar,
          {
            paddingTop: Math.max(insets.top, 8),
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.topBarButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.navy} />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>Group Monitor</Text>

        <TouchableOpacity activeOpacity={0.8} style={styles.topBarButton}>
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.navy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: Math.max(insets.bottom, 28) + 70,
          },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ====================================================
            GROUP HERO
        ===================================================== */}

        <View style={styles.hero}>
          <View style={styles.groupAvatarWrapper}>
            {group?.avatarUrl ? (
              <Image
                source={{
                  uri: resolveMediaUrl(group.avatarUrl)!,
                }}
                style={styles.groupAvatar}
              />
            ) : (
              <View style={styles.groupAvatarPlaceholder}>
                <Text style={styles.groupAvatarLetter}>
                  {group?.name?.charAt(0)?.toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={17} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.groupName}>{group?.name}</Text>

          <View style={styles.descriptionPill}>
            <Text numberOfLines={2} style={styles.descriptionText}>
              {group?.description || "No description"}
            </Text>

            <Ionicons name="pencil-outline" size={14} color={COLORS.muted} />
          </View>
        </View>

        {/* ====================================================
            SUMMARY CARD
        ===================================================== */}

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Creator</Text>

            <View style={styles.creatorSummaryRow}>
              <View style={styles.creatorMiniAvatar}>
                <Text style={styles.creatorMiniLetter}>
                  {group?.createdBy?.firstName?.charAt(0)?.toUpperCase() ?? "A"}
                </Text>
              </View>

              <View>
                <Text numberOfLines={1} style={styles.summaryValue}>
                  @{group?.createdBy?.profile?.username}
                </Text>

                <View style={styles.adminPill}>
                  <Text style={styles.adminPillText}>Admin</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Members</Text>

            <View style={styles.summaryMetricRow}>
              <View style={styles.metricIconPurple}>
                <Ionicons
                  name="people-outline"
                  size={18}
                  color={COLORS.purple}
                />
              </View>

              <View>
                <Text style={styles.summaryNumber}>
                  {moderationStats.totalMembers}
                </Text>

                <Text style={styles.summarySubtext}>Total</Text>
              </View>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Messages</Text>

            <View style={styles.summaryMetricRow}>
              <View style={styles.metricIconMint}>
                <Ionicons
                  name="chatbubble-outline"
                  size={18}
                  color={COLORS.mintDark}
                />
              </View>

              <View>
                <Text style={styles.summaryNumber}>{messages.length}</Text>

                <Text style={styles.summarySubtext}>Total</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ====================================================
            OPEN CONVERSATION
        ===================================================== */}

        {hasAcceptedInvitation && (
          <TouchableOpacity
            activeOpacity={0.86}
            style={styles.openConversationButton}
            onPress={() =>
              router.push({
                pathname: "/groups/[groupId]" as any,
                params: {
                  groupId: String(groupId),
                  adminMode: "true",
                },
              })
            }
          >
            <View style={styles.openConversationIcon}>
              <Ionicons
                name="chatbubbles-outline"
                size={19}
                color={COLORS.purple}
              />
            </View>

            <View style={styles.openConversationTextWrap}>
              <Text style={styles.openConversationTitle}>
                Open Conversation
              </Text>

              <Text style={styles.openConversationSubtitle}>
                View the live group chat
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </TouchableOpacity>
        )}

        {/* ====================================================
            MONITOR PANEL
        ===================================================== */}

        <View style={styles.monitorPanel}>
          {/* Tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabRow}
          >
            <MonitorTabButton
              icon="chatbubble"
              label="Messages"
              active={activeTab === "MESSAGES"}
              onPress={() => setActiveTab("MESSAGES")}
            />

            <MonitorTabButton
              icon="people-outline"
              label="Members"
              active={activeTab === "MEMBERS"}
              onPress={() => setActiveTab("MEMBERS")}
            />

            <MonitorTabButton
              icon="trash-outline"
              label="Deleted"
              active={activeTab === "DELETED"}
              onPress={() => setActiveTab("DELETED")}
            />

            <MonitorTabButton
              icon="create-outline"
              label="Edited"
              active={activeTab === "EDITED"}
              onPress={() => setActiveTab("EDITED")}
            />

            <MonitorTabButton
              icon="settings-outline"
              label="System"
              active={activeTab === "SYSTEM"}
              onPress={() => setActiveTab("SYSTEM")}
            />
          </ScrollView>

          {/* ==================================================
              SEARCH
          =================================================== */}

          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={21} color={COLORS.muted} />

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search messages, members or @username..."
              placeholderTextColor="#9A9BA8"
              style={styles.searchInput}
              returnKeyType="search"
            />

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.searchFilterButton}
            >
              <Ionicons name="options-outline" size={20} color={COLORS.navy} />
            </TouchableOpacity>
          </View>

          {/* ==================================================
              MONITOR STATS
          =================================================== */}

          <View style={styles.monitorStatsCard}>
            <MonitorStat
              value={moderationStats.totalMessages}
              label="Messages"
            />

            <MonitorStat
              value={moderationStats.deletedMessages}
              label="Deleted"
            />

            <MonitorStat
              value={moderationStats.editedMessages}
              label="Edited"
            />

            <MonitorStat value={moderationStats.totalMembers} label="Members" />

            <MonitorStat
              value={moderationStats.createdDate}
              label="Created"
              compact
            />
          </View>

          {/* ==================================================
              MEMBERS
          =================================================== */}

          {activeTab === "MEMBERS" && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Members ({group?.memberCount ?? 0})
                </Text>

                <Text style={styles.sectionCaption}>Group participants</Text>
              </View>

              <View style={styles.membersGrid}>
                {group?.members?.map((member: any) => {
                  const avatarUrl = member.user.profile?.avatarUrl;

                  const isCreator = member.role === "CREATOR";

                  return (
                    <TouchableOpacity
                      key={member.id}
                      activeOpacity={0.84}
                      style={styles.memberCard}
                      onPress={() =>
                        router.push({
                          pathname: "/profile/[userId]",
                          params: {
                            userId: String(member.user.id),
                          },
                        })
                      }
                    >
                      <View style={styles.memberAvatarWrap}>
                        {avatarUrl ? (
                          <Image
                            source={{
                              uri: resolveMediaUrl(avatarUrl)!,
                            }}
                            style={styles.memberAvatar}
                          />
                        ) : (
                          <View style={styles.memberAvatarPlaceholder}>
                            <Text style={styles.memberAvatarLetter}>
                              {member.user.firstName?.charAt(0)?.toUpperCase()}
                            </Text>
                          </View>
                        )}

                        {isCreator && (
                          <View style={styles.memberAdminDot}>
                            <Ionicons
                              name="checkmark"
                              size={10}
                              color="#FFFFFF"
                            />
                          </View>
                        )}
                      </View>

                      <Text numberOfLines={1} style={styles.memberName}>
                        {getMemberDisplayName(member)}
                      </Text>

                      <Text numberOfLines={1} style={styles.memberUsername}>
                        {getUsername(member)}
                      </Text>

                      <View
                        style={[
                          styles.memberRoleBadge,
                          isCreator
                            ? styles.memberAdminBadge
                            : styles.memberNormalBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.memberRoleText,
                            isCreator
                              ? styles.memberAdminText
                              : styles.memberNormalText,
                          ]}
                        >
                          {isCreator ? "Admin" : "Member"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ==================================================
              MESSAGES
          =================================================== */}

          {activeTab !== "MEMBERS" && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Messages</Text>

                <Text style={styles.sectionCaption}>
                  {filteredMessages.length}{" "}
                  {filteredMessages.length === 1 ? "result" : "results"}
                </Text>
              </View>

              {filteredMessages.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={30}
                      color={COLORS.purple}
                    />
                  </View>

                  <Text style={styles.emptyTitle}>No messages found</Text>

                  <Text style={styles.emptyText}>
                    {searchQuery
                      ? "Try changing your search or filter."
                      : "There are no messages in this category yet."}
                  </Text>
                </View>
              ) : (
                filteredMessages.map((message: any, index: number) => {
                  /*
                   * IMPORTANT:
                   * Compare against filteredMessages, not
                   * messages. This prevents sender grouping
                   * from breaking when a filter is active.
                   */
                  const previousMessage =
                    index > 0 ? filteredMessages[index - 1] : null;

                  const showSenderHeader = shouldShowSenderHeader(
                    message,
                    previousMessage,
                  );

                  const showDateSeparator =
                    !previousMessage ||
                    getDateLabel(previousMessage.createdAt) !==
                      getDateLabel(message.createdAt);

                  if (message.type === "SYSTEM") {
                    return (
                      <View key={message.id}>
                        {showDateSeparator && (
                          <DateSeparator
                            label={getDateLabel(message.createdAt)}
                          />
                        )}

                        <View style={styles.systemMessageContainer}>
                          <View style={styles.systemIcon}>
                            <Ionicons
                              name="information-circle-outline"
                              size={15}
                              color={COLORS.purple}
                            />
                          </View>

                          <Text style={styles.systemMessageText}>
                            {getSystemMessageText(message)}
                          </Text>
                        </View>
                      </View>
                    );
                  }

                  const isCreator = message.senderId === group?.createdById;

                  return (
                    <View key={message.id}>
                      {showDateSeparator && (
                        <DateSeparator
                          label={getDateLabel(message.createdAt)}
                        />
                      )}

                      <View
                        style={[
                          styles.messageWrapper,
                          isCreator
                            ? styles.creatorMessageWrapper
                            : styles.memberMessageWrapper,
                        ]}
                      >
                        {/* Avatar */}
                        {showSenderHeader ? (
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() =>
                              router.push({
                                pathname: "/profile/[userId]",
                                params: {
                                  userId: String(message.sender?.id),
                                },
                              })
                            }
                          >
                            {message.sender?.profile?.avatarUrl ? (
                              <Image
                                source={{
                                  uri: resolveMediaUrl(
                                    message.sender.profile.avatarUrl,
                                  )!,
                                }}
                                style={styles.messageAvatar}
                              />
                            ) : (
                              <View style={styles.messageAvatarPlaceholder}>
                                <Text style={styles.messageAvatarLetter}>
                                  {message.sender?.firstName
                                    ?.charAt(0)
                                    ?.toUpperCase()}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.avatarSpacer} />
                        )}

                        {/* Message bubble */}
                        <TouchableOpacity
                          activeOpacity={0.96}
                          delayLongPress={300}
                          onLongPress={() => {
                            setSelectedMessage(message);
                            setShowInspector(true);
                          }}
                          style={[
                            styles.messageBubble,
                            isCreator
                              ? styles.creatorBubble
                              : styles.memberBubble,
                          ]}
                        >
                          {showSenderHeader && (
                            <View style={styles.senderRow}>
                              <Text style={styles.senderName}>
                                {getMessageSenderName(message)}
                              </Text>

                              <Text style={styles.senderUsername}>
                                @{message.sender?.profile?.username}
                              </Text>

                              {isCreator && (
                                <View style={styles.creatorBadge}>
                                  <Text style={styles.creatorBadgeText}>
                                    CREATOR
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          {/* Status */}
                          {(message.deletedForAll || message.editedAt) && (
                            <View style={styles.statusRow}>
                              {message.deletedForAll && (
                                <View style={styles.deletedBadge}>
                                  <Ionicons
                                    name="trash-outline"
                                    size={11}
                                    color={COLORS.danger}
                                  />

                                  <Text style={styles.deletedBadgeText}>
                                    DELETED
                                  </Text>
                                </View>
                              )}

                              {message.editedAt && !message.deletedForAll && (
                                <View style={styles.editedBadge}>
                                  <Ionicons
                                    name="create-outline"
                                    size={11}
                                    color={COLORS.warning}
                                  />

                                  <Text style={styles.editedBadgeText}>
                                    EDITED
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          {/* Reply */}
                          {message.replyTo && (
                            <View style={styles.replyCompact}>
                              <Text
                                numberOfLines={1}
                                style={styles.replyCompactSender}
                              >
                                ↪ {message.replyTo.sender?.profile?.username}
                              </Text>

                              <Text
                                numberOfLines={1}
                                style={styles.replyCompactMessage}
                              >
                                {message.replyTo.messageContent ||
                                  "(Attachment)"}
                              </Text>
                            </View>
                          )}

                          {/* IMAGE */}
                          {message.contentType === "IMAGE" &&
                            message.mediaUrl && (
                              <Image
                                source={{
                                  uri: resolveMediaUrl(message.mediaUrl)!,
                                }}
                                style={styles.messageImage}
                              />
                            )}

                          {/* VIDEO / AUDIO / FILE */}
                          {message.contentType !== "TEXT" &&
                            message.contentType !== "IMAGE" && (
                              <View style={styles.fileCard}>
                                <View style={styles.fileIcon}>
                                  <Ionicons
                                    name={
                                      message.contentType === "VIDEO"
                                        ? "videocam-outline"
                                        : message.contentType === "AUDIO"
                                          ? "musical-notes-outline"
                                          : "document-outline"
                                    }
                                    size={22}
                                    color={COLORS.purple}
                                  />
                                </View>

                                <View style={styles.fileInfo}>
                                  <Text style={styles.fileTitle}>
                                    {message.contentType === "VIDEO"
                                      ? "Video"
                                      : message.contentType === "AUDIO"
                                        ? "Audio"
                                        : "File"}
                                  </Text>

                                  {!!message.fileName && (
                                    <Text
                                      numberOfLines={1}
                                      style={styles.fileName}
                                    >
                                      {message.fileName}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            )}

                          {/* Text */}
                          {!!message.messageContent &&
                            renderHighlightedText(message.messageContent)}

                          {/* Deleted audit */}
                          {message.deletedForAll && (
                            <View style={styles.deletedAudit}>
                              <View style={styles.deletedAuditHeader}>
                                <Ionicons
                                  name="trash-outline"
                                  size={14}
                                  color={COLORS.danger}
                                />

                                <Text style={styles.deletedAuditTitle}>
                                  Deleted for everyone
                                </Text>
                              </View>

                              <Text style={styles.deletedAuditBy}>
                                By @
                                {message.deletedBy?.profile?.username ??
                                  "unknown"}
                              </Text>

                              {!!message.messageContent && (
                                <Text style={styles.deletedOriginal}>
                                  &quot;{message.messageContent}&quot;
                                </Text>
                              )}

                              <View style={styles.deletedTimeRow}>
                                <Text style={styles.deletedTimeLabel}>
                                  Original
                                </Text>

                                <Text style={styles.deletedTimeValue}>
                                  {formatTime(message.createdAt)}
                                </Text>
                              </View>

                              {message.deletedAt && (
                                <View style={styles.deletedTimeRow}>
                                  <Text style={styles.deletedTimeLabel}>
                                    Deleted
                                  </Text>

                                  <Text style={styles.deletedTimeValue}>
                                    {formatTime(message.deletedAt)}
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={styles.messageFooter}>
                            <Text style={styles.messageTime}>
                              {formatMessageTime(message.createdAt)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ======================================================
          LATEST MESSAGE BUTTON
      ======================================================= */}

      {showLatestButton && activeTab !== "MEMBERS" && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.latestButton,
            {
              bottom: Math.max(insets.bottom, 10) + 18,
            },
          ]}
          onPress={() => {
            scrollViewRef.current?.scrollToEnd({
              animated: true,
            });
          }}
        >
          <Ionicons name="arrow-down" size={21} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* ======================================================
          MESSAGE INSPECTOR
      ======================================================= */}

      <Modal
        visible={showInspector}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInspector(false)}
      >
        <Pressable
          style={styles.inspectorOverlay}
          onPress={() => setShowInspector(false)}
        >
          <Pressable style={styles.inspectorSheet}>
            <View style={styles.inspectorHandle} />

            <View style={styles.inspectorHeader}>
              <View>
                <Text style={styles.inspectorTitle}>Message Inspector</Text>

                <Text style={styles.inspectorSubtitle}>
                  Administrative message details
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.inspectorClose}
                onPress={() => setShowInspector(false)}
              >
                <Ionicons name="close" size={20} color={COLORS.navy} />
              </TouchableOpacity>
            </View>

            <InspectorItem
              label="Message ID"
              value={selectedMessage?.id ? String(selectedMessage.id) : "-"}
            />

            <InspectorItem
              label="Sender"
              value={
                selectedMessage ? getMessageSenderName(selectedMessage) : "-"
              }
            />

            <InspectorItem
              label="Username"
              value={
                selectedMessage?.sender?.profile?.username
                  ? `@${selectedMessage.sender.profile.username}`
                  : "-"
              }
            />

            <InspectorItem
              label="User ID"
              value={
                selectedMessage?.sender?.id
                  ? String(selectedMessage.sender.id)
                  : "-"
              }
            />

            <InspectorItem
              label="Group ID"
              value={
                selectedMessage?.groupId ? String(selectedMessage.groupId) : "-"
              }
            />

            <InspectorItem
              label="Type"
              value={selectedMessage?.type ? String(selectedMessage.type) : "-"}
            />

            <InspectorItem
              label="Content Type"
              value={
                selectedMessage?.contentType
                  ? String(selectedMessage.contentType)
                  : "-"
              }
            />

            <InspectorItem
              label="Created"
              value={
                selectedMessage?.createdAt
                  ? new Date(selectedMessage.createdAt).toLocaleString()
                  : "-"
              }
            />

            <InspectorItem
              label="Edited"
              value={
                selectedMessage?.editedAt
                  ? new Date(selectedMessage.editedAt).toLocaleString()
                  : "Never"
              }
            />

            <InspectorItem
              label="Deleted"
              value={
                selectedMessage?.deletedAt
                  ? new Date(selectedMessage.deletedAt).toLocaleString()
                  : "No"
              }
            />

            <InspectorItem
              label="Deleted By"
              value={
                selectedMessage?.deletedBy?.profile?.username
                  ? `@${selectedMessage.deletedBy.profile.username}`
                  : "N/A"
              }
            />

            <InspectorItem
              label="Reply To"
              value={
                selectedMessage?.replyTo?.id
                  ? String(selectedMessage.replyTo.id)
                  : "None"
              }
            />

            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.closeInspectorButton}
              onPress={() => setShowInspector(false)}
            >
              <Text style={styles.closeInspectorText}>Close Inspector</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ================================================================
   SMALL COMPONENTS
================================================================ */

function MonitorTabButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.tabButton, active && styles.activeTabButton]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={active ? COLORS.purple : COLORS.navy}
      />

      <Text style={[styles.tabText, active && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MonitorStat({
  value,
  label,
  compact = false,
}: {
  value: string | number;
  label: string;
  compact?: boolean;
}) {
  return (
    <View style={styles.monitorStat}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[
          styles.monitorStatValue,
          compact && styles.monitorStatCompactValue,
        ]}
      >
        {value}
      </Text>

      <Text style={styles.monitorStatLabel}>{label}</Text>
    </View>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSeparatorContainer}>
      <View style={styles.dateSeparator}>
        <Text style={styles.dateSeparatorText}>{label}</Text>
      </View>
    </View>
  );
}

function InspectorItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inspectorItem}>
      <Text style={styles.inspectorLabel}>{label}</Text>

      <Text numberOfLines={2} style={styles.inspectorValue}>
        {value}
      </Text>
    </View>
  );
}

/* ================================================================
   COLORS
================================================================ */

const COLORS = {
  background: "#F8F8FC",
  white: "#FFFFFF",

  navy: "#151B3D",
  navySoft: "#2C3150",

  purple: "#6751E8",
  purpleDark: "#5942D7",
  purpleSoft: "#EEEAFE",

  lavender: "#F0EDFF",

  mint: "#42D9A5",
  mintDark: "#20B982",
  mintSoft: "#E4FAF1",

  muted: "#8B8E9E",
  border: "#ECECF2",

  danger: "#E45868",
  dangerSoft: "#FDECEF",

  warning: "#C98A2E",
  warningSoft: "#FFF5DF",
};

/* ================================================================
   STYLES
================================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  loadingText: {
    color: COLORS.muted,
    fontSize: 14,
  },

  /* ==========================================================
     BACKGROUND DECORATION
  ========================================================== */

  backgroundDecoration: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  lavenderBlobTop: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#EFECFF",
    top: -175,
    left: -110,
  },

  mintBlobTop: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#BDF4E2",
    top: 220,
    right: 28,
  },

  lavenderBlobBottom: {
    position: "absolute",
    width: 310,
    height: 310,
    borderRadius: 155,
    backgroundColor: "#F0EBFF",
    right: -190,
    bottom: 180,
  },

  mintBlobBottom: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#E6FAF3",
    left: -110,
    bottom: 40,
  },

  /* ==========================================================
     TOP BAR
  ========================================================== */

  topBar: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    backgroundColor: "rgba(248,248,252,0.96)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },

  topBarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 2,
  },

  topBarTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.navy,
    letterSpacing: -0.4,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
  },

  /* ==========================================================
     HERO
  ========================================================== */

  hero: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24,
  },

  groupAvatarWrapper: {
    position: "relative",
    marginBottom: 18,
  },

  groupAvatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 4,
    borderColor: COLORS.white,
  },

  groupAvatarPlaceholder: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: COLORS.purple,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: COLORS.white,
  },

  groupAvatarLetter: {
    fontSize: 42,
    fontWeight: "800",
    color: COLORS.white,
  },

  verifiedBadge: {
    position: "absolute",
    right: -2,
    bottom: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.mint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.background,
  },

  groupName: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: "800",
    color: COLORS.navy,
    textAlign: "center",
    letterSpacing: -0.8,
  },

  descriptionPill: {
    marginTop: 11,
    minHeight: 38,
    maxWidth: "90%",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  descriptionText: {
    color: COLORS.muted,
    fontSize: 14,
    flexShrink: 1,
  },

  /* ==========================================================
     SUMMARY
  ========================================================== */

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 25,
    paddingVertical: 18,
    paddingHorizontal: 14,
    flexDirection: "row",

    shadowColor: "#45405E",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 3,
  },

  summaryItem: {
    flex: 1,
    minWidth: 0,
  },

  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
    marginHorizontal: 9,
  },

  summaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginBottom: 9,
  },

  summaryValue: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "800",
    maxWidth: "100%",
  },

  creatorSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  creatorMiniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  creatorMiniLetter: {
    color: COLORS.purple,
    fontWeight: "800",
    fontSize: 14,
  },

  adminPill: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.mintSoft,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
  },

  adminPillText: {
    color: COLORS.mintDark,
    fontSize: 9,
    fontWeight: "800",
  },

  summaryMetricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  metricIconPurple: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  metricIconMint: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.mintSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryNumber: {
    color: COLORS.navy,
    fontSize: 18,
    fontWeight: "800",
  },

  summarySubtext: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 1,
  },

  /* ==========================================================
     OPEN CONVERSATION
  ========================================================== */

  openConversationButton: {
    marginTop: 14,
    padding: 13,
    borderRadius: 18,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",

    shadowColor: "#45405E",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 1,
  },

  openConversationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  openConversationTextWrap: {
    flex: 1,
    marginLeft: 11,
  },

  openConversationTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: "800",
  },

  openConversationSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },

  /* ==========================================================
     MONITOR PANEL
  ========================================================== */

  monitorPanel: {
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 27,
    paddingTop: 5,
    paddingBottom: 16,

    shadowColor: "#45405E",
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 2,
  },

  tabRow: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 3,
  },

  tabButton: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  activeTabButton: {
    backgroundColor: COLORS.purpleSoft,
  },

  tabText: {
    color: COLORS.navySoft,
    fontSize: 12,
    fontWeight: "700",
  },

  activeTabText: {
    color: COLORS.purple,
  },

  /* ==========================================================
     SEARCH
  ========================================================== */

  searchContainer: {
    marginHorizontal: 12,
    marginTop: 10,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#F8F8FB",
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    marginLeft: 9,
    color: COLORS.navy,
    fontSize: 13,
  },

  searchFilterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ==========================================================
     STATS
  ========================================================== */

  monitorStatsCard: {
    marginHorizontal: 12,
    marginTop: 12,
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    flexDirection: "row",
  },

  monitorStat: {
    flex: 1,
    alignItems: "center",
  },

  monitorStatValue: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: "800",
  },

  monitorStatCompactValue: {
    fontSize: 11,
  },

  monitorStatLabel: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 4,
  },

  /* ==========================================================
     SECTION
  ========================================================== */

  sectionContainer: {
    paddingHorizontal: 12,
    paddingTop: 20,
  },

  sectionHeader: {
    marginBottom: 14,
  },

  sectionTitle: {
    color: COLORS.navy,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },

  sectionCaption: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },

  /* ==========================================================
     MEMBERS
  ========================================================== */

  membersGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },

  memberCard: {
    width: "48%",
    backgroundColor: COLORS.white,
    borderRadius: 19,
    padding: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  memberAvatarWrap: {
    position: "relative",
    marginBottom: 9,
  },

  memberAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },

  memberAvatarPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.mint,
    alignItems: "center",
    justifyContent: "center",
  },

  memberAvatarLetter: {
    color: COLORS.white,
    fontSize: 23,
    fontWeight: "800",
  },

  memberAdminDot: {
    position: "absolute",
    right: -2,
    bottom: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.purple,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },

  memberName: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: "800",
    maxWidth: "100%",
  },

  memberUsername: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },

  memberRoleBadge: {
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 9,
  },

  memberAdminBadge: {
    backgroundColor: COLORS.mintSoft,
  },

  memberNormalBadge: {
    backgroundColor: "#F1F1F5",
  },

  memberRoleText: {
    fontSize: 9,
    fontWeight: "800",
  },

  memberAdminText: {
    color: COLORS.mintDark,
  },

  memberNormalText: {
    color: COLORS.muted,
  },

  /* ==========================================================
     DATE
  ========================================================== */

  dateSeparatorContainer: {
    alignItems: "center",
    marginVertical: 17,
  },

  dateSeparator: {
    backgroundColor: COLORS.purpleSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  dateSeparatorText: {
    color: COLORS.purpleDark,
    fontSize: 10,
    fontWeight: "700",
  },

  /* ==========================================================
     SYSTEM
  ========================================================== */

  systemMessageContainer: {
    alignSelf: "center",
    maxWidth: "90%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F2F8",
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 13,
  },

  systemIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },

  systemMessageText: {
    color: COLORS.muted,
    fontSize: 11,
    textAlign: "center",
    flexShrink: 1,
  },

  /* ==========================================================
     MESSAGES
  ========================================================== */

  messageWrapper: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 13,
  },

  creatorMessageWrapper: {
    justifyContent: "flex-end",
  },

  memberMessageWrapper: {
    justifyContent: "flex-start",
  },

  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 2,
  },

  messageAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 2,
    backgroundColor: COLORS.mint,
    alignItems: "center",
    justifyContent: "center",
  },

  messageAvatarLetter: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },

  avatarSpacer: {
    width: 40,
  },

  messageBubble: {
    maxWidth: "87%",
    borderRadius: 19,
    paddingHorizontal: 13,
    paddingVertical: 10,

    shadowColor: "#45405E",
    shadowOpacity: 0.045,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },

    elevation: 1,
  },

  creatorBubble: {
    backgroundColor: "#EEEAFE",
    borderBottomRightRadius: 6,
  },

  memberBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 7,
  },

  senderName: {
    color: "#177E72",
    fontSize: 13,
    fontWeight: "800",
  },

  senderUsername: {
    color: COLORS.muted,
    fontSize: 10,
    marginLeft: 6,
  },

  creatorBadge: {
    backgroundColor: COLORS.mintSoft,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },

  creatorBadgeText: {
    color: COLORS.mintDark,
    fontSize: 7,
    fontWeight: "900",
  },

  statusRow: {
    flexDirection: "row",
    marginBottom: 7,
    gap: 5,
  },

  deletedBadge: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  deletedBadgeText: {
    color: COLORS.danger,
    fontSize: 8,
    fontWeight: "800",
  },

  editedBadge: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  editedBadgeText: {
    color: COLORS.warning,
    fontSize: 8,
    fontWeight: "800",
  },

  messageText: {
    color: COLORS.navySoft,
    fontSize: 13,
    lineHeight: 20,
  },

  highlightText: {
    backgroundColor: "#FFE39A",
    color: COLORS.navy,
    fontWeight: "800",
  },

  messageFooter: {
    alignItems: "flex-end",
    marginTop: 5,
  },

  messageTime: {
    color: COLORS.muted,
    fontSize: 9,
  },

  /* ==========================================================
     REPLY
  ========================================================== */

  replyCompact: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.purple,
    backgroundColor: "#F6F4FE",
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 7,
    marginBottom: 7,
  },

  replyCompactSender: {
    color: COLORS.purpleDark,
    fontSize: 9,
    fontWeight: "800",
  },

  replyCompactMessage: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 2,
  },

  /* ==========================================================
     MEDIA
  ========================================================== */

  messageImage: {
    width: 230,
    height: 240,
    borderRadius: 14,
    marginBottom: 7,
  },

  fileCard: {
    backgroundColor: COLORS.purpleSoft,
    borderRadius: 13,
    padding: 10,
    marginBottom: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  fileIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },

  fileInfo: {
    flex: 1,
    marginLeft: 9,
  },

  fileTitle: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "800",
  },

  fileName: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 3,
  },

  /* ==========================================================
     DELETED AUDIT
  ========================================================== */

  deletedAudit: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },

  deletedAuditHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  deletedAuditTitle: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: "800",
  },

  deletedAuditBy: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 3,
  },

  deletedOriginal: {
    color: COLORS.muted,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 7,
    marginBottom: 5,
  },

  deletedTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },

  deletedTimeLabel: {
    color: COLORS.muted,
    fontSize: 8,
  },

  deletedTimeValue: {
    color: COLORS.navySoft,
    fontSize: 8,
    fontWeight: "700",
  },

  /* ==========================================================
     EMPTY
  ========================================================== */

  emptyState: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: COLORS.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: "800",
  },

  emptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
  },

  /* ==========================================================
     LATEST BUTTON
  ========================================================== */

  latestButton: {
    position: "absolute",
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.mintDark,
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 5,
  },

  /* ==========================================================
     INSPECTOR
  ========================================================== */

  inspectorOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17,20,43,0.42)",
  },

  inspectorSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    maxHeight: "88%",
  },

  inspectorHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D9D9E2",
    alignSelf: "center",
    marginBottom: 17,
  },

  inspectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  inspectorTitle: {
    color: COLORS.navy,
    fontSize: 21,
    fontWeight: "800",
  },

  inspectorSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },

  inspectorClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.purpleSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  inspectorItem: {
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },

  inspectorLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginBottom: 3,
  },

  inspectorValue: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "700",
  },

  closeInspectorButton: {
    marginTop: 18,
    backgroundColor: COLORS.purple,
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: "center",
  },

  closeInspectorText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
});
