import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { acceptCall, declineCall } from "@/src/services/calls/callService";
import { useCallStore } from "@/src/store/call/callStore";

export default function IncomingCallModal() {
  const incomingCall = useCallStore((state) => state.incomingCall);
  const setActiveCall = useCallStore((state) => state.setActiveCall);
  const clearIncomingCall = useCallStore((state) => state.clearIncomingCall);
  const setError = useCallStore((state) => state.setError);

  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!incomingCall) return null;

  const callerName =
    incomingCall.scope === "GROUP"
      ? (incomingCall.group?.name ?? "Group call")
      : (incomingCall.caller?.username ?? "Zleenchat user");

  const callLabel = incomingCall.type === "VIDEO" ? "Video call" : "Voice call";

  const handleAccept = async () => {
    if (!incomingCall || working) return;

    setWorking(true);
    setMessage(null);

    try {
      const result = await acceptCall(incomingCall.callId);

      if (result.status !== "ACCEPTED" && result.status !== "ACTIVE") {
        clearIncomingCall(incomingCall.callId);

        const errorMessage = "This call is no longer available.";
        setError(errorMessage);
        Alert.alert("Call unavailable", errorMessage);
        return;
      }

      setActiveCall({
        ...incomingCall,
        status: result.status,
      });
      clearIncomingCall(incomingCall.callId);

      router.push({
        pathname: "/calls/[callId]" as any,
        params: { callId: String(incomingCall.callId) },
      });
    } catch (error: any) {
      const errorMessage =
        typeof error?.message === "string"
          ? error.message
          : "Could not accept the call.";

      setMessage(errorMessage);
      setError(errorMessage);
    } finally {
      setWorking(false);
    }
  };

  const handleDecline = async () => {
    if (!incomingCall || working) return;

    setWorking(true);
    setMessage(null);

    try {
      await declineCall(incomingCall.callId);
      clearIncomingCall(incomingCall.callId);
    } catch (error: any) {
      const errorMessage =
        typeof error?.message === "string"
          ? error.message
          : "Could not decline the call.";

      setMessage(errorMessage);
      setError(errorMessage);
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => void handleDecline()}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={incomingCall.type === "VIDEO" ? "videocam" : "call"}
              size={30}
              color="#2563EB"
            />
          </View>

          <Text style={styles.label}>{callLabel}</Text>
          <Text style={styles.name}>{callerName}</Text>

          <Text style={styles.detail}>
            {incomingCall.scope === "GROUP"
              ? `${incomingCall.caller?.username ?? "A group member"} is calling the group`
              : "Incoming call"}
          </Text>

          {message ? <Text style={styles.error}>{message}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decline call"
              disabled={working}
              onPress={() => void handleDecline()}
              style={[styles.actionButton, styles.declineButton]}
            >
              <Ionicons name="call" size={22} color="#FFFFFF" />
              <Text style={styles.actionText}>Decline</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Accept call"
              disabled={working}
              onPress={() => void handleAccept()}
              style={[styles.actionButton, styles.acceptButton]}
            >
              {working ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name={incomingCall.type === "VIDEO" ? "videocam" : "call"}
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionText}>Accept</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(10, 20, 45, 0.58)",
  },
  card: {
    alignItems: "center",
    padding: 26,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  iconCircle: {
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 35,
    backgroundColor: "#EEF4FF",
  },
  label: {
    marginTop: 18,
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
  name: {
    marginTop: 6,
    color: "#0B1545",
    fontSize: 22,
    fontWeight: "700",
  },
  detail: {
    marginTop: 6,
    color: "#69708A",
    fontSize: 14,
    textAlign: "center",
  },
  error: {
    marginTop: 12,
    color: "#B42318",
    fontSize: 13,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 14,
    marginTop: 28,
  },
  actionButton: {
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 24,
  },
  declineButton: {
    backgroundColor: "#DC2626",
  },
  acceptButton: {
    backgroundColor: "#16A34A",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});