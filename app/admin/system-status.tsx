import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";

import {
  getSystemStatus,
  type SystemStatus,
} from "@/src/services/admin/adminService";

import AdminBackground from "@/src/components/admin/AdminBackground";

type HealthServiceKey = "api" | "database" | "redis" | "storage";

type HealthService = {
  key: HealthServiceKey;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const healthServices: HealthService[] = [
  {
    key: "api",
    name: "API",
    icon: "server-outline",
  },
  {
    key: "database",
    name: "Database",
    icon: "server-outline",
  },
  {
    key: "redis",
    name: "Redis",
    icon: "flash-outline",
  },
  {
    key: "storage",
    name: "Storage",
    icon: "cloud-outline",
  },
];

export default function SystemStatusScreen() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState(false);

  const [apiResponseMs, setApiResponseMs] = useState<number | null>(null);

  const loadSystemStatus = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(false);

      const start = Date.now();

      const data = await getSystemStatus();

      const responseTime = Date.now() - start;

      setApiResponseMs(responseTime);

      setSystemStatus(data);
    } catch (error) {
      console.log("System health screen error:", error);

      setSystemStatus(null);
      setApiResponseMs(null);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSystemStatus();

      return undefined;
    }, [loadSystemStatus]),
  );

  const getOverallTitle = () => {
    if (loading) {
      return "Checking system health";
    }

    if (error) {
      return "Unable to check system health";
    }

    if (systemStatus?.status === "healthy") {
      return "All systems operational";
    }

    return "Some services need attention";
  };

  const getOverallSubtitle = () => {
    if (loading) {
      return "Please wait while Zleenchat checks its services.";
    }

    if (error) {
      return "The system health information could not be retrieved.";
    }

    if (systemStatus?.status === "healthy") {
      return "Zleenchat is operating normally.";
    }

    return "One or more critical services are unavailable.";
  };

  const getOverallColor = () => {
    if (loading) {
      return "#98A2B3";
    }

    if (error) {
      return "#F04438";
    }

    return systemStatus?.status === "healthy" ? "#16C784" : "#F04438";
  };

  const getCheckStatusLabel = (status: "up" | "down") => {
    return status === "up" ? "Operational" : "Unavailable";
  };

  const getCheckStatusColor = (status: "up" | "down") => {
    return status === "up" ? "#16C784" : "#F04438";
  };

  const formatLatency = (latency?: number) => {
    if (latency === undefined || latency === null) {
      return null;
    }

    return `${latency} ms`;
  };

  const formatUptime = (uptime?: number) => {
    if (!uptime) {
      return "Unavailable";
    }

    const totalSeconds = Math.floor(uptime);

    const days = Math.floor(totalSeconds / 86400);

    const hours = Math.floor((totalSeconds % 86400) / 3600);

    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  };

  const getLastChecked = () => {
    if (!systemStatus?.timestamp) {
      return "Not available";
    }

    return new Date(systemStatus.timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AdminBackground>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadSystemStatus(true)}
              tintColor="#5865F2"
            />
          }
        >
          {/* =====================================================
              HEADER
          ====================================================== */}

          <View style={styles.header}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#0B1545" />
            </TouchableOpacity>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>System Health</Text>

              <Text style={styles.headerSubtitle}>
                Monitor Zleenchat infrastructure
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.refreshButton}
              onPress={() => loadSystemStatus(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#5865F2" />
              ) : (
                <Ionicons name="refresh-outline" size={23} color="#5865F2" />
              )}
            </TouchableOpacity>
          </View>

          {/* =====================================================
              OVERALL STATUS
          ====================================================== */}

          <View
            style={[
              styles.overallCard,
              {
                borderColor: `${getOverallColor()}22`,
              },
            ]}
          >
            <View
              style={[
                styles.overallIcon,
                {
                  backgroundColor: getOverallColor(),
                },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={
                    error
                      ? "alert-circle-outline"
                      : systemStatus?.status === "healthy"
                        ? "shield-checkmark-outline"
                        : "warning-outline"
                  }
                  size={34}
                  color="#FFFFFF"
                />
              )}
            </View>

            <View style={styles.overallContent}>
              <Text style={styles.overallTitle}>{getOverallTitle()}</Text>

              <Text style={styles.overallSubtitle}>{getOverallSubtitle()}</Text>
            </View>

            <View style={styles.overallStatus}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: getOverallColor(),
                  },
                ]}
              />

              <Text
                style={[
                  styles.overallStatusText,
                  {
                    color: getOverallColor(),
                  },
                ]}
              >
                {loading
                  ? "Checking"
                  : error
                    ? "Unavailable"
                    : systemStatus?.status === "healthy"
                      ? "Operational"
                      : "Attention"}
              </Text>
            </View>
          </View>

          {/* =====================================================
              SERVICES
          ====================================================== */}

          <Text style={styles.sectionTitle}>Services</Text>

          <View style={styles.servicesCard}>
            {healthServices.map((service, index) => {
              const check = systemStatus?.checks?.[service.key];

              const serviceStatus = check?.status ?? "down";

              const statusColor = loading
                ? "#98A2B3"
                : getCheckStatusColor(serviceStatus);

              const statusLabel = loading
                ? "Checking"
                : getCheckStatusLabel(serviceStatus);

              let responseText: string | null = null;

              if (service.key === "api") {
                responseText =
                  apiResponseMs !== null
                    ? `Response: ${apiResponseMs} ms`
                    : null;
              } else {
                const latency = formatLatency(check?.latencyMs);

                responseText = latency ? `Response: ${latency}` : null;
              }

              return (
                <View
                  key={service.key}
                  style={[
                    styles.serviceRow,
                    index !== healthServices.length - 1 &&
                      styles.serviceRowBorder,
                  ]}
                >
                  <View
                    style={[
                      styles.serviceIcon,
                      {
                        backgroundColor: loading
                          ? "#F2F4F8"
                          : serviceStatus === "up"
                            ? "#EFFAF4"
                            : "#FFF1F0",
                      },
                    ]}
                  >
                    <Ionicons
                      name={service.icon}
                      size={25}
                      color={
                        loading
                          ? "#98A2B3"
                          : serviceStatus === "up"
                            ? "#16B364"
                            : "#F04438"
                      }
                    />
                  </View>

                  <View style={styles.serviceContent}>
                    <Text style={styles.serviceName}>{service.name}</Text>

                    <View style={styles.serviceStatusRow}>
                      <View
                        style={[
                          styles.statusDot,
                          {
                            backgroundColor: statusColor,
                          },
                        ]}
                      />

                      <Text
                        style={[
                          styles.serviceStatusText,
                          {
                            color: statusColor,
                          },
                        ]}
                      >
                        {statusLabel}
                      </Text>
                    </View>

                    {responseText && (
                      <Text style={styles.responseText}>{responseText}</Text>
                    )}
                  </View>

                  <Ionicons
                    name={
                      serviceStatus === "up"
                        ? "checkmark-circle"
                        : "alert-circle"
                    }
                    size={25}
                    color={loading ? "#C5CBD8" : statusColor}
                  />
                </View>
              );
            })}
          </View>

          {/* =====================================================
              SYSTEM INFORMATION
          ====================================================== */}

          <Text style={styles.sectionTitle}>System Information</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View>
                <Text style={styles.infoLabel}>Service</Text>

                <Text style={styles.infoValue}>
                  {systemStatus?.service || "zleenchat-api"}
                </Text>
              </View>

              <Ionicons name="server-outline" size={23} color="#5865F2" />
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View>
                <Text style={styles.infoLabel}>API Uptime</Text>

                <Text style={styles.infoValue}>
                  {formatUptime(systemStatus?.uptime)}
                </Text>
              </View>

              <Ionicons name="time-outline" size={23} color="#5865F2" />
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View>
                <Text style={styles.infoLabel}>Last Checked</Text>

                <Text style={styles.infoValue}>{getLastChecked()}</Text>
              </View>

              <Ionicons name="pulse-outline" size={23} color="#5865F2" />
            </View>
          </View>

          <Text style={styles.footerText}>
            Pull down to refresh system health.
          </Text>
        </ScrollView>
      </AdminBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 40,
    marginTop: 15,
  },

  /* ============================================================
     HEADER
  ============================================================ */

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
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
  },

  headerTitle: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0B1545",
    letterSpacing: -0.8,
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 17,
    color: "#69758F",
  },

  refreshButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: "#F0F1FF",
    justifyContent: "center",
    alignItems: "center",
  },

  /* ============================================================
     OVERALL STATUS
  ============================================================ */

  overallCard: {
    minHeight: 100,
    borderRadius: 24,
    backgroundColor: "#F0F2FF",
    borderWidth: 1,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 30,
  },

  overallIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },

  overallContent: {
    flex: 1,
  },

  overallTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B1545",
  },

  overallSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 20,
    color: "#69758F",
  },

  overallStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },

  overallStatusText: {
    fontSize: 14,
    color: "#5E6785",
    fontWeight: "700",
  },

  /* ============================================================
     SECTION
  ============================================================ */

  sectionTitle: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0B1545",
    marginTop: 20,
  },

  /* ============================================================
     SERVICES
  ============================================================ */

  servicesCard: {
    marginTop: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E9EDF5",
    overflow: "hidden",
    marginBottom: 36,
    shadowColor: "#1A4FFF",
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 3,
  },

  serviceRow: {
    minHeight: 100,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  serviceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F6",
  },

  serviceIcon: {
    width: 45,
    height: 45,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },

  serviceContent: {
    flex: 1,
  },

  serviceName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B1545",
  },

  serviceStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 7,
  },

  serviceStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },

  responseText: {
    marginTop: 4,
    fontSize: 11,
    color: "#69758F",
  },

  /* ============================================================
     SYSTEM INFORMATION
  ============================================================ */

  infoCard: {
    marginTop: 15,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#E9EDF5",
    paddingHorizontal: 20,
    paddingVertical: 4,
    // marginBottom: 18,
    shadowColor: "#1A4FFF",
    shadowOpacity: 0.045,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 3,
  },

  infoRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    // marginBottom: 10
  },

  infoLabel: {
    fontSize: 13,
    color: "#69758F",
  },

  infoValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: "#0B1545",
  },

  infoDivider: {
    height: 1,
    backgroundColor: "#EEF1F6",
  },

  footerText: {
    textAlign: "center",
    fontSize: 13,
    color: "#8A94A8",
    marginTop: 4,
  },
});
