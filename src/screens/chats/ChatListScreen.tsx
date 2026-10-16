import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Modal,
  Pressable,
  Image,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useState, useCallback, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { getConversations } from "@/src/services/chat/chatService";
import { Conversation } from "@/src/types/chat.types";
import { useSocket } from "@/hooks/useSocket";
import { useTypingStore } from "@/src/store/chat/typingStore";
import { API_BASE_URL } from "@/src/services/api/apiClient";
import { useAuthStore } from "@/src/store/auth/authStorage";
import { getMyNotifications } from "@/src/services/notifications/notificationService";
import { getMyProfile, Profile } from "@/src/services/profile/profileService";
import {
  getMyGroups,
  deleteMyGroupChats,
} from "@/src/services/group/groupService";
import { getMyChatRequest } from "@/src/services/chatRequest/chatRequestService";
import {
  useDraftStore,
  getDirectDraftKey,
  getGroupDraftKey,
} from "@/src/store/chat/draftStore";

const ACCENT = "#2563EB";

const formatTime12Hour = (timestamp?: string | number | Date | null) => {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

export default function ChatListScreen() {
  const { socketRef, connected } = useSocket();

  const [chats, setChats] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [deletingGroups, setDeletingGroups] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "all" | "unread" | "groups" | "requests"
  >("all");

  const typingUsers = useTypingStore((state) => state.typingUsers);
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.sub;

  const drafts = useDraftStore((state) => state.drafts);
  const clearDraft = useDraftStore((state) => state.clearDraft);

  const fetchChats = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getConversations();

      setChats(data || []);
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await getMyGroups();

      setGroups(data || []);
    } catch (error) {
      console.log("Error fetching groups:", error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const notifications = await getMyNotifications();

      setNotificationCount(notifications.filter((n: any) => !n.isRead).length);
    } catch (error) {
      console.log("Notification fetch error:", error);
    }
  }, []);

  const fetchRequestCount = useCallback(async () => {
    try {
      const data = await getMyChatRequest();

      const count = data.requests.filter(
        (request: any) =>
          request.receiverId === data.currentUserId &&
          request.status === "PENDING",
      ).length;

      setRequestCount(count);
    } catch (error) {
      console.log("Request count error:", error);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await getMyProfile();
      setMyProfile(profile);
    } catch (error) {
      console.log("Profile fetch error:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchChats();
      fetchGroups();
      fetchNotifications();
      fetchRequestCount();
      fetchProfile();
    }, [
      fetchChats,
      fetchGroups,
      fetchNotifications,
      fetchRequestCount,
      fetchProfile,
    ]),
  );

  useEffect(() => {
    console.log("ChatListScreen socket:", socketRef.current?.id);
  }, [connected]);

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const handleUpdate = () => {
      fetchChats();
      fetchGroups();
    };

    const handleGroupMessage = () => {
      fetchGroups();
    };

    const handleDeletedForMe = ({
      userId,
    }: {
      messageIds: number[];
      userId: number;
    }) => {
      if (Number(userId) !== Number(currentUserId)) {
        return;
      }

      fetchChats();
    };

    const handleDeletedForEveryone = ({
      messageIds,
      deletedById,
    }: {
      messageIds: number[];
      deletedById: number;
    }) => {
      fetchChats();
    };

    const handleTypingStart = ({ fromUserId }: { fromUserId: number }) => {
      useTypingStore.getState().setTyping(fromUserId, true);
    };

    const handleTypingStop = ({ fromUserId }: { fromUserId: number }) => {
      useTypingStore.getState().setTyping(fromUserId, false);
    };

    socket.on("messagesRead", handleUpdate);
    socket.on("newMessage", handleUpdate);
    socket.on("message:delivered", handleUpdate);
    socket.on("conversationRead", handleUpdate);
    socket.on("newGroupMessage", handleGroupMessage);

    socket.on("directMessagesDeletedForMe", handleDeletedForMe);
    socket.on("directMessagesDeletedForEveryone", handleDeletedForEveryone);

    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("messagesRead", handleUpdate);
      socket.off("newMessage", handleUpdate);
      socket.off("message:delivered", handleUpdate);
      socket.off("conversationRead", handleUpdate);
      socket.off("newGroupMessage", handleGroupMessage);

      socket.off("directMessagesDeletedForMe", handleDeletedForMe);
      socket.off("directMessagesDeletedForEveryone", handleDeletedForEveryone);

      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [connected, fetchChats, fetchGroups, socketRef, currentUserId]);

  const unreadConversationCount =
    chats.filter((chat) => chat.unreadCount > 0).length +
    groups.filter((group) => group.group.unreadCount > 0).length;

  const filteredChats =
    activeTab === "unread"
      ? chats.filter((chat) => chat.unreadCount > 0)
      : activeTab === "groups"
        ? groups
        : chats;

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  };

  const confirmDeleteSelectedGroups = () => {
    if (selectedGroupIds.length === 0 || deletingGroups) return;

    const groupIds = [...selectedGroupIds];
    const count = groupIds.length;

    Alert.alert(
      count === 1 ? "Delete group chat?" : `Delete ${count} group chats?`,
      "This removes the selected chat and its visible history for you. Other members keep the group and its messages. A group may reappear if it receives new messages.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingGroups(true);

            try {
              await deleteMyGroupChats(groupIds);
              setGroups((current) =>
                current.filter(
                  (item) => !groupIds.includes(Number(item.group.id)),
                ),
              );
              if (Number.isInteger(Number(currentUserId))) {
                groupIds.forEach((groupId) =>
                  clearDraft(getGroupDraftKey(Number(currentUserId), groupId)),
                );
              }
              setSelectedGroupIds([]);
            } catch (error: any) {
              console.log("Delete group chats error:", error);
              Alert.alert(
                "Unable to delete group chats",
                error?.message || "Please try again.",
              );
            } finally {
              setDeletingGroups(false);
            }
          },
        },
      ],
    );
  };

  const renderReceipt = (status?: "SENT" | "DELIVERED" | "READ") => {
    if (!status) {
      return null;
    }

    if (status === "SENT") {
      return (
        <Ionicons
          name="checkmark"
          size={16}
          color="#69708A"
          style={styles.receiptIcon}
        />
      );
    }

    if (status === "DELIVERED") {
      return (
        <Ionicons
          name="checkmark-done"
          size={16}
          color="#69708A"
          style={styles.receiptIcon}
        />
      );
    }

    return (
      <Ionicons
        name="checkmark-done"
        size={16}
        color="#2563EB"
        style={styles.receiptIcon}
      />
    );
  };

  const renderTypingIndicator = () => {
    return (
      <View style={styles.typingIndicator}>
        <Ionicons
          name="chatbubble-ellipses"
          size={15}
          color="#2563EB"
          style={styles.typingIcon}
        />

        <Text style={styles.typingText}>typing</Text>

        <View style={styles.typingDots}>
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
          <View style={styles.typingDot} />
        </View>
      </View>
    );
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const name = item.user?.profile?.username || "Unknown";

    const avatarUri = item.user?.profile?.avatarUrl
      ? `${API_BASE_URL}${item.user.profile.avatarUrl}`
      : null;

    const draftKey =
      currentUserId != null
        ? getDirectDraftKey(currentUserId, item.user.id)
        : null;
    const draft = draftKey ? drafts[draftKey] || "" : "";

    const isTyping = !!typingUsers[item.user.id];
    const isLastMessageDeleted = Boolean(item.lastMessageDeletedForAll);

    const deletedPreviewText =
      Number(item.lastMessageSenderId) === Number(currentUserId)
        ? "You deleted this message"
        : "This message was deleted";

    const previewText = isTyping
      ? null
      : draft
        ? draft
        : isLastMessageDeleted
          ? deletedPreviewText
          : item.lastMessage || "No messages yet";

    const unread = item.unreadCount || 0;
    const time = formatTime12Hour(item.timestamp);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: "/chats/[userId]",
            params: {
              userId: item.user.id.toString(),
              username: item.user.profile?.username,
              avatarUrl: item.user.profile?.avatarUrl,
            },
          })
        }
      >
        {/* ====================================================
            AVATAR
            ==================================================== */}

        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* ====================================================
            CHAT CONTENT
            ==================================================== */}

        <View style={styles.chatContent}>
          {/* NAME + TIME */}

          <View style={styles.topRow}>
            <Text numberOfLines={1} style={styles.name}>
              {name}
            </Text>

            <Text style={styles.time}>{time}</Text>
          </View>

          <View style={styles.bottomRow}>
            {isTyping ? (
              renderTypingIndicator()
            ) : draft ? (
              <View style={styles.messagePreview}>
                <Text numberOfLines={1} style={styles.draftPreview}>
                  <Text style={styles.draftLabel}>Draft: </Text>
                  {draft}
                </Text>
              </View>
            ) : (
              <View
                style={
                  isLastMessageDeleted
                    ? styles.deletedMessagePreview
                    : styles.messagePreview
                }
              >
                {!isLastMessageDeleted &&
                  Number(item.lastMessageSenderId) ===
                    Number(currentUser?.sub) &&
                  item.lastMessageStatus &&
                  renderReceipt(item.lastMessageStatus)}

                {isLastMessageDeleted ? (
                  <>
                    <Ionicons
                      name="ban-outline"
                      size={15}
                      color="#71717A"
                      style={styles.deletedMessageIcon}
                    />

                    <Text numberOfLines={1} style={styles.deletedMessage}>
                      {previewText}
                    </Text>
                  </>
                ) : (
                  <Text numberOfLines={1} style={styles.message}>
                    {previewText || "No messages yet"}
                  </Text>
                )}
              </View>
            )}

            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroupItem = ({ item }: { item: any }) => {
    const group = item.group;

    const avatarUri = group.avatarUrl
      ? `${API_BASE_URL}${group.avatarUrl}`
      : null;

    const time = formatTime12Hour(group.lastMessageAt);
    const draftKey =
      currentUserId != null ? getGroupDraftKey(currentUserId, group.id) : null;

    const draft = draftKey ? drafts[draftKey] || "" : "";
    const isSelected = selectedGroupIds.includes(Number(group.id));
    const isSelecting = selectedGroupIds.length > 0;

    return (
      <TouchableOpacity
        style={[styles.chatItem, isSelected && styles.groupChatItemSelected]}
        activeOpacity={0.7}
        onPress={() =>
          isSelecting
            ? toggleGroupSelection(Number(group.id))
            : router.push({
                pathname: "/groups/[groupId]",
                params: {
                  groupId: String(group.id),
                  isLeft: item.removedAt ? "true" : "false",
                },
              })
        }
        onLongPress={() => toggleGroupSelection(Number(group.id))}
      >
        {isSelecting && (
          <View style={styles.groupSelectionCheck}>
            <Ionicons
              name={isSelected ? "checkmark-circle" : "ellipse-outline"}
              size={23}
              color={isSelected ? ACCENT : "#94A3B8"}
            />
          </View>
        )}

        {/* GROUP AVATAR */}

        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="people" size={28} color="#2563EB" />
            </View>
          )}
        </View>

        {/* GROUP CONTENT */}

        <View style={styles.chatContent}>
          <View style={styles.topRow}>
            <Text numberOfLines={1} style={styles.name}>
              {group.name}
            </Text>

            <Text style={styles.time}>{time}</Text>
          </View>

          <View style={styles.bottomRow}>
            {draft ? (
              <View style={styles.messagePreview}>
                <Ionicons
                  name="create-outline"
                  size={14}
                  color="#2563EB"
                  style={styles.draftIcon}
                />

                <Text numberOfLines={1} style={styles.draftMessage}>
                  Draft: {draft}
                </Text>
              </View>
            ) : (
              <Text numberOfLines={1} style={styles.message}>
                {group.lastMessage || "No messages yet"}
              </Text>
            )}

            {group.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{group.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      {activeTab === "groups" && selectedGroupIds.length > 0 ? (
        <View style={styles.selectionToolbar}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.selectionToolbarButton}
            onPress={() => setSelectedGroupIds([])}
            accessibilityLabel="Cancel group selection"
          >
            <Ionicons name="close" size={22} color="#0B1545" />
          </TouchableOpacity>

          <Text style={styles.selectionToolbarTitle}>
            {selectedGroupIds.length} selected
          </Text>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.selectionToolbarButton, styles.deleteToolbarButton]}
            onPress={confirmDeleteSelectedGroups}
            disabled={deletingGroups}
            accessibilityLabel="Delete selected group chats"
          >
            {deletingGroups ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons name="trash-outline" size={21} color="#DC2626" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {myProfile?.avatarUrl ? (
              <Image
                source={{
                  uri: `${API_BASE_URL}${myProfile.avatarUrl}`,
                }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.headerAvatarLetter}>
                  {myProfile?.username?.charAt(0).toUpperCase() ?? "U"}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.onlineDot,
                {
                  backgroundColor: connected ? "#22C55E" : "#9CA3AF",
                },
              ]}
            />
          </View>

          <Text style={styles.headerTitle}>Zleenchat</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.8}
              onPress={() => router.push("/explore")}
            >
              <Ionicons name="search-outline" size={22} color="#0B1545" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconButton}
              activeOpacity={0.8}
              onPress={() => router.push("/new-chat" as any)}
            >
              <Ionicons name="create-outline" size={22} color="#0B1545" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.filterContainer}>
        {[
          { key: "all", label: "All" },
          { key: "unread", label: "Unread" },
          { key: "groups", label: "Groups" },
          {
            key: "requests",
            label: "Requests",
          },
        ].map((tab) => {
          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              style={isActive ? styles.activeTab : styles.inactiveTab}
              activeOpacity={0.8}
              onPress={() => {
                if (tab.key === "requests") {
                  router.push("/requests");
                  return;
                }

                if (tab.key !== "groups") {
                  setSelectedGroupIds([]);
                }

                setActiveTab(tab.key as typeof activeTab);
              }}
            >
              <Text
                style={isActive ? styles.activeTabText : styles.inactiveTabText}
              >
                {tab.label}
              </Text>

              {tab.key === "unread" && unreadConversationCount > 0 && (
                <View style={styles.unreadTabBadge}>
                  <Text style={styles.unreadTabBadgeText}>
                    {unreadConversationCount}
                  </Text>
                </View>
              )}

              {tab.key === "requests" && requestCount > 0 && (
                <View style={styles.unreadTabBadge}>
                  <Text style={styles.unreadTabBadgeText}>{requestCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === "groups" ? (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.group.id.toString()}
          renderItem={renderGroupItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatListContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No groups yet</Text>

              <Text style={styles.emptySubtitle}>
                Groups you join will appear here.
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.user.id.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.chatListContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {activeTab === "unread"
                  ? "No unread conversations"
                  : activeTab === "requests"
                    ? "No requests"
                    : "No conversations yet"}
              </Text>

              <Text style={styles.emptySubtitle}>
                {activeTab === "unread"
                  ? "You're all caught up."
                  : activeTab === "requests"
                    ? "Message requests will appear here."
                    : "Start a conversation and your chats will appear here."}
              </Text>
            </View>
          }
        />
      )}
      <Modal transparent visible={menuVisible} animationType="fade">
        <Pressable style={styles.overlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuBox}>
            <TouchableOpacity
              onPress={() => {
                setMenuVisible(false);

                router.push("/profile/settings" as any);
              }}
            >
              <Text style={styles.menuItem}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  topBlob: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 130,
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
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  selectionToolbar: {
    paddingTop: 46,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  selectionToolbarButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },

  deleteToolbarButton: {
    backgroundColor: "#FEF2F2",
  },

  selectionToolbarTitle: {
    flex: 1,
    marginLeft: 14,
    fontSize: 18,
    fontWeight: "700",
    color: "#0B1545",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  headerAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  headerAvatarLetter: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },

  onlineDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    bottom: 1,
    right: 1,
  },

  headerTitle: {
    marginRight: 70,
    fontSize: 28,
    fontWeight: "800",
    color: "#2563EB",
    letterSpacing: -1,
  },

  headerActions: {
    flexDirection: "row",
  },

  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 5,
    marginLeft: 10,
  },

  filterContainer: {
    marginTop: 18,
    marginHorizontal: 22,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F3F6FD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 8,
  },

  activeTab: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#2563EB",
  },

  activeTabText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },

  inactiveTab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    paddingHorizontal: 16,
  },

  inactiveTabText: {
    color: "#5E6785",
    fontSize: 16,
    fontWeight: "600",
  },

  unreadTabBadge: {
    marginLeft: 8,
    backgroundColor: "#2563EB",
    minWidth: 18,
    height: 18,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },

  unreadTabBadgeText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 12,
  },

  chatListContent: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 120,
  },

  emptyState: {
    marginTop: 120,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B1545",
  },

  emptySubtitle: {
    marginTop: 10,
    color: "#69708A",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 40,
  },

  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 16,
    overflow: "hidden",
    flexShrink: 0,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
  },

  avatarFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2563EB",
  },

  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,

    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 7,
    },

    elevation: 4,
  },

  groupChatItemSelected: {
    borderWidth: 1.5,
    borderColor: ACCENT,
    backgroundColor: "#F8FAFF",
  },

  groupSelectionCheck: {
    marginRight: 10,
  },

  chatContent: {
    flex: 1,
    marginLeft: 0,
    minWidth: 0,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  name: {
    flex: 1,
    fontSize: 19,
    fontWeight: "700",
    color: "#0B1545",
  },

  time: {
    marginLeft: 12,
    fontSize: 12,
    color: "#69708A",
    fontWeight: "600",
  },

  bottomRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 20,
  },

  messagePreview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    marginRight: 12,
  },

  message: {
    flex: 1,
    fontSize: 15,
    color: "#69708A",
  },

  receiptIcon: {
    marginRight: 5,
    flexShrink: 0,
  },

  typingIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    marginRight: 12,
  },

  typingIcon: {
    marginRight: 5,
  },

  typingText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  typingDots: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 4,
  },

  typingDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#2563EB",
    marginHorizontal: 1.5,
  },

  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },

  unreadText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 110,
    paddingRight: 24,
  },

  menuBox: {
    width: 180,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,

    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 8,
  },

  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    fontSize: 17,
    color: "#0B1545",
    fontWeight: "600",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  draftPreview: {
    flex: 1,
    fontSize: 15,
    color: "#71717A",
  },

  draftLabel: {
    fontWeight: "700",
    color: "#2563EB",
  },

  draftIcon: {
    marginRight: 5,
  },

  draftMessage: {
    flex: 1,
    fontSize: 15,
    color: "#2563EB",
    fontWeight: "700",
  },

  deletedMessagePreview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
    marginRight: 12,
  },

  deletedMessageIcon: {
    marginRight: 6,
    flexShrink: 0,
    color: "red",
  },

  deletedMessage: {
    flex: 1,
    fontSize: 15,
    color: "#71717A",
    fontFamily: "sans-serif",
    fontStyle: "italic",
  },
});
