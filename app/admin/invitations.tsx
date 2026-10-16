import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";

import {
  InvitationCode,
  PendingGroupInvitation,
  createInvitationCode,
  getInvitationCodes,
  getPendingGroupInvitations,
  acceptGroupInvitation,
  declineGroupInvitation,
  cancelInvitationCode,
} from "@/src/services/admin/adminService";

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
  buttonText?: string;
};

export default function InvitationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const [processingInvitationId, setProcessingInvitationId] = useState<
    number | null
  >(null);

  const [processingAction, setProcessingAction] = useState<
    "ACCEPT" | "DECLINE" | null
  >(null);

  const [codes, setCodes] = useState<InvitationCode[]>([]);

  const [groupInvitations, setGroupInvitations] = useState<
    PendingGroupInvitation[]
  >([]);

  // STEP 6 CHANGE: Track the invitation code currently being cancelled.
  const [cancellingCodeId, setCancellingCodeId] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<FeedbackState>({
    visible: false,
    type: "info",
    title: "",
    message: "",
    buttonText: "OK",
  });

  const { socketRef, connected } = useSocket();

  const showFeedback = (
    type: FeedbackType,
    title: string,
    message: string,
    buttonText = "OK",
  ) => {
    setFeedback({
      visible: true,
      type,
      title,
      message,
      buttonText,
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
      const [codesResponse, groupInvitationResponse] = await Promise.all([
        getInvitationCodes(),
        getPendingGroupInvitations(),
      ]);

      setCodes(codesResponse);
      setGroupInvitations(groupInvitationResponse);
    } catch (error: any) {
      showFeedback(
        "error",
        "Unable to Load",
        error?.message || "Unable to load invitations.",
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

  const handleGenerate = async () => {
    try {
      setCreating(true);

      await createInvitationCode();
      await loadInvitations();

      showFeedback(
        "success",
        "Code Generated",
        "A new invitation code has been generated successfully.",
      );
    } catch (error: any) {
      showFeedback(
        "error",
        "Unable to Generate Code",
        error?.message || "Unable to generate invitation code.",
      );
    } finally {
      setCreating(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);

      showFeedback(
        "success",
        "Copied",
        "Invitation code copied to your clipboard.",
      );
    } catch {
      showFeedback("error", "Copy Failed", "Unable to copy invitation code.");
    }
  };

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
        "Unable to Accept",
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
        "Unable to Decline",
        error?.message || "Unable to decline invitation.",
      );
    } finally {
      setProcessingInvitationId(null);
      setProcessingAction(null);
    }
  };

  const handleViewCodeDetails = (item: InvitationCode) => {
    const createdBy =
      `${item.createdByUser.firstName} ` + `${item.createdByUser.lastName}`;

    const usedBy = item.usedBy
      ? `${item.usedBy.firstName} ${item.usedBy.lastName}`
      : "Not used";

    showFeedback(
      "info",
      "Invitation Code",
      [
        `Code: ${item.code}`,
        `Created: ${new Date(item.createdAt).toLocaleString()}`,
        `Created by: ${createdBy}`,
        `Used by: ${usedBy}`,
        `Status: ${item.status ?? (item.used ? "REDEEMED" : "AVAILABLE")}`,
      ].join("\n\n"),
      "Close",
    );
  };

  // STEP 6 CHANGE: Cancel an active invitation code and update it locally.
  const handleCancelInvitationCode = async (invitationId: number) => {
    try {
      setCancellingCodeId(invitationId);

      await cancelInvitationCode(invitationId);

      setCodes((currentCodes) =>
        currentCodes.map((code) =>
          code.id === invitationId
            ? {
                ...code,
                status: "CANCELLED",
              }
            : code,
        ),
      );

      showFeedback(
        "success",
        "Invitation Cancelled",
        "The invitation code has been cancelled successfully.",
      );
    } catch (error) {
      console.log("Cancel invitation error:", error);

      showFeedback(
        "error",
        "Unable to Cancel",
        "The invitation code could not be cancelled. Please try again.",
      );
    } finally {
      setCancellingCodeId(null);
    }
  };

  const latestGroupInvitations = useMemo(() => {
    return [...groupInvitations]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 2);
  }, [groupInvitations]);

  const latestCodes = useMemo(() => {
    return [...codes]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 2);
  }, [codes]);

  const totalCodes = codes.length;

  const usedCodes = useMemo(
    () =>
      codes.filter((item) => item.used || item.status === "REDEEMED").length,
    [codes],
  );

  const pendingInvitations = groupInvitations.length;

  const statusConfig = {
    AVAILABLE: {
      label: "Available",
      badge: styles.availableStatusBadge,
      text: styles.availableStatusText,
      icon: styles.codeIconAvailable,
      iconColor: "#7257E8",
    },
    RESERVED: {
      label: "Reserved",
      badge: styles.reservedStatusBadge,
      text: styles.reservedStatusText,
      icon: styles.codeIconReserved,
      iconColor: "#F28C28",
    },
    SENT: {
      label: "Sent",
      badge: styles.sentStatusBadge,
      text: styles.sentStatusText,
      icon: styles.codeIconSent,
      iconColor: "#2D8CFF",
    },
    REDEEMED: {
      label: "Redeemed",
      badge: styles.usedStatusBadge,
      text: styles.usedStatusText,
      icon: styles.codeIconUsed,
      iconColor: "#2EB875",
    },
    EXPIRED: {
      label: "Expired",
      badge: styles.expiredStatusBadge,
      text: styles.expiredStatusText,
      icon: styles.codeIconExpired,
      iconColor: "#E53935",
    },
    CANCELLED: {
      label: "Cancelled",
      badge: styles.cancelledStatusBadge,
      text: styles.cancelledStatusText,
      icon: styles.codeIconCancelled,
      iconColor: "#757575",
    },
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
            buttonText={feedback.buttonText}
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
              <Text style={styles.headerTitle}>Invitation Codes</Text>

              <Text style={styles.headerSubtitle}>
                Generate and manage invitation codes
              </Text>
            </View>

            <TouchableOpacity
              style={styles.headerAddButton}
              activeOpacity={0.8}
              disabled={creating}
              onPress={handleGenerate}
            >
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* STATISTICS */}

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <View style={styles.statIconPurple}>
                <Ionicons name="ticket-outline" size={25} color="#7257E8" />
              </View>

              <View style={styles.statText}>
                <Text style={styles.statNumber}>{totalCodes}</Text>

                <Text style={styles.statLabel}>Total Codes</Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={styles.statIconGreen}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={26}
                  color="#2EB875"
                />
              </View>

              <View style={styles.statText}>
                <Text style={styles.statNumber}>{usedCodes}</Text>

                <Text style={styles.statLabel}>Used Codes</Text>
              </View>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <View style={styles.statIconOrange}>
                <Ionicons name="hourglass-outline" size={25} color="#F28C28" />
              </View>

              <View style={styles.statText}>
                <Text style={styles.statNumber}>{pendingInvitations}</Text>

                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </View>

          {/* GENERATE NEW CODE */}

          <LinearGradient
            colors={["#9A78F5", "#6953E8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.generateCard}
          >
            <View style={styles.generateIconCircle}>
              <Ionicons name="ticket-outline" size={34} color="#7257E8" />
            </View>

            <View style={styles.generateContent}>
              <Text style={styles.generateTitle}>Generate New Code</Text>

              <Text style={styles.generateDescription}>
                Create a new invitation code{"\n"}
                for users to join
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={creating}
              style={styles.generateAction}
              onPress={handleGenerate}
            >
              <Text style={styles.generateActionText}>
                {creating ? "Generating..." : "Generate Code"}
              </Text>

              {!creating && (
                <Ionicons
                  name="arrow-forward"
                  size={21}
                  color="#7257E8"
                  style={styles.generateArrow}
                />
              )}
            </TouchableOpacity>
          </LinearGradient>

          {/* PENDING GROUP INVITATIONS */}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Group Invitations</Text>

            {groupInvitations.length > 2 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/admin/invitations/pending")}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {groupInvitations.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="mail-open-outline" size={25} color="#7257E8" />
              </View>

              <Text style={styles.emptyTitle}>
                No pending group invitations
              </Text>

              <Text style={styles.emptyDescription}>
                New group invitations will appear here.
              </Text>
            </View>
          ) : (
            latestGroupInvitations.map((item) => {
              const isProcessing = processingInvitationId === item.id;

              return (
                <View key={item.id} style={styles.invitationCard}>
                  <View style={styles.invitationMain}>
                    <View style={styles.groupIconContainer}>
                      <Ionicons
                        name="people-outline"
                        size={30}
                        color="#7257E8"
                      />
                    </View>

                    <View style={styles.invitationDetails}>
                      <View style={styles.groupTitleRow}>
                        <Text style={styles.groupTitle} numberOfLines={1}>
                          {item.group.name}
                        </Text>

                        <View style={styles.pendingBadge}>
                          <Text style={styles.pendingBadgeText}>Pending</Text>
                        </View>
                      </View>

                      <Text style={styles.invitedByText}>
                        Invited by {item.invitedBy.firstName}{" "}
                        {item.invitedBy.lastName}
                      </Text>

                      <Text style={styles.groupMeta}>
                        @{item.invitedBy.profile?.username || "unknown"}{" "}
                        <Text style={styles.metaDot}>•</Text> Members:{" "}
                        {item.group.members.length}
                      </Text>

                      <Text style={styles.groupDate}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.invitationAction}
                      onPress={() =>
                        router.push({
                          pathname: "/admin/group/[groupId]" as any,
                          params: {
                            groupId: String(item.group.id),
                          },
                        })
                      }
                    >
                      <Ionicons name="eye-outline" size={20} color="#7257E8" />

                      <Text style={styles.viewGroupText}>View Group</Text>
                    </TouchableOpacity>

                    <View style={styles.actionDivider} />

                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={isProcessing}
                      style={styles.invitationAction}
                      onPress={() => handleAcceptInvitation(item.id)}
                    >
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#2EB875"
                      />

                      <Text style={styles.acceptText}>
                        {isProcessing && processingAction === "ACCEPT"
                          ? "Accepting..."
                          : "Accept"}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.actionDivider} />

                    <TouchableOpacity
                      activeOpacity={0.7}
                      disabled={isProcessing}
                      style={styles.invitationAction}
                      onPress={() => handleDeclineInvitation(item.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
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

          {/* INVITATION CODES */}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Invitation Codes</Text>

            {codes.length > 2 && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push("/admin/invitations/codes")}
              >
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            )}
          </View>

          {codes.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="ticket-outline" size={25} color="#7257E8" />
              </View>

              <Text style={styles.emptyTitle}>
                No invitation codes available
              </Text>

              <Text style={styles.emptyDescription}>
                Generate your first invitation code above.
              </Text>
            </View>
          ) : (
            latestCodes.map((item) => {
              const createdBy =
                `${item.createdByUser.firstName} ` +
                `${item.createdByUser.lastName}`;

              const usedBy = item.usedBy
                ? `${item.usedBy.firstName} ${item.usedBy.lastName}`
                : "Not Used";

              // STEP 6 CHANGE: Resolve the current code status inside the
              // map callback, where the individual `item` is available.
              const normalizedStatus =
                item.status ?? (item.used ? "REDEEMED" : "AVAILABLE");

              const currentStatus =
                statusConfig[normalizedStatus as keyof typeof statusConfig] ??
                statusConfig.AVAILABLE;

              // STEP 6 CHANGE: Only active code states can be cancelled.
              const canCancel =
                normalizedStatus === "AVAILABLE" ||
                normalizedStatus === "RESERVED" ||
                normalizedStatus === "SENT";

              // STEP 6 CHANGE: Determine whether this specific code is being cancelled.
              const isCancelling = cancellingCodeId === item.id;

              return (
                <View key={item.id} style={styles.codeCard}>
                  <View style={styles.codeMain}>
                    <View
                      style={[styles.codeIconContainer, currentStatus.icon]}
                    >
                      <Ionicons
                        name="ticket-outline"
                        size={28}
                        color={currentStatus.iconColor}
                      />
                    </View>

                    <View style={styles.codeDetails}>
                      <View style={styles.codeTopRow}>
                        <Text
                          style={styles.codeText}
                          numberOfLines={1}
                          ellipsizeMode="middle"
                        >
                          {item.code}
                        </Text>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          style={styles.copyIconButton}
                          onPress={() => copyCode(item.code)}
                        >
                          <Ionicons
                            name="copy-outline"
                            size={22}
                            color="#7257E8"
                          />
                        </TouchableOpacity>

                        <View style={[styles.statusBadge, currentStatus.badge]}>
                          <Text
                            style={[styles.statusBadgeText, currentStatus.text]}
                          >
                            {currentStatus.label}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.codeInfo}>
                        Created: {new Date(item.createdAt).toLocaleString()}
                      </Text>

                      <Text style={styles.codeInfo}>
                        Created By: {createdBy}
                      </Text>

                      <Text style={styles.codeInfo}>Used By: {usedBy}</Text>

                      {/* STEP 6 CHANGE: Show Cancel Code only for AVAILABLE,
                          RESERVED, and SENT invitation codes. */}
                      {canCancel && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={isCancelling}
                          style={styles.cancelCodeButton}
                          onPress={() => handleCancelInvitationCode(item.id)}
                        >
                          {isCancelling ? (
                            <ActivityIndicator size="small" color="#E53935" />
                          ) : (
                            <Ionicons
                              name="close-circle-outline"
                              size={19}
                              color="#E53935"
                            />
                          )}

                          <Text style={styles.cancelCodeButtonText}>
                            {isCancelling ? "Cancelling..." : "Cancel Code"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={styles.codeBottomBorder} />

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.detailsButton}
                    onPress={() => handleViewCodeDetails(item)}
                  >
                    <Ionicons
                      name="clipboard-outline"
                      size={19}
                      color="#2EB875"
                    />

                    <Text style={styles.detailsButtonText}>View Details</Text>
                  </TouchableOpacity>
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
          buttonText={feedback.buttonText}
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

  /* HEADER */

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 25,
  },

  backButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: "#E9EDF5",
    shadowColor: "#1A4FFF",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 2,
  },

  headerTextContainer: {
    flex: 1,
    paddingLeft: 2,
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: "700",
    color: "#111B3A",
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: "#68728D",
  },

  headerAddButton: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#7257E8",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#7257E8",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },

  /* STATISTICS */

  statsCard: {
    minHeight: 100,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.96)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 18,
    marginBottom: 24,
    marginTop: 20,

    shadowColor: "#7A82A0",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.11,
    shadowRadius: 15,
    elevation: 4,
  },

  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  statIconPurple: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#F0EDFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 9,
  },

  statIconGreen: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#E9F8F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 9,
  },

  statIconOrange: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#FFF0E7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 9,
  },

  statText: {
    flex: 1,
  },

  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#101A3A",
  },

  statLabel: {
    marginTop: 3,
    fontSize: 11,
    color: "#68728D",
  },

  statDivider: {
    width: 1,
    height: 58,
    backgroundColor: "#E5E7EF",
    marginHorizontal: 4,
  },

  /* GENERATE */

  generateCard: {
    minHeight: 100,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 34,
    overflow: "hidden",

    shadowColor: "#7257E8",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.18,
    shadowRadius: 15,
    elevation: 5,
  },

  generateIconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  generateContent: {
    flex: 1,
    marginLeft: 16,
    marginRight: 8,
  },

  generateTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 7,
  },

  generateDescription: {
    color: "#F4F1FF",
    fontSize: 11,
    lineHeight: 22,
  },

  generateAction: {
    minWidth: 50,
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 15,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
  },

  generateActionText: {
    color: "#7257E8",
    fontSize: 10,
    fontWeight: "700",
  },

  generateArrow: {
    marginLeft: 5,
  },

  /* SECTION HEADER */

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  sectionTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: "700",
    color: "#111B3A",
  },

  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7257E8",
    marginLeft: 10,
  },

  /* PENDING INVITATION */

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
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 17,
  },

  groupIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "#F0EDFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  invitationDetails: {
    flex: 1,
    minWidth: 0,
  },

  groupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },

  groupTitle: {
    flex: 1,
    fontSize: 15,
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

  invitedByText: {
    fontSize: 11,
    color: "#68728D",
    marginBottom: 5,
  },

  groupMeta: {
    fontSize: 11,
    color: "#68728D",
    marginBottom: 5,
  },

  metaDot: {
    color: "#A3A8B9",
  },

  groupDate: {
    fontSize: 10,
    color: "#7C8499",
  },

  invitationActions: {
    height: 45,
    borderTopWidth: 1,
    borderTopColor: "#E9EAF0",
    flexDirection: "row",
  },

  invitationAction: {
    flex: 1,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  actionDivider: {
    width: 1,
    height: 25,
    backgroundColor: "#E3E5EC",
  },

  viewGroupText: {
    color: "#7257E8",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 5,
  },

  acceptText: {
    color: "#2EB875",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 5,
  },

  declineText: {
    color: "#E53935",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 5,
  },

  /* EMPTY STATES */

  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
    marginBottom: 28,

    shadowColor: "#737A99",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  emptyIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#F0EDFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111B3A",
    textAlign: "center",
  },

  emptyDescription: {
    marginTop: 5,
    color: "#7B8397",
    fontSize: 13,
    textAlign: "center",
  },

  /* INVITATION CODES */

  codeCard: {
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

  codeMain: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 19,
    paddingBottom: 18,
  },

  codeIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },

  codeIconUsed: {
    backgroundColor: "#E9F8F0",
  },

  codeIconAvailable: {
    backgroundColor: "#F0EDFF",
  },

  codeDetails: {
    flex: 1,
    minWidth: 0,
  },

  codeTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },

  codeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#111B3A",
    marginRight: 6,
  },

  copyIconButton: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },

  statusBadge: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  usedStatusBadge: {
    backgroundColor: "#E9F8F0",
  },

  availableStatusBadge: {
    backgroundColor: "#E9F8F0",
  },

  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // STEP 6 CHANGE: Correct Redeemed status text color.
  usedStatusText: {
    color: "#2EB875",
  },

  availableStatusText: {
    color: "#2EB875",
  },

  codeInfo: {
    fontSize: 11,
    color: "#68728D",
    lineHeight: 20,
  },

  codeBottomBorder: {
    height: 1,
    backgroundColor: "#E9EAF0",
  },

  detailsButton: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  detailsButtonText: {
    color: "#2EB875",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },

  bottomSpacing: {
    height: 40,
  },

  // ================= STEP 6 CHANGE: ADDITIONAL CODE STATUS STYLES =================

  codeIconReserved: {
    backgroundColor: "#FFF3E0",
  },

  codeIconSent: {
    backgroundColor: "#EAF3FF",
  },

  codeIconExpired: {
    backgroundColor: "#FFEBEE",
  },

  codeIconCancelled: {
    backgroundColor: "#F1F1F1",
  },

  reservedStatusBadge: {
    backgroundColor: "#FFF3E0",
  },

  reservedStatusText: {
    color: "#F28C28",
  },

  sentStatusBadge: {
    backgroundColor: "#EAF3FF",
  },

  sentStatusText: {
    color: "#2D8CFF",
  },

  expiredStatusBadge: {
    backgroundColor: "#FFEBEE",
  },

  expiredStatusText: {
    color: "#E53935",
  },

  cancelledStatusBadge: {
    backgroundColor: "#F1F1F1",
  },

  cancelledStatusText: {
    color: "#757575",
  },

  // STEP 6 CHANGE: Cancel invitation code action styling.
  cancelCodeButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
  },

  cancelCodeButtonText: {
    color: "#E53935",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
});
