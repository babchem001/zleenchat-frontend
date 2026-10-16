import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "@/src/services/api/apiClient";
import {
  getConversations,
  forwardMessages,
} from "@/src/services/chat/chatService";
import { forwardGroupMessages } from "@/src/services/group/groupMessageService";
import { getMyGroups } from "@/src/services/group/groupService";

import { Conversation } from "@/src/types/chat.types";
import { searchUsers } from "@/src/services/user/userService";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type User = {
  id: number;
  username: string;
  avatarUrl: string | null;
};

type GroupItem = {
  id: number;
  group: {
    id: number;
    name: string;
    avatarUrl?: string | null;
    description?: string | null;
    memberPreview?: string;
  };
};

export default function ForwardScreen() {
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [frequentContacts, setFrequentContacts] = useState<Conversation[]>([]);
  const [people, setPeople] = useState<User[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);

  // USER DESTINATIONS
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  // GROUP DESTINATIONS
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);

  /*
   * APP FEEDBACK MODAL
   */
  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");

  const [feedbackTitle, setFeedbackTitle] = useState("");

  const [feedbackMessage, setFeedbackMessage] = useState("");

  /*
   * Determines what happens when the feedback
   * modal is closed.
   */
  const [feedbackOnClose, setFeedbackOnClose] = useState<(() => void) | null>(
    null,
  );

  const { messageIds, sourceType } = useLocalSearchParams<{
    messageIds?: string;
    sourceType?: "direct" | "group";
  }>();

  /*
   * Show branded application feedback.
   */
  const showFeedback = (
    type: FeedbackType,
    title: string,
    message: string,
    onClose?: () => void,
  ) => {
    setFeedbackType(type);
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackOnClose(() => onClose || null);
    setFeedbackVisible(true);
  };

  /*
   * Close feedback modal.
   */
  const handleCloseFeedback = () => {
    setFeedbackVisible(false);

    const action = feedbackOnClose;

    setFeedbackOnClose(null);

    if (action) {
      action();
    }
  };

  const selectedMessageIds = useMemo(() => {
    if (!messageIds) {
      return [];
    }

    try {
      const parsed = JSON.parse(messageIds);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(Number).filter((id) => Number.isInteger(id) && id > 0);
    } catch {
      return [];
    }
  }, [messageIds]);

  /*
   * Determines where the original message came from.
   *
   * direct = message came from Direct Chat
   * group  = message came from Group Chat
   */
  const forwardingSource = sourceType === "group" ? "group" : "direct";

  useEffect(() => {
    const load = async () => {
      try {
        const [conversationData, groupData] = await Promise.all([
          getConversations(),
          getMyGroups(),
        ]);

        setFrequentContacts(conversationData || []);
        setGroups(groupData || []);
      } catch (error) {
        console.log("Load forward destinations error:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch) {
      setPeople([]);
      return;
    }

    const loadUsers = async () => {
      try {
        const data = await searchUsers(debouncedSearch);

        setPeople(data || []);
      } catch (error) {
        console.log("Search users error:", error);
        setPeople([]);
      }
    };

    loadUsers();
  }, [debouncedSearch]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return groups;
    }

    return groups.filter((item) =>
      item.group.name.toLowerCase().includes(query),
    );
  }, [groups, search]);

  const filteredFrequentContacts = useMemo(() => {
    if (debouncedSearch) {
      return [];
    }

    return frequentContacts;
  }, [frequentContacts, debouncedSearch]);

  // USER SELECTION
  const toggleUserSelection = useCallback((userId: number) => {
    setSelectedUserIds((previous) =>
      previous.includes(userId)
        ? previous.filter((id) => id !== userId)
        : [...previous, userId],
    );
  }, []);

  // GROUP SELECTION
  const toggleGroupSelection = useCallback((groupId: number) => {
    setSelectedGroupIds((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId],
    );
  }, []);

  const totalSelected = selectedUserIds.length + selectedGroupIds.length;

  const canForward =
    totalSelected > 0 && selectedMessageIds.length > 0 && !forwarding;

  const renderConversationItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const avatarUri = item.user.profile.avatarUrl
        ? `${API_BASE_URL}${item.user.profile.avatarUrl}`
        : null;

      const selected = selectedUserIds.includes(item.user.id);

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.row, selected && styles.selectedRow]}
          onPress={() => toggleUserSelection(item.user.id)}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {item.user.profile.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.info}>
            <Text numberOfLines={1} style={styles.username}>
              {item.user.profile.username}
            </Text>

            <Text numberOfLines={1} style={styles.subtitle}>
              {item.lastMessage || "No messages"}
            </Text>
          </View>

          {selected ? (
            <Ionicons name="checkmark-circle" size={28} color="#2563EB" />
          ) : (
            <Ionicons name="ellipse-outline" size={26} color="#C5CBDC" />
          )}
        </TouchableOpacity>
      );
    },
    [selectedUserIds, toggleUserSelection],
  );

  const renderUserItem = useCallback(
    ({ item }: { item: User }) => {
      const avatarUri = item.avatarUrl
        ? `${API_BASE_URL}${item.avatarUrl}`
        : null;

      const selected = selectedUserIds.includes(item.id);

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.row, selected && styles.selectedRow]}
          onPress={() => toggleUserSelection(item.id)}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {item.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.info}>
            <Text numberOfLines={1} style={styles.username}>
              {item.username}
            </Text>

            <Text numberOfLines={1} style={styles.subtitle}>
              Available to chat
            </Text>
          </View>

          {selected ? (
            <Ionicons name="checkmark-circle" size={28} color="#2563EB" />
          ) : (
            <Ionicons name="ellipse-outline" size={26} color="#C5CBDC" />
          )}
        </TouchableOpacity>
      );
    },
    [selectedUserIds, toggleUserSelection],
  );

  const renderGroupItem = useCallback(
    ({ item }: { item: GroupItem }) => {
      const group = item.group;

      const selected = selectedGroupIds.includes(group.id);

      const avatarUri = group.avatarUrl
        ? `${API_BASE_URL}${group.avatarUrl}`
        : null;

      return (
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.row, selected && styles.selectedRow]}
          onPress={() => toggleGroupSelection(group.id)}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="people" size={22} color="#2563EB" />
            </View>
          )}

          <View style={styles.info}>
            <Text numberOfLines={1} style={styles.username}>
              {group.name}
            </Text>

            <Text numberOfLines={1} style={styles.subtitle}>
              {group.memberPreview || "Group"}
            </Text>
          </View>

          {selected ? (
            <Ionicons name="checkmark-circle" size={28} color="#2563EB" />
          ) : (
            <Ionicons name="ellipse-outline" size={26} color="#C5CBDC" />
          )}
        </TouchableOpacity>
      );
    },
    [selectedGroupIds, toggleGroupSelection],
  );

  /*
   * Forward selected messages.
   */
  const handleForward = async () => {
    if (!canForward) {
      return;
    }

    try {
      setForwarding(true);

      /*
       * Both destination types are sent
       * to the backend.
       *
       * selectedUserIds  -> direct-message destinations
       * selectedGroupIds -> group-message destinations
       */
      if (forwardingSource === "group") {
        await forwardGroupMessages(
          selectedUserIds,
          selectedGroupIds,
          selectedMessageIds,
        );
      } else {
        await forwardMessages(
          selectedUserIds,
          selectedGroupIds,
          selectedMessageIds,
        );
      }

      const destinationParts: string[] = [];

      if (selectedUserIds.length > 0) {
        destinationParts.push(
          `${selectedUserIds.length} user${
            selectedUserIds.length === 1 ? "" : "s"
          }`,
        );
      }

      if (selectedGroupIds.length > 0) {
        destinationParts.push(
          `${selectedGroupIds.length} group${
            selectedGroupIds.length === 1 ? "" : "s"
          }`,
        );
      }

      showFeedback(
        "success",
        "Messages forwarded",
        `Message${
          selectedMessageIds.length === 1 ? "" : "s"
        } forwarded to ${destinationParts.join(" and ")}.`,
        () => {
          router.back();
        },
      );
    } catch (error) {
      console.log("Forward message error:", error);

      showFeedback(
        "error",
        "Forward failed",
        "Unable to forward message(s). Please try again.",
      );
    } finally {
      setForwarding(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {/* Decorative background */}
        <View style={styles.topBlob} />
        <View style={styles.bottomBlob} />
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={28} color="#0B1545" />
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>Forward</Text>

            <Text style={styles.description}>
              {totalSelected === 0
                ? "Choose conversations"
                : `${totalSelected} selected`}
            </Text>
          </View>

          <TouchableOpacity
            disabled={!canForward}
            style={[
              styles.forwardButton,
              !canForward && styles.forwardButtonDisabled,
            ]}
            onPress={handleForward}
            activeOpacity={0.85}
          >
            {forwarding ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="arrow-forward" size={22} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#69708A" />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search people or groups"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>

        {/* Search results */}
        {debouncedSearch ? (
          <FlatList
            data={people}
            extraData={{
              selectedUserIds,
              selectedGroupIds,
            }}
            keyExtractor={(item) => `user-${item.id}`}
            renderItem={renderUserItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <>
                {filteredGroups.length > 0 && (
                  <View>
                    <Text style={styles.sectionTitle}>Groups</Text>

                    {filteredGroups.map((item) => (
                      <View key={`group-${item.group.id}`}>
                        {renderGroupItem({ item })}
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.sectionTitle}>People</Text>
              </>
            }
            ListEmptyComponent={
              filteredGroups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search-outline" size={44} color="#C5CBDC" />

                  <Text style={styles.emptyTitle}>No results</Text>

                  <Text style={styles.emptySubtitle}>
                    We couldn&apos;t find any people or groups matching your search.
                  </Text>
                </View>
              ) : null
            }
          />
        ) : (
          <FlatList
            data={filteredFrequentContacts}
            extraData={{
              selectedUserIds,
              selectedGroupIds,
            }}
            keyExtractor={(item) => `conversation-${item.user.id}`}
            renderItem={renderConversationItem}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <>
                {/* Groups */}
                {filteredGroups.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Groups</Text>

                    {filteredGroups.map((item) => (
                      <View key={`group-${item.group.id}`}>
                        {renderGroupItem({ item })}
                      </View>
                    ))}
                  </View>
                )}

                {/* People */}
                {filteredFrequentContacts.length > 0 && (
                  <Text style={styles.sectionTitle}>Frequently Contacted</Text>
                )}
              </>
            }
            ListEmptyComponent={
              filteredGroups.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={44} color="#C5CBDC" />

                  <Text style={styles.emptyTitle}>No conversations</Text>

                  <Text style={styles.emptySubtitle}>
                    You don&apos;t have any available forwarding destinations yet.
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>

      {/* GLOBAL APP FEEDBACK */}
      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        buttonText="OK"
        onClose={handleCloseFeedback}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
  },

  headerText: {
    flex: 1,
    marginLeft: 12,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0B1545",
  },

  description: {
    marginTop: 3,
    color: "#69708A",
    fontSize: 15,
  },

  forwardButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2563EB",
  },

  forwardButtonDisabled: {
    opacity: 0.35,
  },

  searchContainer: {
    marginHorizontal: 22,
    marginTop: 24,
    marginBottom: 20,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F3F6FD",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#0B1545",
  },

  list: {
    paddingHorizontal: 22,
    paddingBottom: 120,
  },

  section: {
    marginBottom: 10,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0B1545",
    marginBottom: 14,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },

  selectedRow: {
    borderWidth: 2,
    borderColor: "#2563EB",
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

  avatarLetter: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2563EB",
  },

  info: {
    flex: 1,
    marginHorizontal: 16,
  },

  username: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0B1545",
  },

  subtitle: {
    marginTop: 4,
    color: "#69708A",
    fontSize: 15,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingTop: 80,
  },

  emptyTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: "700",
    color: "#0B1545",
  },

  emptySubtitle: {
    marginTop: 10,
    fontSize: 16,
    color: "#69708A",
    textAlign: "center",
    lineHeight: 24,
  },
});
