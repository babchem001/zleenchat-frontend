import { API_BASE_URL } from "@/src/services/api/apiClient";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Image,
  StatusBar,
} from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getMyGroups,
  createGroup,
  addMember,
  deleteMyGroupChats,
} from "@/src/services/group/groupService";

import { useGroupCreationStore } from "@/src/store/group/groupCreationStore";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "@/src/store/auth/authStorage";
import { useDraftStore, getGroupDraftKey } from "@/src/store/chat/draftStore";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type GroupItem = {
  id: number;
  removedAt?: string | null;
  group: {
    id: number;
    name: string;
    avatarUrl?: string | null;
    description?: string | null;
    lastMessage: string;
    lastMessageAt: string | null;
    unreadCount: number;
    memberPreview: string;
    isMuted: boolean;
  };
};

export default function GroupListScreen() {
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const groupsRef = useRef<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [deletingGroups, setDeletingGroups] = useState(false);

  const {
    groupName,
    setGroupName,
    selectedMembers,
    toggleMember,
    targetUser,
    setTargetUser,
    clear,
  } = useGroupCreationStore();

  const [showInput, setShowInput] = useState(false);
  const [createWithTargetUser, setCreateWithTargetUser] = useState(false);

  const [typingGroups, setTypingGroups] = useState<Record<number, string>>({});

  /*
   * Branded App Feedback Modal state.
   */
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");

  const [feedbackTitle, setFeedbackTitle] = useState("");

  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackButtonText, setFeedbackButtonText] = useState("OK");
  const [feedbackSecondaryButtonText, setFeedbackSecondaryButtonText] =
    useState<string | undefined>();
  const [feedbackPrimaryAction, setFeedbackPrimaryAction] = useState<
    (() => void) | null
  >(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const { socketRef, connected } = useSocket();

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.sub;

  const drafts = useDraftStore((state) => state.drafts);
  const clearDraft = useDraftStore((state) => state.clearDraft);

  /*
   * Open branded feedback modal.
   */
  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedbackType(type);
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackButtonText("OK");
    setFeedbackSecondaryButtonText(undefined);
    setFeedbackPrimaryAction(null);
    setFeedbackLoading(false);
    setFeedbackVisible(true);
  };

  /*
   * Close branded feedback modal.
   */
  const closeFeedback = () => {
    if (deletingGroups) return;

    setFeedbackVisible(false);
    setFeedbackSecondaryButtonText(undefined);
    setFeedbackPrimaryAction(null);
  };

  useEffect(() => {
    if (!targetUser) {
      return;
    }

    setCreateWithTargetUser(true);

    // Open the group creation panel automatically.
    setShowInput(true);

    // Add the target user to the selected members.
    const alreadySelected = selectedMembers.some(
      (member) => member.id === targetUser.id,
    );

    if (!alreadySelected) {
      toggleMember(targetUser);
    }

    setTargetUser(null);
  }, [targetUser, selectedMembers, toggleMember, setTargetUser]);

  const formatTime12Hour = (date?: string | null) => {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return parsedDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  /*
   * Fetch user's groups.
   */
  const fetchGroups = useCallback(async () => {
    try {
      const data = await getMyGroups();

      setGroups(data || []);
    } catch (error) {
      console.log("Fetch groups error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [fetchGroups]),
  );

  /*
   * Socket listeners.
   */
  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    socket.on("groupAvatarUpdated", ({ groupId, avatarUrl }) => {
      setGroups((prev) =>
        prev.map((g) =>
          Number(g.group.id) === Number(groupId)
            ? {
                ...g,
                group: {
                  ...g.group,
                  avatarUrl,
                },
              }
            : g,
        ),
      );
    });

    socket.on("newGroupMessage", (message) => {
      // Ignore system messages.
      if (message.type === "SYSTEM") return;

      // A locally deleted chat returns when a new message is posted, like
      // other messaging apps. Refresh only when it is currently hidden.
      if (
        !groupsRef.current.some(
          (item) => Number(item.group.id) === Number(message.groupId),
        )
      ) {
        void fetchGroups();
        return;
      }

      setGroups((prev) => {
        const updated = prev.map((item) => {
          if (Number(item.group.id) !== Number(message.groupId)) {
            return item;
          }

          let preview = message.messageContent;

          switch (message.contentType) {
            case "IMAGE":
              preview = "📷 Photo";
              break;

            case "VIDEO":
              preview = "🎥 Video";
              break;

            case "AUDIO":
              preview = "🎤 Audio";
              break;

            case "FILE":
              preview = "📄 Document";
              break;
          }

          return {
            ...item,
            group: {
              ...item.group,
              lastMessage: preview,
              lastMessageAt: message.createdAt,
              unreadCount:
                !item.removedAt && item.group.id === Number(message.groupId)
                  ? item.group.unreadCount + 1
                  : item.group.unreadCount,
            },
          };
        });

        updated.sort((a, b) => {
          const aTime = a.group.lastMessageAt
            ? new Date(a.group.lastMessageAt).getTime()
            : 0;

          const bTime = b.group.lastMessageAt
            ? new Date(b.group.lastMessageAt).getTime()
            : 0;

          return bTime - aTime;
        });

        return updated;
      });
    });

    socket.on("groupTyping:start", ({ groupId, username }) => {
      setTypingGroups((prev) => ({ ...prev, [Number(groupId)]: username }));
    });

    socket.on("groupTyping:stop", ({ groupId }) => {
      setTypingGroups((prev) => {
        const updated = { ...prev };

        delete updated[Number(groupId)];

        return updated;
      });
    });

    return () => {
      socket.off("groupAvatarUpdated");
      socket.off("groupTyping:start");
      socket.off("groupTyping:stop");
      socket.off("newGroupMessage");
    };
  }, [connected, socketRef, fetchGroups]);

  /*
   * Open group chat.
   */
  const handleOpenGroup = (item: GroupItem) => {
    router.push({
      pathname: "/groups/[groupId]",
      params: {
        groupId: String(item.group.id),
        isLeft: item.removedAt ? "true" : "false",
      },
    });
  };

  const toggleGroupSelection = (groupId: number) => {
    setSelectedGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId],
    );
  };

  const executeDeleteSelectedGroups = async (groupIds: number[]) => {
    if (groupIds.length === 0 || deletingGroups) return;

    const count = groupIds.length;

    setDeletingGroups(true);
    setFeedbackLoading(true);

    try {
      await deleteMyGroupChats(groupIds);
      setGroups((current) =>
        current.filter((item) => !groupIds.includes(item.group.id)),
      );
      if (Number.isInteger(Number(currentUserId))) {
        groupIds.forEach((groupId) =>
          clearDraft(getGroupDraftKey(Number(currentUserId), groupId)),
        );
      }
      setSelectedGroupIds([]);
      showFeedback(
        "success",
        "Group Chats Deleted",
        count === 1
          ? "The group chat was deleted for you."
          : "The selected group chats were deleted for you.",
      );
    } catch (error: any) {
      showFeedback(
        "error",
        "Unable to Delete Group Chats",
        error?.message || "Please try again.",
      );
    } finally {
      setDeletingGroups(false);
      setFeedbackLoading(false);
    }
  };

  const confirmDeleteSelectedGroups = () => {
    if (selectedGroupIds.length === 0 || deletingGroups) return;

    const groupIds = [...selectedGroupIds];
    const count = groupIds.length;

    setFeedbackType("warning");
    setFeedbackTitle(
      count === 1 ? "Delete group chat?" : `Delete ${count} group chats?`,
    );
    setFeedbackMessage(
      "This removes the selected chat and its visible history for you. Other members keep the group and its messages. A group may reappear if it receives new messages.",
    );
    setFeedbackButtonText("Delete");
    setFeedbackSecondaryButtonText("Cancel");
    setFeedbackLoading(false);
    setFeedbackPrimaryAction(() => () => {
      void executeDeleteSelectedGroups(groupIds);
    });
    setFeedbackVisible(true);
  };

  /*
   * Create group.
   */
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      showFeedback(
        "warning",
        "Group Name Required",
        "Please enter a name for your group.",
      );

      return;
    }

    try {
      const group = await createGroup(groupName);

      await Promise.all(
        selectedMembers.map((member) => addMember(group.id, member.id)),
      );

      clear();

      setGroupName("");
      setShowInput(false);
      setCreateWithTargetUser(false);

      await fetchGroups();

      showFeedback(
        "success",
        "Group Created",
        "Your group has been created successfully.",
      );
    } catch (error: any) {
      console.log("Create group error:", error);

      showFeedback(
        "error",
        "Unable to Create Group",
        error?.message ||
          "Something went wrong while creating the group. Please try again.",
      );
    }
  };

  /*
   * Refresh groups.
   */
  const handleRefresh = () => {
    setRefreshing(true);

    fetchGroups();
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Decorative Background */}

      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      {/* Header */}

      {selectedGroupIds.length > 0 ? (
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.selectionCloseButton}
            onPress={() => setSelectedGroupIds([])}
            accessibilityLabel="Cancel group selection"
          >
            <Ionicons name="close" size={22} color="#0B1545" />
          </TouchableOpacity>

          <Text style={styles.selectionTitle}>
            {selectedGroupIds.length} selected
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.deleteIconButton}
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
          <View>
            <Text style={styles.headerTitle}>Groups</Text>

            <Text style={styles.headerSubtitle}>
              Manage your group conversations
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.createIconButton}
            onPress={() => {
              if (!showInput) {
                setShowInput(true);
              } else {
                handleCreateGroup();
              }
            }}
          >
            <Ionicons
              name={showInput ? "checkmark" : "add"}
              size={22}
              color="#0B1545"
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Create Group Panel */}

      {showInput && (
        <View style={styles.createCard}>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Group name"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />

          {!createWithTargetUser && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.memberSelector}
              onPress={() => router.push("/groups/add-member" as any)}
            >
              <View style={styles.memberCircle}>
                <Ionicons name="person-add" size={22} color="#FFFFFF" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.memberTitle}>Add Members</Text>

                <Text style={styles.memberSubtitle}>
                  {selectedMembers.length === 0
                    ? "No members selected"
                    : `${selectedMembers.length} member${
                        selectedMembers.length > 1 ? "s" : ""
                      } selected`}
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}

          {selectedMembers.length > 0 && (
            <View style={styles.memberChipContainer}>
              {selectedMembers.map((member) => (
                <View key={member.id} style={styles.memberChip}>
                  <Text style={styles.memberChipText}>{member.username}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.createButton}
            onPress={handleCreateGroup}
          >
            <Text style={styles.createButtonText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Groups */}

      <FlatList
        data={groups}
        keyExtractor={(item) => item.group.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.groupListContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={68} color="#2563EB" />

            <Text style={styles.emptyTitle}>No groups yet</Text>

            <Text style={styles.emptySubtitle}>
              Groups you join or create will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const avatarUri = item.group.avatarUrl
            ? `${API_BASE_URL}${item.group.avatarUrl}`
            : null;

          const isTyping = !!typingGroups[item.group.id];
          const isLeft = item.removedAt != null;
          const isSelected = selectedGroupIds.includes(item.group.id);

          const draftKey = Number.isInteger(Number(currentUserId))
            ? getGroupDraftKey(Number(currentUserId), Number(item.group.id))
            : null;

          const draft = draftKey ? (drafts[draftKey] ?? "") : "";

          const messagePreview = isLeft
            ? "You left this group"
            : isTyping
              ? item.group.lastMessage || "No messages yet"
              : draft
                ? `Draft:${draft}`
                : item.group.lastMessage || "No messages yet";

          const previewText = isLeft
            ? "Read-only group history"
            : isTyping
              ? `${typingGroups[item.group.id]} is typing...`
              : item.group.memberPreview;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.groupCard, isSelected && styles.groupCardSelected]}
              onPress={() =>
                selectedGroupIds.length > 0
                  ? toggleGroupSelection(item.group.id)
                  : handleOpenGroup(item)
              }
              onLongPress={() => toggleGroupSelection(item.group.id)}
            >
              {selectedGroupIds.length > 0 && (
                <View style={styles.selectionCheck}>
                  <Ionicons
                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                    size={23}
                    color={isSelected ? "#2563EB" : "#94A3B8"}
                  />
                </View>
              )}

              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Ionicons name="people" size={24} color="#2563EB" />
                </View>
              )}

              <View style={styles.groupContent}>
                <View style={styles.groupTopRow}>
                  <Text numberOfLines={1} style={styles.groupName}>
                    {item.group.name}
                  </Text>

                  <Text style={styles.groupTime}>
                    {formatTime12Hour(item.group.lastMessageAt)}
                  </Text>
                </View>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.groupMessage,
                    !isLeft && draft && isTyping && styles.groupDraftMessage,
                  ]}
                >
                  {messagePreview}
                </Text>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.groupMembers,
                    !isLeft && isTyping && styles.typingText,
                  ]}
                >
                  {previewText}
                </Text>
              </View>

              <View style={styles.groupRight}>
                {item.group.isMuted && (
                  <Ionicons
                    name="notifications-off"
                    size={15}
                    color="#94A3B8"
                  />
                )}

                {!isLeft && item.group.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>
                      {item.group.unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Global Branded Feedback Modal */}

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        buttonText={feedbackButtonText}
        secondaryButtonText={feedbackSecondaryButtonText}
        onSecondaryPress={closeFeedback}
        onPrimaryPress={feedbackPrimaryAction ?? undefined}
        loading={feedbackLoading}
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
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0B1545",
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 14,
    color: "#69708A",
  },

  createIconButton: {
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

  createCard: {
    marginHorizontal: 22,
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 3,
  },

  input: {
    height: 48,
    backgroundColor: "#F6F8FC",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#0B1545",
  },

  memberSelector: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFF",
    borderRadius: 18,
    padding: 14,
  },

  memberCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  memberTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1545",
  },

  memberSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#69708A",
  },

  memberChipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
  },

  memberChip: {
    backgroundColor: "#E9EEFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },

  memberChipText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 13,
  },

  createButton: {
    marginTop: 18,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  createButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  groupListContent: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 120,
  },

  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 3,
  },

  groupCardSelected: {
    borderWidth: 1.5,
    borderColor: "#2563EB",
    backgroundColor: "#F8FAFF",
  },

  selectionCheck: {
    marginRight: 10,
  },

  selectionTitle: {
    flex: 1,
    marginLeft: 14,
    fontSize: 18,
    fontWeight: "700",
    color: "#0B1545",
  },

  selectionCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },

  deleteIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },

  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
  },

  groupContent: {
    flex: 1,
    marginLeft: 12,
  },

  groupTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  groupName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#0B1545",
    marginRight: 8,
  },

  groupTime: {
    fontSize: 12,
    color: "#69708A",
    fontWeight: "600",
  },

  groupMessage: {
    marginTop: 3,
    fontSize: 14,
    color: "#69708A",
  },

  groupMembers: {
    marginTop: 2,
    fontSize: 12,
    color: "#94A3B8",
  },

  typingText: {
    color: "#2563EB",
    fontWeight: "600",
  },

  groupRight: {
    marginLeft: 10,
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 40,
  },

  unreadBadge: {
    marginTop: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },

  unreadText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  emptyState: {
    marginTop: 120,
    alignItems: "center",
    paddingHorizontal: 40,
  },

  emptyTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "700",
    color: "#0B1545",
  },

  emptySubtitle: {
    marginTop: 10,
    fontSize: 15,
    color: "#69708A",
    textAlign: "center",
    lineHeight: 22,
  },

  groupDraftMessage: {
    color: "#2563EB",
    fontWeight: "700",
  },
});
