import { useEffect, useMemo, useState } from "react";
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getMessageableContacts } from "@/src/services/contact/contactService";
import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type Contact = {
  id: number;
  username: string;
  avatarUrl?: string;
  hasConversation: boolean;
};

type FeedbackState = {
  visible: boolean;
  type: FeedbackType;
  title: string;
  message: string;
};

const INITIAL_FEEDBACK_STATE: FeedbackState = {
  visible: false,
  type: "info",
  title: "",
  message: "",
};

export default function NewChatScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [feedback, setFeedback] = useState<FeedbackState>(
    INITIAL_FEEDBACK_STATE,
  );

  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
    });
  };

  const closeFeedback = () => {
    setFeedback((previous) => ({
      ...previous,
      visible: false,
    }));
  };

  useEffect(() => {
    const loadContacts = async () => {
      try {
        setLoading(true);

        const data = await getMessageableContacts();

        setContacts(data || []);
      } catch (error) {
        console.log("Load contacts error:", error);

        showFeedback(
          "error",
          "Unable to Load Contacts",
          "We couldn't load your contacts right now. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return contacts;
    }

    return contacts.filter((contact) =>
      contact.username.toLowerCase().includes(query),
    );
  }, [contacts, search]);

  const renderItem = ({ item }: { item: Contact }) => {
    const avatarUri = item.avatarUrl
      ? `${API_BASE_URL}${item.avatarUrl}`
      : null;

    return (
      <TouchableOpacity
        style={styles.contactRow}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/chats/[userId]",
            params: {
              userId: item.id.toString(),
              username: item.username,
              avatarUrl: item.avatarUrl,
            },
          })
        }
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

        <View style={styles.contactInfo}>
          <Text numberOfLines={1} style={styles.username}>
            {item.username}
          </Text>

          <Text style={styles.subtitle}>
            {item.hasConversation
              ? "Open conversation"
              : "Start a new conversation"}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={22} color="#C5CBDC" />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />

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
          <Text style={styles.title}>New Chat</Text>

          <Text style={styles.description}>Choose someone to message</Text>
        </View>

        {/* Keeps the title centered */}

        <View style={{ width: 28 }} />
      </View>

      {/* Search */}

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#69708A" />

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search contacts"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {/* Contact List */}

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          filteredContacts.length === 0 && {
            flexGrow: 1,
            justifyContent: "center",
          },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={72}
              color="#2563EB"
            />

            <Text style={styles.emptyTitle}>No contacts yet</Text>

            <Text style={styles.emptySubtitle}>
              Accept a chat request to start messaging.
            </Text>
          </View>
        }
      />

      {/* Branded Feedback Modal */}

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
    paddingTop: 46,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerText: {
    flex: 1,
    marginLeft: 10,
  },

  description: {
    marginTop: 4,
    fontSize: 15,
    color: "#69708A",
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0B1545",
    letterSpacing: -1,
  },

  /* Search */

  searchContainer: {
    marginHorizontal: 22,
    marginTop: 26,
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

  /* Contact List */

  listContent: {
    paddingHorizontal: 22,
    paddingBottom: 120,
  },

  contactRow: {
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

  contactInfo: {
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
