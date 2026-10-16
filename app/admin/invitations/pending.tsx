import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  PendingGroupInvitation,
  getPendingGroupInvitations,
  acceptGroupInvitation,
  declineGroupInvitation,
} from "@/src/services/admin/adminService";

import { API_BASE_URL } from "@/src/services/api/apiClient";

import { useSocket } from "@/hooks/useSocket";
import AdminBackground from "@/src/components/admin/AdminBackground";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type FeedbackState = {
  visible: boolean;
  type: FeedbackType;
  title: string;
  message: string;
};

export default function PendingInvitationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [groupInvitations, setGroupInvitations] = useState<
    PendingGroupInvitation[]
  >([]);

  const [processingInvitationId, setProcessingInvitationId] = useState<
    number | null
  >(null);

  const [processingAction, setProcessingAction] = useState<
    "ACCEPT" | "DECLINE" | null
  >(null);

  const [feedback, setFeedback] = useState<FeedbackState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
  });

  const { socketRef, connected } = useSocket();
  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
    });
  };

  const closeFeedback = () => {
    setFeedback((current) => ({
      ...current,
      visible: false,
    }));
  };

  const loadInvitations = useCallback(async () => {
    try {
      const response = await getPendingGroupInvitations();

      const sorted = [...response].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setGroupInvitations(sorted);
    } catch (error: any) {
      showFeedback(
        "error",
        "Unable to Load Invitations",
        error?.message || "Unable to load pending group invitations.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;
    if (!socket) return;

    const refreshInvitations = () => {
      loadInvitations();
    };

    socket.on("adminInvitationCreated", refreshInvitations);
    socket.on("adminInvitationAccepted", refreshInvitations);
    socket.on("adminInvitationDeclined", refreshInvitations);

    return () => {
      socket.off("adminInvitationCreated", refreshInvitations);
      socket.off("adminInvitationAccepted", refreshInvitations);
      socket.off("adminInvitationDeclined", refreshInvitations);
    };
  }, [connected, loadInvitations]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadInvitations();
  }, [loadInvitations]);

  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      setProcessingInvitationId(invitationId);
      setProcessingAction("ACCEPT");

      await acceptGroupInvitation(invitationId);
      await loadInvitations();

      showFeedback(
        "success",
        "Invitation Accepted",
        "The group invitation has been accepted successfully.",
      );
    } catch (error: any) {
      showFeedback(
        "error",
        "Unable to Accept Invitation",
        error?.message || "Unable to accept invitation.",
      );
    } finally {
      setProcessingInvitationId(null);
      setProcessingAction(null);
    }
  };

  const handleDeclineInvitation = async (invitationId: number) => {
    try {
      setProcessingInvitationId(invitationId);
      setProcessingAction("DECLINE");

      await declineGroupInvitation(invitationId);
      await loadInvitations();

      showFeedback(
        "success",
        "Invitation Declined",
        "The group invitation has been declined.",
      );
    } catch (error: any) {
      showFeedback(
        "error",
        "Unable to Decline Invitation",
        error?.message || "Unable to decline invitation.",
      );
    } finally {
      setProcessingInvitationId(null);
      setProcessingAction(null);
    }
  };

  /*
   * Generate initials for groups that do not have an avatar.
   *
   * Examples:
   * Sagamu Squad         -> SS
   * Powder Squad         -> PS
   * Fullstack Developers -> FD
   */
  const getGroupInitials = (name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return "G";
    }

    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  };

  /*
   * Keep the fallback avatar consistent with the
   * redesigned Groups screen.
   */
  const getAvatarStyle = (id: number) => {
    const variants = [
      {
        backgroundColor: "#EEE8FF",
        textColor: "#7257E8",
      },
      {
        backgroundColor: "#E8F5FF",
        textColor: "#3578D4",
      },
      {
        backgroundColor: "#E8F8F0",
        textColor: "#2EB875",
      },
      {
        backgroundColor: "#FFF0E7",
        textColor: "#E88932",
      },
      {
        backgroundColor: "#F1ECFF",
        textColor: "#8A5CE6",
      },
    ];

    return variants[Math.abs(id) % variants.length];
  };

  /*
   * Build the actual group avatar URL.
   *
   * The backend stores relative paths such as:
   * /uploads/groups/avatars/...
   *
   * Absolute URLs are also supported.
   */
  const getGroupAvatarUri = (avatarUrl: string | null) => {
    if (!avatarUrl) {
      return null;
    }

    if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
      return avatarUrl;
    }

    return `${API_BASE_URL}${avatarUrl}`;
  };

  if (loading) {
    return (
      <AdminBackground>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7257E8" />

          <AppFeedbackModal
            visible={feedback.visible}
            type={feedback.type}
            title={feedback.title}
            message={feedback.message}
            onClose={closeFeedback}
          />
        </SafeAreaView>
      </AdminBackground>
    );
  }

  return (
    <AdminBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#7257E8"
              colors={["#7257E8"]}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          {/* HEADER */}

          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.7}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={27} color="#111B3A" />
            </TouchableOpacity>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Pending Invitations</Text>

              <Text style={styles.headerSubtitle}>
                Review and manage group invitations
              </Text>
            </View>
          </View>

          {/* SUMMARY */}

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="hourglass-outline" size={27} color="#F28C28" />
            </View>

            <View>
              <Text style={styles.summaryNumber}>
                {groupInvitations.length}
              </Text>

              <Text style={styles.summaryLabel}>Pending Group Invitations</Text>
            </View>
          </View>

          {/* INVITATIONS */}

          {groupInvitations.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="mail-open-outline" size={30} color="#7257E8" />
              </View>

              <Text style={styles.emptyTitle}>No pending invitations</Text>

              <Text style={styles.emptyDescription}>
                There are currently no pending group invitations to review.
              </Text>
            </View>
          ) : (
            groupInvitations.map((item) => {
              const isProcessing = processingInvitationId === item.id;

              const avatarUri = getGroupAvatarUri(item.group.avatarUrl);

              const avatar = getAvatarStyle(item.group.id);

              const initials = getGroupInitials(item.group.name);

              return (
                <View key={item.id} style={styles.invitationCard}>
                  <View style={styles.invitationMain}>
                    {/* REAL GROUP AVATAR */}

                    <View style={styles.groupAvatar}>
                      {avatarUri ? (
                        <Image
                          source={{ uri: avatarUri }}
                          style={styles.groupAvatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[
                            styles.groupAvatarFallback,
                            {
                              backgroundColor: avatar.backgroundColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.groupAvatarText,
                              {
                                color: avatar.textColor,
                              },
                            ]}
                          >
                            {initials}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.invitationDetails}>
                      <View style={styles.titleRow}>
                        <Text style={styles.groupTitle} numberOfLines={2}>
                          {item.group.name}
                        </Text>

                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Pending</Text>
                        </View>
                      </View>

                      {!!item.group.description && (
                        <Text style={styles.description} numberOfLines={2}>
                          {item.group.description}
                        </Text>
                      )}

                      <Text style={styles.infoText}>
                        Invited by {item.invitedBy.firstName}{" "}
                        {item.invitedBy.lastName}
                      </Text>

                      <Text style={styles.infoText}>
                        @{item.invitedBy.profile?.username || "unknown"}
                      </Text>

                      <Text style={styles.infoText}>
                        Role: {item.inviterRole}
                      </Text>

                      <Text style={styles.infoText}>
                        Members: {item.group.members.length}
                      </Text>

                      <Text style={styles.dateText}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {/* ACTIONS */}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.actionButton}
                      onPress={() =>
                        router.push({
                          pathname: "/admin/group/[groupId]" as any,
                          params: {
                            groupId: String(item.group.id),
                          },
                        })
                      }
                    >
                      <Ionicons name="eye-outline" size={21} color="#7257E8" />

                      <Text style={styles.viewGroupText}>View Group</Text>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={isProcessing}
                      style={styles.actionButton}
                      onPress={() => handleAcceptInvitation(item.id)}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={21}
                        color="#2EB875"
                      />

                      <Text style={styles.acceptText}>
                        {isProcessing && processingAction === "ACCEPT"
                          ? "Accepting..."
                          : "Accept"}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={isProcessing}
                      style={styles.actionButton}
                      onPress={() => handleDeclineInvitation(item.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={21}
                        color="#E53935"
                      />

                      <Text style={styles.declineText}>
                        {isProcessing && processingAction === "DECLINE"
                          ? "Declining..."
                          : "Decline"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <View style={styles.bottomSpacing} />
        </ScrollView>

        <AppFeedbackModal
          visible={feedback.visible}
          type={feedback.type}
          title={feedback.title}
          message={feedback.message}
          onClose={closeFeedback}
        />
      </SafeAreaView>
    </AdminBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  /* ============================================================
     HEADER
     ============================================================ */

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "flex-start",
  },

  headerTextContainer: {
    flex: 1,
    paddingLeft: 2,
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: "#111B3A",
  },

  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: "#68728D",
  },

  /* ============================================================
     SUMMARY
     ============================================================ */

  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,

    shadowColor: "#737A99",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },

  summaryIcon: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: "#FFF0E7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  summaryNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111B3A",
  },

  summaryLabel: {
    marginTop: 3,
    color: "#68728D",
    fontSize: 13,
  },

  /* ============================================================
     INVITATION CARD
     ============================================================ */

  invitationCard: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 24,
    marginBottom: 18,
    overflow: "hidden",

    shadowColor: "#737A99",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },

  invitationMain: {
    flexDirection: "row",
    padding: 18,
  },

  /* ============================================================
     REAL GROUP AVATAR
     ============================================================ */

  groupAvatar: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    flexShrink: 0,
  },

  groupAvatarImage: {
    width: "100%",
    height: "100%",
  },

  groupAvatarFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  groupAvatarText: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  /* ============================================================
     INVITATION DETAILS
     ============================================================ */

  invitationDetails: {
    flex: 1,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 7,
  },

  groupTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#111B3A",
    marginRight: 8,
  },

  pendingBadge: {
    backgroundColor: "#FFF0DE",
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },

  pendingBadgeText: {
    color: "#F28C28",
    fontSize: 11,
    fontWeight: "700",
  },

  description: {
    fontSize: 13,
    color: "#68728D",
    marginBottom: 8,
    lineHeight: 19,
  },

  infoText: {
    fontSize: 13,
    color: "#68728D",
    marginBottom: 5,
  },

  dateText: {
    fontSize: 12,
    color: "#7C8499",
    marginTop: 2,
  },

  /* ============================================================
     ACTIONS
     ============================================================ */

  actions: {
    height: 58,
    borderTopWidth: 1,
    borderTopColor: "#E9EAF0",
    flexDirection: "row",
  },

  actionButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  divider: {
    width: 1,
    height: 28,
    backgroundColor: "#E3E5EC",
    alignSelf: "center",
  },

  viewGroupText: {
    color: "#7257E8",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
  },

  acceptText: {
    color: "#2EB875",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
  },

  declineText: {
    color: "#E53935",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 5,
  },

  /* ============================================================
     EMPTY STATE
     ============================================================ */

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 22,
    padding: 30,
    alignItems: "center",
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F0EDFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111B3A",
  },

  emptyDescription: {
    textAlign: "center",
    color: "#7B8397",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },

  bottomSpacing: {
    height: 40,
  },
});
