import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { searchUsers } from "@/src/services/user/userService";
import { API_BASE_URL } from "@/src/services/api/apiClient";

type User = {
  id: number;
  username: string;
  avatarUrl: string | null;
};

export default function ExploreScreen() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

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

  const hasSearch = query.trim().length > 0;

  const filteredUsers = useMemo(() => {
    return users;
  }, [users]);

  const renderItem = ({ item }: { item: User }) => {
    const avatarUri = item.avatarUrl
      ? `${API_BASE_URL}${item.avatarUrl}`
      : null;

    return (
      <TouchableOpacity
        style={styles.userCard}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/profile/[userId]",
            params: {
              userId: item.id.toString(),
            },
          })
        }
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarLetter}>
              {(item.username || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text numberOfLines={1} style={styles.username}>
            {item.username}
          </Text>

          <Text style={styles.subtitle}>Available to chat</Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color="#C5CBDC" />
      </TouchableOpacity>
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
          <Text style={styles.title}>Explore</Text>

          <Text style={styles.description}>Discover people around you</Text>
        </View>
      </View>

      {/* Search */}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#69708A" />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users..."
          placeholderTextColor="#9CA3AF"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>

      {/* Section Title */}

      <Text style={styles.sectionTitle}>People</Text>

      {/* Results */}

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          filteredUsers.length === 0 && {
            flexGrow: 1,
            justifyContent: "center",
          },
        ]}
        ListEmptyComponent={
          hasSearch ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={72} color="#2563EB" />

              <Text style={styles.emptyTitle}>No users found</Text>

              <Text style={styles.emptySubtitle}>
                Try another username or search keyword.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={72} color="#2563EB" />

              <Text style={styles.emptyTitle}>Discover people</Text>

              <Text style={styles.emptySubtitle}>
                Start typing to search for other users.
              </Text>
            </View>
          )
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
    marginLeft: 10,
    flex: 1,
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

  /* Search */

  searchContainer: {
    marginTop: 18,
    marginHorizontal: 22,

    height: 58,

    borderRadius: 29,

    backgroundColor: "#F3F6FD",

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 16,

    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },

    elevation: 4,
  },

  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#0B1545",
  },

  /* Section */

  sectionTitle: {
    marginTop: 18,
    marginHorizontal: 24,

    fontSize: 18,
    fontWeight: "700",

    color: "#0B1545",
  },

  /* List */

  listContent: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 120,
  },

  /* User Card */

  userCard: {
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
    marginRight: 12,
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
