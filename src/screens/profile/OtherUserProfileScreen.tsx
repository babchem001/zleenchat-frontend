import { API_BASE_URL } from "@/src/services/api/apiClient";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";

import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getToken } from "@/src/services/storage/tokenService";

import {
  sendChatRequest,
  getMyChatRequest,
  acceptChatRequest,
  declineChatRequest,
} from "@/src/services/chatRequest/chatRequestService";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

export default function OtherUserProfileScreen() {
  const { userId } = useLocalSearchParams();

  const parsedUserId = Array.isArray(userId) ? userId[0] : userId;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [profileAccessible, setProfileAccessible] = useState(true);

  const [profileUnavailableMessage, setProfileUnavailableMessage] = useState(
    "You don't have permission to view this profile.",
  );

  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [requestActionLoading, setRequestActionLoading] = useState(false);
  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedbackType(type);
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackVisible(true);
  };

  const closeFeedback = () => {
    setFeedbackVisible(false);
  };

  useEffect(() => {
    if (parsedUserId) {
      // console.log("✅ USER ID READY:", parsedUserId);
    }
  }, [parsedUserId]);

  useEffect(() => {
    if (!parsedUserId) return;

    fetchProfileAndRequest();
  }, [parsedUserId]);

  const fetchProfileAndRequest = async () => {
    try {
      setLoading(true);
      setProfile(null);
      setRequest(null);
      setProfileAccessible(true);
      setProfileUnavailableMessage(
        "You don't have permission to view this profile.",
      );

      const token = await getToken();

      if (!parsedUserId) {
        console.log("❌ No userId, skipping fetch");

        setProfileAccessible(false);
        setProfileUnavailableMessage(
          "The profile you are trying to view is unavailable.",
        );

        return;
      }

      const response = await fetch(`${API_BASE_URL}/profile/${parsedUserId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 403) {
        setProfileAccessible(false);
        setProfileUnavailableMessage(
          "You don't have permission to view this profile.",
        );

        return;
      }

      if (response.status === 404) {
        setProfileAccessible(false);
        setProfileUnavailableMessage(
          "This profile could not be found or is no longer available.",
        );

        return;
      }

      if (!response.ok) {
        setProfileAccessible(false);
        setProfileUnavailableMessage(
          "This profile is currently unavailable. Please try again later.",
        );

        return;
      }

      const userData = await response.json();

      if (!userData || !userData.username) {
        setProfileAccessible(false);
        setProfileUnavailableMessage("This profile is currently unavailable.");

        return;
      }

      setProfile(userData);
      setProfileAccessible(true);

      try {
        const requestData = await getMyChatRequest();

        const currentUserId = requestData.currentUserId;
        const requests = requestData.requests;

        const existing = requests.find(
          (r: any) =>
            (r.senderId === currentUserId &&
              r.receiverId === Number(parsedUserId)) ||
            (r.receiverId === currentUserId &&
              r.senderId === Number(parsedUserId)),
        );

        setRequest(existing || null);
      } catch (requestError) {
        console.log("Chat request fetch error:", requestError);
        setRequest(null);
      }
    } catch (error) {
      console.log("Profile fetch error:", error);
      setProfileAccessible(false);
      setProfileUnavailableMessage(
        "We couldn't load this profile. Please check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendChatRequest = async () => {
    try {
      setSending(true);
      await sendChatRequest(Number(parsedUserId));
      await fetchProfileAndRequest();
      showFeedback(
        "success",
        "Chat Request Sent",
        "Your chat request has been sent successfully.",
      );
    } catch (error) {
      showFeedback(
        "error",
        "Request Failed",
        "Unable to send your chat request. Please try again.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleAcceptChatRequest = async () => {
    try {
      setRequestActionLoading(true);

      await acceptChatRequest(request.id);
      await fetchProfileAndRequest();

      router.push({
        pathname: "/chats/[userId]",
        params: {
          userId: parsedUserId.toString(),
          username: profile.username,
          avatarUrl: profile.avatarUrl ?? "",
        },
      });
    } catch (error) {
      console.log("Accept request error:", error);

      showFeedback(
        "error",
        "Unable to Accept Request",
        "Something went wrong while accepting this chat request. Please try again.",
      );
    } finally {
      setRequestActionLoading(false);
    }
  };

  const handleDeclineChatRequest = async () => {
    try {
      setRequestActionLoading(true);

      await declineChatRequest(request.id);
      await fetchProfileAndRequest();
      showFeedback(
        "success",
        "Request Declined",
        "The chat request has been declined.",
      );
    } catch (error) {
      console.log("Decline request error:", error);

      showFeedback(
        "error",
        "Unable to Decline Request",
        "Something went wrong while declining this chat request. Please try again.",
      );
    } finally {
      setRequestActionLoading(false);
    }
  };

  const avatarUri = profile?.avatarUrl
    ? `${API_BASE_URL}${profile.avatarUrl}`
    : null;

  const fullName = `${profile?.user?.firstName ?? ""} ${
    profile?.user?.lastName ?? ""
  }`.trim();

  const hasBio = profile?.bio && profile.bio.trim().length > 0;

  const hasEmail =
    typeof profile?.user?.email === "string" &&
    profile.user.email.trim().length > 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!profileAccessible || !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.topBlob} />
        <View style={styles.bottomBlob} />
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        <View style={styles.unavailableContainer}>
          <View style={styles.lockCircle}>
            <Ionicons name="lock-closed-outline" size={42} color="#2563EB" />
          </View>

          <Text style={styles.unavailableTitle}>Profile unavailable</Text>

          <Text style={styles.unavailableSubtitle}>
            {profileUnavailableMessage}
          </Text>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>

        <AppFeedbackModal
          visible={feedbackVisible}
          type={feedbackType}
          title={feedbackTitle}
          message={feedbackMessage}
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
          <Text style={styles.title}>Profile</Text>

          <Text style={styles.description}>View user information</Text>
        </View>
      </View>

      {/* Profile Card */}

      <View style={styles.profileCard}>
        <View style={styles.avatarRing}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {profile.username.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>{fullName}</Text>

        <Text style={styles.username}>@{profile.username}</Text>

        {hasEmail && (
          <View style={styles.emailContainer}>
            <Ionicons name="mail-outline" size={16} color="#2563EB" />

            <Text style={styles.emailText}>{profile.user.email}</Text>
          </View>
        )}

        <View style={styles.memberBadge}>
          <Ionicons name="person-outline" size={14} color="#2563EB" />

          <Text style={styles.memberText}>Member</Text>
        </View>

        <View style={styles.bioCard}>
          <Text style={styles.bioTitle}>Bio</Text>

          <Text style={hasBio ? styles.bio : styles.emptyBio}>
            {hasBio ? profile.bio : "This user hasn't written a bio yet."}
          </Text>
        </View>

        {/* Actions */}

        {!request && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={handleSendChatRequest}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Send Chat Request</Text>
            )}
          </TouchableOpacity>
        )}

        {request &&
          request.receiverId === Number(parsedUserId) &&
          request.status === "PENDING" && (
            <View style={styles.statusContainer}>
              <Ionicons name="time-outline" size={18} color="#69708A" />

              <Text style={styles.pendingText}>Request Pending</Text>
            </View>
          )}

        {request &&
          request.senderId === Number(parsedUserId) &&
          request.status === "PENDING" && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  requestActionLoading && styles.disabledButton,
                ]}
                onPress={handleDeclineChatRequest}
                disabled={requestActionLoading}
              >
                {requestActionLoading ? (
                  <ActivityIndicator color="#5E6785" />
                ) : (
                  <Text style={styles.secondaryButtonText}>Decline</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.primarySmallButton,
                  requestActionLoading && styles.disabledButton,
                ]}
                onPress={handleAcceptChatRequest}
                disabled={requestActionLoading}
              >
                {requestActionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

        {request && request.status === "ACCEPTED" && (
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.primaryButton}
            onPress={() =>
              router.push({
                pathname: "/chats/[userId]",
                params: {
                  userId: parsedUserId.toString(),
                  username: profile.username,
                  avatarUrl: profile.avatarUrl ?? "",
                },
              })
            }
          >
            <Ionicons
              name="chatbubble-outline"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />

            <Text style={styles.primaryButtonText}>Open Chat</Text>
          </TouchableOpacity>
        )}

        {request && request.status === "DECLINED" && (
          <>
            <View style={styles.statusContainer}>
              <Ionicons name="close-circle" size={18} color="#EF4444" />

              <Text style={styles.declinedText}>Chat request declined</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.primaryButton}
              onPress={handleSendChatRequest}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Request Again</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* GLOBAL SCREEN FEEDBACK */}

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
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

  /* Profile Card */

  profileCard: {
    marginHorizontal: 22,
    marginTop: 18,

    backgroundColor: "#FFFFFF",

    borderRadius: 30,

    paddingHorizontal: 24,
    paddingVertical: 30,

    alignItems: "center",

    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 8,
    },

    elevation: 5,
  },

  avatarRing: {
    width: 150,
    height: 150,
    borderRadius: 75,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "#E9EEFF",
  },

  avatar: {
    width: 136,
    height: 136,
    borderRadius: 68,
  },

  avatarPlaceholder: {
    width: 136,
    height: 136,
    borderRadius: 68,

    backgroundColor: "#2563EB",

    justifyContent: "center",
    alignItems: "center",
  },

  avatarLetter: {
    fontSize: 52,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  name: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
  },

  username: {
    marginTop: 6,
    fontSize: 16,
    color: "#69708A",
  },

  emailContainer: {
    marginTop: 14,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#F8FAFF",

    borderRadius: 18,

    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  emailText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
  },

  /* Badge */

  memberBadge: {
    marginTop: 18,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#EEF4FF",

    borderRadius: 18,

    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  memberText: {
    marginLeft: 6,
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 14,
  },

  /* Bio */

  bioCard: {
    marginTop: 18,

    width: "100%",

    backgroundColor: "#F8FAFF",

    borderRadius: 20,

    padding: 18,
  },

  bioTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1545",
    marginBottom: 10,
  },

  bio: {
    fontSize: 15,
    lineHeight: 24,
    color: "#475569",
  },

  emptyBio: {
    fontSize: 15,
    color: "#94A3B8",
    fontStyle: "italic",
    lineHeight: 24,
  },

  /* Buttons */

  primaryButton: {
    marginTop: 30,

    width: "100%",
    height: 54,

    borderRadius: 27,

    backgroundColor: "#2563EB",

    justifyContent: "center",
    alignItems: "center",

    flexDirection: "row",
  },

  primarySmallButton: {
    flex: 1,

    height: 50,

    borderRadius: 25,

    backgroundColor: "#2563EB",

    justifyContent: "center",
    alignItems: "center",

    flexDirection: "row",
  },

  secondaryButton: {
    flex: 1,

    height: 50,

    borderRadius: 25,

    backgroundColor: "#EEF2F7",

    justifyContent: "center",
    alignItems: "center",

    marginRight: 12,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryButtonText: {
    color: "#5E6785",
    fontSize: 16,
    fontWeight: "700",
  },

  actionRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 18,
  },

  /* Status */

  statusContainer: {
    marginTop: 18,

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#F8FAFF",

    borderRadius: 18,

    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  pendingText: {
    marginLeft: 8,
    color: "#69708A",
    fontSize: 15,
    fontWeight: "600",
  },

  declinedText: {
    marginLeft: 8,
    color: "#EF4444",
    fontSize: 15,
    fontWeight: "700",
  },

  /* Unavailable */

  unavailableContainer: {
    flex: 1,

    justifyContent: "center",
    alignItems: "center",

    paddingHorizontal: 36,
  },

  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,

    backgroundColor: "#EEF4FF",

    justifyContent: "center",
    alignItems: "center",
  },

  unavailableTitle: {
    marginTop: 26,

    fontSize: 28,
    fontWeight: "800",

    color: "#0B1545",

    textAlign: "center",
  },

  unavailableSubtitle: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 26,
    color: "#69708A",
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },
});
