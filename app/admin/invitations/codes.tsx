import { useCallback, useEffect, useState } from "react";
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
import { router } from "expo-router";

import {
  InvitationCode,
  getInvitationCodes,
} from "@/src/services/admin/adminService";

import { useSocket } from "@/hooks/useSocket";
import AdminBackground from "@/src/components/admin/AdminBackground";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

export default function InvitationCodesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const { socketRef, connected } = useSocket();

  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedbackType(type);
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackVisible(true);
  };

  const closeFeedback = () => {
    setFeedbackVisible(false);
  };

  /*
   * Load invitation codes.
   */
  const loadCodes = useCallback(async () => {
    try {
      const response = await getInvitationCodes();

      const sorted = [...response].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setCodes(sorted);
    } catch (error: any) {
      showFeedback(
        "error",
        "Unable to Load Codes",
        error?.message || "Unable to load invitation codes.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  /*
   * Refresh invitation codes when relevant
   * admin socket events are received.
   */
  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;
    if (!socket) return;

    const refreshCodes = () => {
      loadCodes();
    };

    socket.on("adminInvitationCreated", refreshCodes);
    socket.on("adminInvitationAccepted", refreshCodes);
    socket.on("adminInvitationDeclined", refreshCodes);

    return () => {
      socket.off("adminInvitationCreated", refreshCodes);
      socket.off("adminInvitationAccepted", refreshCodes);
      socket.off("adminInvitationDeclined", refreshCodes);
    };
  }, [connected, loadCodes]);

  /*
   * Pull-to-refresh.
   */
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadCodes();
  }, [loadCodes]);

  /*
   * Copy invitation code.
   */
  const copyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);

      showFeedback("success", "Copied", "Invitation code copied successfully.");
    } catch {
      showFeedback("error", "Copy Failed", "Unable to copy invitation code.");
    }
  };

  /*
   * Display invitation code details.
   */
  const handleViewDetails = (item: InvitationCode) => {
    const createdBy =
      `${item.createdByUser.firstName} ` + `${item.createdByUser.lastName}`;

    const usedBy = item.usedBy
      ? `${item.usedBy.firstName} ${item.usedBy.lastName}`
      : "Not Used";

    showFeedback(
      "info",
      "Invitation Code",
      [
        `Code: ${item.code}`,
        `Created: ${new Date(item.createdAt).toLocaleString()}`,
        `Created By: ${createdBy}`,
        `Used By: ${usedBy}`,
        `Status: ${item.used ? "Used" : "Available"}`,
      ].join("\n\n"),
    );
  };

  if (loading) {
    return (
      <AdminBackground>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7257E8" />
        </SafeAreaView>

        <AppFeedbackModal
          visible={feedbackVisible}
          type={feedbackType}
          title={feedbackTitle}
          message={feedbackMessage}
          onClose={closeFeedback}
        />
      </AdminBackground>
    );
  }

  const usedCount = codes.filter((item) => item.used).length;

  const availableCount = codes.length - usedCount;

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
                All generated invitation codes
              </Text>
            </View>
          </View>

          {/* SUMMARY */}

          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <View style={styles.purpleIcon}>
                <Ionicons name="ticket-outline" size={24} color="#7257E8" />
              </View>

              <View>
                <Text style={styles.summaryNumber}>{codes.length}</Text>

                <Text style={styles.summaryLabel}>Total</Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <View style={styles.greenIcon}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={24}
                  color="#2EB875"
                />
              </View>

              <View>
                <Text style={styles.summaryNumber}>{usedCount}</Text>

                <Text style={styles.summaryLabel}>Used</Text>
              </View>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <View style={styles.orangeIcon}>
                <Ionicons name="time-outline" size={24} color="#F28C28" />
              </View>

              <View>
                <Text style={styles.summaryNumber}>{availableCount}</Text>

                <Text style={styles.summaryLabel}>Available</Text>
              </View>
            </View>
          </View>

          {/* SECTION */}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Generated Codes</Text>

            <Text style={styles.countText}>
              {codes.length} {codes.length === 1 ? "code" : "codes"}
            </Text>
          </View>

          {/* CODES */}

          {codes.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="ticket-outline" size={30} color="#7257E8" />
              </View>

              <Text style={styles.emptyTitle}>No invitation codes</Text>

              <Text style={styles.emptyDescription}>
                Generated invitation codes will appear here.
              </Text>
            </View>
          ) : (
            codes.map((item) => {
              const createdBy =
                `${item.createdByUser.firstName} ` +
                `${item.createdByUser.lastName}`;

              const usedBy = item.usedBy
                ? `${item.usedBy.firstName} ${item.usedBy.lastName}`
                : "Not Used";

              return (
                <View key={item.id} style={styles.codeCard}>
                  <View style={styles.codeMain}>
                    <View
                      style={[
                        styles.codeIcon,
                        item.used ? styles.usedIcon : styles.availableIcon,
                      ]}
                    >
                      <Ionicons
                        name="ticket-outline"
                        size={29}
                        color={item.used ? "#2EB875" : "#7257E8"}
                      />
                    </View>

                    <View style={styles.codeDetails}>
                      <View style={styles.codeHeader}>
                        <Text
                          style={styles.code}
                          numberOfLines={2}
                          ellipsizeMode="middle"
                        >
                          {item.code}
                        </Text>

                        <View
                          style={[
                            styles.statusBadge,
                            item.used
                              ? styles.usedBadge
                              : styles.availableBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusText,
                              item.used
                                ? styles.usedText
                                : styles.availableText,
                            ]}
                          >
                            {item.used ? "Used" : "Available"}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.infoText}>
                        Created: {new Date(item.createdAt).toLocaleString()}
                      </Text>

                      <Text style={styles.infoText}>
                        Created By: {createdBy}
                      </Text>

                      <Text style={styles.infoText}>Used By: {usedBy}</Text>

                      {item.usedBy && (
                        <Text style={styles.infoText}>
                          Used On: {new Date(item.createdAt).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.separator} />

                  <View style={styles.codeActions}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.codeAction}
                      onPress={() => copyCode(item.code)}
                    >
                      <Ionicons name="copy-outline" size={19} color="#7257E8" />

                      <Text style={styles.copyText}>Copy Code</Text>
                    </TouchableOpacity>

                    <View style={styles.actionDivider} />

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.codeAction}
                      onPress={() => handleViewDetails(item)}
                    >
                      <Ionicons
                        name="clipboard-outline"
                        size={19}
                        color="#2EB875"
                      />

                      <Text style={styles.detailsText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <View style={styles.bottomSpacing} />
        </ScrollView>
      </SafeAreaView>

      {/* GLOBAL SCREEN FEEDBACK MODAL */}

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        buttonText="OK"
        onClose={closeFeedback}
      />
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

  summaryCard: {
    minHeight: 100,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.96)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 17,
    marginBottom: 28,

    shadowColor: "#737A99",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 4,
  },

  summaryItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  purpleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0EDFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  greenIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E9F8F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  orangeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF0E7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  summaryNumber: {
    fontSize: 21,
    fontWeight: "700",
    color: "#111B3A",
  },

  summaryLabel: {
    fontSize: 11,
    color: "#68728D",
    marginTop: 2,
  },

  summaryDivider: {
    width: 1,
    height: 52,
    backgroundColor: "#E5E7EF",
    marginHorizontal: 3,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111B3A",
  },

  countText: {
    fontSize: 13,
    color: "#7257E8",
    fontWeight: "600",
  },

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
    padding: 18,
  },

  codeIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 13,
  },

  usedIcon: {
    backgroundColor: "#E9F8F0",
  },

  availableIcon: {
    backgroundColor: "#F0EDFF",
  },

  codeDetails: {
    flex: 1,
    minWidth: 0,
  },

  codeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 9,
  },

  code: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#111B3A",
    marginRight: 8,
    lineHeight: 20,
  },

  statusBadge: {
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  usedBadge: {
    backgroundColor: "#E9F8F0",
  },

  availableBadge: {
    backgroundColor: "#E9F8F0",
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  usedText: {
    color: "#2EB875",
  },

  availableText: {
    color: "#2EB875",
  },

  infoText: {
    fontSize: 12,
    color: "#68728D",
    lineHeight: 20,
  },

  separator: {
    height: 1,
    backgroundColor: "#E9EAF0",
  },

  codeActions: {
    height: 54,
    flexDirection: "row",
  },

  codeAction: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },

  actionDivider: {
    width: 1,
    height: 27,
    backgroundColor: "#E3E5EC",
    alignSelf: "center",
  },

  copyText: {
    color: "#7257E8",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },

  detailsText: {
    color: "#2EB875",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 6,
  },

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
