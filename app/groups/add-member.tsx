import { API_BASE_URL } from "@/src/services/api/apiClient";
import { router } from "expo-router";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  StatusBar,
} from "react-native";

import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { searchUsers } from "@/src/services/user/userService";
import {
  addMember,
  getMyGroupMembers,
} from "@/src/services/group/groupService";

import { useGroupCreationStore } from "@/src/store/group/groupCreationStore";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type User = {
  id: number;
  username: string;
  avatarUrl: string | null;
};

type FeedbackState = {
  visible: boolean;
  type: FeedbackType;
  title: string;
  message: string;
};

export default function AddMemberScreen() {
  const { groupId } = useLocalSearchParams();

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // MEMBERS STATE
  const [memberIds, setMemberIds] = useState<Set<number>>(new Set());

  // DEBOUNCE
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { toggleMember, selectedMembers } = useGroupCreationStore();

  const [feedback, setFeedback] = useState<FeedbackState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const isCreateMode = !groupId;
  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
    });
  };

  const closeFeedback = () => {
    setFeedback((prev) => ({
      ...prev,
      visible: false,
    }));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (isCreateMode) return;

    const loadMembers = async () => {
      try {
        const data = await getMyGroupMembers(Number(groupId));

        const ids = new Set<number>(data.map((m: any) => Number(m.user.id)));

        setMemberIds(ids);
      } catch {
        console.log("Failed to load members");
      }
    };

    loadMembers();
  }, [groupId, isCreateMode]);

  useEffect(() => {
    if (!debouncedQuery) {
      setUsers([]);
      return;
    }

    fetchUsers(debouncedQuery);
  }, [debouncedQuery]);

  const fetchUsers = async (search: string) => {
    try {
      setLoading(true);

      const data = await searchUsers(search);

      setUsers(data || []);
    } catch (error) {
      console.log("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (item: User) => {
  
    if (isCreateMode) {
      toggleMember(item);
      return;
    }

    try {
      await addMember(Number(groupId), item.id);

      setMemberIds((prev) => {
        const updatedMembers = new Set(prev);

        updatedMembers.add(item.id);

        return updatedMembers;
      });

      showFeedback(
        "success",
        "Member Added",
        `${item.username} has been added to the group.`,
      );
    } catch (error: any) {
      showFeedback(
        "error",
        "Unable to Add Member",
        error?.message || "Failed to add user to the group.",
      );
    }
  };

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
          activeOpacity={0.85}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#0B1545" />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Add Members</Text>

          <Text style={styles.headerSubtitle}>Search and select people</Text>
        </View>
      </View>

      {/* Search */}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#94A3B8" />

        <TextInput
          placeholder="Search users..."
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
        />
      </View>

      {/* Selected Counter */}

      {isCreateMode && (
        <View style={styles.selectionInfo}>
          <Ionicons name="people-outline" size={16} color="#69708A" />

          <Text style={styles.selectionText}>
            {selectedMembers.length === 0
              ? "No members selected"
              : `${selectedMembers.length} member${
                  selectedMembers.length > 1 ? "s" : ""
                } selected`}
          </Text>
        </View>
      )}

      {/* Loading */}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}

      {/* Empty */}

      {!loading && users.length === 0 && query.trim().length > 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={60} color="#2563EB" />

          <Text style={styles.emptyTitle}>No users found</Text>

          <Text style={styles.emptySubtitle}>Try another username.</Text>
        </View>
      )}

      {/* Users */}

      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const avatarUri = item.avatarUrl
            ? `${API_BASE_URL}${item.avatarUrl}`
            : null;

          const isAlreadyMember = memberIds.has(item.id);

          const isSelected = selectedMembers.some((m) => m.id === item.id);

          return (
            <View style={styles.userCard}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>

                <Text style={styles.userStatus}>
                  {isAlreadyMember
                    ? "Already in group"
                    : isSelected
                      ? "Ready to add"
                      : "Available"}
                </Text>
              </View>

              <TouchableOpacity
                disabled={!isCreateMode && isAlreadyMember}
                activeOpacity={0.85}
                style={[
                  styles.actionButton,
                  isAlreadyMember && styles.disabledButton,
                  isSelected && styles.selectedButton,
                ]}
                onPress={() => handleAddMember(item)}
              >
                {isCreateMode && isSelected ? (
                  <View style={styles.actionContent}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />

                    <Text style={styles.actionButtonText}>Selected</Text>
                  </View>
                ) : (
                  <Text style={styles.actionButtonText}>
                    {isCreateMode
                      ? "Select"
                      : isAlreadyMember
                        ? "Added"
                        : "Add"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* Done */}

      {isCreateMode && (
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.doneButton}
          onPress={() => router.back()}
        >
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      )}

      {/* BRANDED APP FEEDBACK MODAL */}

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

  /* Decorative Background */

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

  /* Header */

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

  /* Search */

  searchContainer: {
    marginTop: 20,
    marginHorizontal: 22,
    height: 52,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,

    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 3,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#0B1545",
  },

  /* Selection */

  selectionInfo: {
    marginHorizontal: 24,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  selectionText: {
    marginLeft: 6,
    fontSize: 13,
    color: "#69708A",
    fontWeight: "500",
  },

  /* List */

  listContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 110,
  },

  userCard: {
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

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },

  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
  },

  userInfo: {
    flex: 1,
    marginLeft: 12,
  },

  username: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0B1545",
  },

  userStatus: {
    marginTop: 3,
    fontSize: 13,
    color: "#69708A",
  },

  /* Buttons */

  actionButton: {
    minWidth: 86,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  selectedButton: {
    backgroundColor: "#2563EB",
  },

  disabledButton: {
    backgroundColor: "#CBD5E1",
  },

  actionContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  actionButtonText: {
    marginLeft: 4,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },

  /* Loading */

  loadingContainer: {
    marginTop: 40,
    alignItems: "center",
  },

  /* Empty */

  emptyContainer: {
    marginTop: 80,
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
    marginTop: 8,
    fontSize: 15,
    color: "#69708A",
    textAlign: "center",
  },

  /* Done */

  doneButton: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 55,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#2563EB",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 6,
  },

  doneText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
