import { useLocalSearchParams } from "expo-router";
import ChatScreen from "@/src/screens/chats/ChatScreen";

export default function ChatRoute() {
  const params = useLocalSearchParams();

  // ✅ FIX: ensure proper parsing
  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const parsedUserId = Number(userId);

  if (!parsedUserId) return null; //

  return <ChatScreen />;
}
