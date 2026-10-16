import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  AdminGroup,
  getAllGroups,
} from "@/src/services/admin/adminService";

import { API_BASE_URL } from "@/src/services/api/apiClient";

import AdminBackground from "@/src/components/admin/AdminBackground";

export default function GroupsScreen() {
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);

      const response = await getAllGroups();

      setGroups(response);
    } catch (error) {
      console.log("Admin groups fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  /*
   * Generate a compact avatar label from the group name.
   *
   * Examples:
   * "Sagamu Squad"         → SS
   * "Powder Squad"         → PS
   * "Fullstack Developers" → FD
   */
  const getGroupInitials = (name: string) => {
    const words = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (words.length === 0) {
      return "G";
    }

    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  };

  /*
   * Fallback avatar treatment when a group does not
   * have an uploaded avatar.
   *
   * The actual group avatar is always preferred.
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
   * Build the real group avatar URL.
   *
   * Backend group avatar paths are stored relative to
   * the API server, so prepend API_BASE_URL.
   *
   * If the backend ever returns an absolute URL, use it
   * directly instead of prepending the API URL.
   */
  const getGroupAvatarUri = (avatarUrl: string | null) => {
    if (!avatarUrl) {
      return null;
    }

    if (
      avatarUrl.startsWith("http://") ||
      avatarUrl.startsWith("https://")
    ) {
      return avatarUrl;
    }

    return `${API_BASE_URL}${avatarUrl}`;
  };

  /*
   * Format the REAL group creation date returned by the API.
   *
   * Example:
   * May 12, 2025
   */
  const formatGroupCreatedDate = (createdAt: string) => {
    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return "Unknown date";
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderGroup = ({
    item,
  }: {
    item: AdminGroup;
  }) => {
    const avatar = getAvatarStyle(item.id);
    const initials = getGroupInitials(item.name);

    const avatarUri = getGroupAvatarUri(item.avatarUrl);

    const createdDate = formatGroupCreatedDate(
      item.createdAt,
    );

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.groupCard}
        onPress={() =>
          router.push({
            pathname: "/admin/group/[groupId]",
            params: {
              groupId: String(item.id),
            },
          })
        }
      >
        <View style={styles.groupCardContent}>
          {/* =====================================================
              GROUP AVATAR
              ===================================================== */}

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

          {/* =====================================================
              GROUP INFORMATION
              ===================================================== */}

          <View style={styles.groupInformation}>
            <Text
              style={styles.groupName}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            <View style={styles.creatorRow}>
              <Text style={styles.creatorLabel}>
                Created by:
              </Text>

              <Text
                style={styles.creatorValue}
                numberOfLines={1}
              >
                {item.createdBy.profile.username}
              </Text>
            </View>

            <View style={styles.memberRow}>
              <Ionicons
                name="people-outline"
                size={18}
                color="#68728D"
              />

              <Text style={styles.memberText}>
                Members: {item.members.length}
              </Text>
            </View>
          </View>

          {/* =====================================================
              MORE
              ===================================================== */}

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.moreButton}
            onPress={() =>
              router.push({
                pathname: "/admin/group/[groupId]",
                params: {
                  groupId: String(item.id),
                },
              })
            }
          >
            <Ionicons
              name="ellipsis-vertical"
              size={23}
              color="#68728D"
            />
          </TouchableOpacity>
        </View>

        {/* =====================================================
            REAL CREATION DATE
            ===================================================== */}

        <View style={styles.groupCardFooter}>
          <View style={styles.datePill}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color="#2E9567"
            />

            <Text style={styles.dateText}>
              Created {createdDate}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <AdminBackground>
        <SafeAreaView style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#7257E8"
          />
        </SafeAreaView>
      </AdminBackground>
    );
  }

  return (
    <AdminBackground>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGroup}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            groups.length === 0 &&
              styles.emptyListContent,
          ]}
          ListHeaderComponent={
            <View>
              {/* =================================================
                  HEADER
                  ================================================= */}

              <View style={styles.header}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.backButton}
                  onPress={() => router.back()}
                >
                  <Ionicons
                    name="arrow-back"
                    size={27}
                    color="#111B3A"
                  />
                </TouchableOpacity>

                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>
                    Groups
                  </Text>

                  <Text style={styles.headerSubtitle}>
                    All groups created on Zleenchat
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.82}
                  style={styles.invitesButton}
                  onPress={() =>
                    router.push(
                      "/admin/invitations/pending",
                    )
                  }
                >
                  <Ionicons
                    name="mail-outline"
                    size={21}
                    color="#7257E8"
                  />

                  <Text style={styles.invitesText}>
                    Invites
                  </Text>
                </TouchableOpacity>
              </View>

              {/* =================================================
                  TOTAL GROUPS
                  ================================================= */}

              <View style={styles.totalGroupsCard}>
                <View style={styles.totalGroupsIcon}>
                  <Ionicons
                    name="people-outline"
                    size={34}
                    color="#7257E8"
                  />
                </View>

                <View style={styles.totalGroupsContent}>
                  <Text style={styles.totalGroupsLabel}>
                    Total Groups
                  </Text>

                  <Text
                    style={styles.totalGroupsNumber}
                  >
                    {groups.length}
                  </Text>

                  <Text
                    style={
                      styles.totalGroupsDescription
                    }
                  >
                    Across the platform
                  </Text>
                </View>

                {/* Decorative group silhouette */}

                <View style={styles.summaryDecoration}>
                  <View
                    style={styles.decorationHeadLarge}
                  />

                  <View
                    style={
                      styles.decorationHeadSmallLeft
                    }
                  />

                  <View
                    style={
                      styles.decorationHeadSmallRight
                    }
                  />

                  <View
                    style={styles.decorationBodyLarge}
                  />

                  <View
                    style={styles.decorationBodyLeft}
                  />

                  <View
                    style={styles.decorationBodyRight}
                  />
                </View>
              </View>

              {/* =================================================
                  SECTION TITLE
                  ================================================= */}

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  All Groups
                </Text>

                <Text style={styles.sectionCount}>
                  {groups.length}{" "}
                  {groups.length === 1
                    ? "group"
                    : "groups"}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="people-outline"
                  size={32}
                  color="#7257E8"
                />
              </View>

              <Text style={styles.emptyTitle}>
                No groups found
              </Text>

              <Text
                style={styles.emptyDescription}
              >
                Groups created on the platform will
                appear here.
              </Text>
            </View>
          }
          ListFooterComponent={
            groups.length > 0 ? (
              <View style={styles.bottomSpacing} />
            ) : null
          }
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

  listContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  emptyListContent: {
    flexGrow: 1,
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
    height: 48,
    justifyContent: "center",
    alignItems: "flex-start",
    marginRight: 2,
  },

  headerTextContainer: {
    flex: 1,
    paddingLeft: 2,
    minWidth: 0,
  },

  headerTitle: {
    fontSize: 27,
    fontWeight: "700",
    color: "#111B3A",
    letterSpacing: -0.7,
  },

  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#68728D",
  },

  invitesButton: {
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 14,
    backgroundColor:
      "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "#E5DEFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",

    shadowColor: "#7257E8",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },

  invitesText: {
    marginLeft: 7,
    fontSize: 13,
    fontWeight: "700",
    color: "#7257E8",
  },

  /* ============================================================
     TOTAL GROUPS
     ============================================================ */

  totalGroupsCard: {
    height: 158,
    borderRadius: 27,
    backgroundColor:
      "rgba(247,244,255,0.90)",
    borderWidth: 1,
    borderColor:
      "rgba(220,212,255,0.75)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 30,
    overflow: "hidden",

    shadowColor: "#8C83B5",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },

  totalGroupsIcon: {
    width: 67,
    height: 67,
    borderRadius: 21,
    backgroundColor: "#E8DDFF",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  totalGroupsContent: {
    marginLeft: 18,
    zIndex: 2,
  },

  totalGroupsLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#47446C",
  },

  totalGroupsNumber: {
    marginTop: 2,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: "#5F3CE1",
    letterSpacing: -1,
  },

  totalGroupsDescription: {
    marginTop: 2,
    fontSize: 13,
    color: "#777493",
  },

  /* ============================================================
     SUMMARY DECORATION
     ============================================================ */

  summaryDecoration: {
    position: "absolute",
    right: -8,
    bottom: -13,
    width: 170,
    height: 145,
    opacity: 0.48,
  },

  decorationHeadLarge: {
    position: "absolute",
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "#DDD3F8",
    top: 4,
    left: 67,
  },

  decorationHeadSmallLeft: {
    position: "absolute",
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "#DDD3F8",
    top: 34,
    left: 30,
  },

  decorationHeadSmallRight: {
    position: "absolute",
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "#DDD3F8",
    top: 34,
    right: 8,
  },

  decorationBodyLarge: {
    position: "absolute",
    width: 65,
    height: 84,
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    backgroundColor: "#DDD3F8",
    bottom: -17,
    left: 56,
  },

  decorationBodyLeft: {
    position: "absolute",
    width: 45,
    height: 63,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: "#DDD3F8",
    bottom: -14,
    left: 16,
  },

  decorationBodyRight: {
    position: "absolute",
    width: 45,
    height: 63,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: "#DDD3F8",
    bottom: -14,
    right: -2,
  },

  /* ============================================================
     SECTION
     ============================================================ */

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
    paddingHorizontal: 2,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#111B3A",
    letterSpacing: -0.3,
  },

  sectionCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7C8298",
  },

  /* ============================================================
     GROUP CARD
     ============================================================ */

  groupCard: {
    backgroundColor:
      "rgba(255,255,255,0.97)",
    borderRadius: 24,
    marginBottom: 16,
    overflow: "hidden",

    shadowColor: "#737A99",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.09,
    shadowRadius: 14,
    elevation: 4,
  },

  groupCardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 15,
  },

  /* ============================================================
     GROUP AVATAR
     ============================================================ */

  groupAvatar: {
    width: 66,
    height: 66,
    borderRadius: 19,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
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
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  /* ============================================================
     GROUP INFORMATION
     ============================================================ */

  groupInformation: {
    flex: 1,
    minWidth: 0,
    marginLeft: 15,
    paddingRight: 5,
  },

  groupName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111B3A",
    marginBottom: 8,
  },

  creatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
    minWidth: 0,
  },

  creatorLabel: {
    fontSize: 12.5,
    color: "#68728D",
  },

  creatorValue: {
    flexShrink: 1,
    marginLeft: 5,
    fontSize: 13,
    fontWeight: "600",
    color: "#7257E8",
  },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  memberText: {
    marginLeft: 6,
    fontSize: 13,
    color: "#68728D",
  },

  /* ============================================================
     MORE
     ============================================================ */

  moreButton: {
    width: 30,
    height: 42,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 1,
    marginLeft: 2,
  },

  /* ============================================================
     REAL CREATION DATE
     ============================================================ */

  groupCardFooter: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    alignItems: "flex-end",
  },

  datePill: {
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: "#EAF7F0",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  dateText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#36805E",
  },

  /* ============================================================
     EMPTY
     ============================================================ */

  emptyCard: {
    backgroundColor:
      "rgba(255,255,255,0.94)",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 36,
    alignItems: "center",

    shadowColor: "#737A99",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "#F0EDFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111B3A",
    textAlign: "center",
  },

  emptyDescription: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 20,
    color: "#7B8397",
    textAlign: "center",
  },

  bottomSpacing: {
    height: 35,
  },
});