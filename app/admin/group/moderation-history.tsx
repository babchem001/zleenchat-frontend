import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useSocket } from "@/hooks/useSocket";

import { getGroupModerationHistory } from "@/src/services/group/groupService";

export default function ModerationHistoryScreen() {
  const { groupId } = useLocalSearchParams();
  const { socketRef, connected } = useSocket();

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const refreshHistory = ({
      groupId: updatedGroupId,
    }: {
      groupId: number;
    }) => {
      if (Number(updatedGroupId) !== Number(groupId)) return;

      loadHistory();
    };

    socket.on("memberWarned", refreshHistory);
    socket.on("memberMuted", refreshHistory);
    socket.on("memberUnmuted", refreshHistory);
    socket.on("memberRemovedByAdmin", refreshHistory);

    return () => {
      socket.off("memberWarned", refreshHistory);
      socket.off("memberMuted", refreshHistory);
      socket.off("memberUnmuted", refreshHistory);
      socket.off("memberRemovedByAdmin", refreshHistory);
    };
  }, [connected, groupId]);

  const loadHistory = async () => {
    try {
      const data = await getGroupModerationHistory(Number(groupId));
      setHistory(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <Text style={styles.action}>{item.action.replaceAll("_", " ")}</Text>

      <Text style={styles.text}>
        Moderator:{" "}
        {item.admin?.profile?.username ??
          `${item.admin?.firstName ?? ""} ${item.admin?.lastName ?? ""}`.trim() ??
          "Unknown"}
      </Text>

      <Text style={styles.text}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>

      {item.metadata ? (
        <Text style={styles.reason}>{JSON.stringify(item.metadata)}</Text>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (history.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>
          No moderation actions have been recorded for this group yet.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={history}
        keyExtractor={(item, index) => item.id?.toString() ?? index.toString()}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EDEDED",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    backgroundColor: "#FFF",
    marginHorizontal: 14,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },

  action: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 10,
    color: "#075E54",
  },

  text: {
    fontSize: 15,
    marginBottom: 4,
  },

  reason: {
    marginTop: 10,
    color: "#666",
    fontStyle: "italic",
  },
});
