import { API_BASE_URL } from "@/src/services/api/apiClient";

import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Image,
} from "react-native";
import { useFocusEffect, router } from "expo-router";

import {
  getMyNotifications,
  markNotificationAsRead,
} from "@/src/services/notifications/notificationService";

export default function NotificationScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await getMyNotifications();
      setNotifications(data);
    } catch (error) {
      console.log("Notification error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const openNotification = async (item: any) => {
    try {
      if (!item.isRead) {
        await markNotificationAsRead(item.id);
      }

      switch (item.type) {
        case "GROUP_MENTION":
          router.push({
            pathname: "/groups/[groupId]",
            params: {
              groupId: String(item.data.groupId),
              messageId: String(item.data.messageId),
            },
          });
          break;

        case "GROUP_MEMBER_ADDED":
        case "GROUP_AVATAR_UPDATED":
        case "GROUP_AVATAR_REMOVED":
        case "GROUP_RENAMED":
          router.push({
            pathname: "/groups/[groupId]",
            params: {
              groupId: String(item.data.groupId),
            },
          });
          break;

        case "GROUP_DESCRIPTION_CHANGED":
          router.push({
            pathname: "/groups/group-info",
            params: {
              groupId: String(item.data.groupId),
            },
          });
          break;

        case "GROUP_MEMBER_REMOVED":
        case "GROUP_MEMBER_LEFT":
          router.push("/group");
          break;

        default:
          break;
      }
    } catch (error) {
      console.log(error);
    }
  };

  const renderItem = ({ item }: any) => {
    const avatar = item.sender?.profile?.avatarUrl
      ? `${API_BASE_URL}${item.sender.profile.avatarUrl}`
      : null;

    return (
      <TouchableOpacity
        style={[styles.card, !item.isRead && styles.unreadCard]}
        onPress={() => openNotification(item)}
      >
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarLetter}>
              {item.sender?.profile?.username?.charAt(0)?.toUpperCase() ?? "U"}
            </Text>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.username}>{item.sender?.profile?.username}</Text>

          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.time}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>

        {!item.isRead && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#25D366" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.empty}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },

  header: {
    backgroundColor: "#075E54",
    paddingTop: 55,
    paddingBottom: 18,
    alignItems: "center",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  empty: {
    color: "#777",
    fontSize: 16,
  },

  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDD",
  },

  unreadCard: {
    backgroundColor: "#F0FFF4",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
  },

  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#DDD",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  avatarLetter: {
    fontSize: 20,
    fontWeight: "700",
    color: "#555",
  },

  content: {
    flex: 1,
  },

  username: {
    fontWeight: "700",
    fontSize: 15,
  },

  title: {
    marginTop: 2,
    fontSize: 14,
  },

  body: {
    marginTop: 3,
    color: "#666",
  },

  time: {
    marginTop: 6,
    fontSize: 11,
    color: "#999",
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#25D366",
    alignSelf: "center",
  },
});
