import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useState, useCallback } from "react";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getMyChatRequest,
  acceptChatRequest,
  declineChatRequest,
} from "@/src/services/chatRequest/chatRequestService";
import { API_BASE_URL } from "@/src/services/api/apiClient";

export default function RequestsScreen() {
  const [chatRequests, setChatRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"incoming" | "sent">("incoming");

  const fetchChatRequests = async () => {
    try {
      const data = await getMyChatRequest();

      setChatRequests(data.requests || []);
      setCurrentUserId(data.currentUserId);
    } catch (error) {
      console.log("Fetch requests error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchChatRequests();
    }, []),
  );

  const handleAcceptChatRequest = async (id: number, otherUserId: number) => {
    await acceptChatRequest(id);

    await fetchChatRequests();

    router.push({
      pathname: "/chats/[userId]",
      params: {
        userId: otherUserId.toString(),
      },
    });
  };

  const handleDeclineChatRequest = async (id: number) => {
    await declineChatRequest(id);

    fetchChatRequests();
  };

  const incomingRequests = chatRequests.filter(
    (request) =>
      request.receiverId === currentUserId && request.status === "PENDING",
  );

  const sentRequests = chatRequests.filter(
    (request) =>
      request.senderId === currentUserId && request.status === "PENDING",
  );

  const displayedRequests =
    activeTab === "incoming" ? incomingRequests : sentRequests;

  const renderItem = ({ item }: { item: any }) => {
    const isSender = item.senderId === currentUserId;

    const otherUser = isSender ? item.receiver : item.sender;

    const username =
      otherUser?.profile?.username || otherUser?.email || "Unknown User";

    const avatarUri = otherUser?.profile?.avatarUrl
      ? `${API_BASE_URL}${otherUser.profile.avatarUrl}`
      : null;

    const subtitle = isSender ? "Waiting for their response" : "Wants to chat";

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.userInfo}>
            <Text numberOfLines={1} style={styles.username}>
              {username}
            </Text>

            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        {!isSender ? (
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.declineButton}
              onPress={() => handleDeclineChatRequest(item.id)}
            >
              <Text style={styles.declineText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.acceptButton}
              onPress={() => handleAcceptChatRequest(item.id, otherUser.id)}
            >
              <Text style={styles.acceptText}>Accept</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.statusRow}>
            <Ionicons name="time-outline" size={18} color="#69708A" />

            <Text style={styles.pendingText}>Pending approval</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Decorative Background */}

      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      {/* Header */}

      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color="#0B1545" />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>Requests</Text>

          <Text style={styles.description}>Manage your chat requests</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab("incoming")}
          style={
            activeTab === "incoming" ? styles.activeTab : styles.inactiveTab
          }
        >
          <Text
            style={
              activeTab === "incoming"
                ? styles.activeTabText
                : styles.inactiveTabText
            }
          >
            Incoming
          </Text>

          {incomingRequests.length > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {incomingRequests.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab("sent")}
          style={activeTab === "sent" ? styles.activeTab : styles.inactiveTab}
        >
          <Text
            style={
              activeTab === "sent"
                ? styles.activeTabText
                : styles.inactiveTabText
            }
          >
            Sent
          </Text>

          {sentRequests.length > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{sentRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {/* Section */}

      <Text style={styles.sectionTitle}>Pending Requests</Text>

      {/* Requests */}

      <FlatList
        data={displayedRequests}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          displayedRequests.length === 0 && {
            flexGrow: 1,
            justifyContent: "center",
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchChatRequests();
            }}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={72}
              color="#2563EB"
            />

            <Text style={styles.emptyTitle}>
              {activeTab === "incoming"
                ? "No incoming requests"
                : "No pending requests"}
            </Text>

            <Text style={styles.emptySubtitle}>
              {activeTab === "incoming"
                ? "Chat requests from other users will appear here."
                : "Requests you are waiting on will appear here."}
            </Text>
          </View>
        }
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

  filterContainer: {
    marginTop: 18,
    marginHorizontal: 22,

    height: 58,

    borderRadius: 30,

    backgroundColor: "#F3F6FD",

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",

    paddingHorizontal: 8,
  },

  activeTab: {
    height: 42,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 20,

    borderRadius: 21,

    backgroundColor: "#2563EB",
  },

  inactiveTab: {
    height: 42,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 20,
  },

  activeTabText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },

  inactiveTabText: {
    color: "#5E6785",
    fontSize: 16,
    fontWeight: "600",
  },

  filterBadge: {
    marginLeft: 6,

    minWidth: 20,
    height: 20,

    borderRadius: 10,

    backgroundColor: "#FFFFFF",

    justifyContent: "center",
    alignItems: "center",

    paddingHorizontal: 5,
  },

  filterBadgeText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 11,
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
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 46,
    paddingHorizontal: 24,
  },

  headerText: {
    flex: 1,
    marginLeft: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0B1545",
    letterSpacing: -1,
  },

  description: {
    marginTop: 4,
    fontSize: 15,
    color: "#69708A",
  },

  /* Section */

  sectionTitle: {
    marginTop: 18,
    marginHorizontal: 24,

    fontSize: 18,
    fontWeight: "700",

    color: "#0B1545",
  },

  /* FlatList */

  listContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 120,
  },

  /* Card */

  requestCard: {
    backgroundColor: "#FFFFFF",

    borderRadius: 26,

    padding: 18,

    marginBottom: 16,

    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 7,
    },

    elevation: 4,
  },

  requestHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 31,
  },

  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 31,

    backgroundColor: "#E9EEFF",

    justifyContent: "center",
    alignItems: "center",
  },

  avatarLetter: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2563EB",
  },

  userInfo: {
    flex: 1,
    marginLeft: 16,
  },

  username: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B1545",
  },

  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: "#69708A",
  },

  /* Buttons */

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 18,
  },

  declineButton: {
    height: 44,

    paddingHorizontal: 20,

    borderRadius: 22,

    backgroundColor: "#EEF2F7",

    justifyContent: "center",
    alignItems: "center",

    marginRight: 12,
  },

  acceptButton: {
    height: 44,

    paddingHorizontal: 24,

    borderRadius: 22,

    backgroundColor: "#2563EB",

    justifyContent: "center",
    alignItems: "center",
  },

  declineText: {
    color: "#5E6785",
    fontSize: 15,
    fontWeight: "700",
  },

  acceptText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  /* Status */

  statusRow: {
    marginTop: 18,

    flexDirection: "row",
    alignItems: "center",
  },

  pendingText: {
    marginLeft: 8,
    color: "#69708A",
    fontSize: 15,
    fontWeight: "600",
  },

  /* Empty State */

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
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
