import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type FeedbackType = "success" | "error" | "warning" | "info";

type AppFeedbackModalProps = {
  visible: boolean;
  type?: FeedbackType;
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
  onPrimaryPress?: () => void;
  secondaryButtonText?: string;
  onSecondaryPress?: () => void;
  loading?: boolean;
};

const { width } = Dimensions.get("window");
const FEEDBACK_CONFIG = {
  success: {
    icon: "checkmark-circle" as const,
    iconColor: "#16A34A",
    iconBackground: "#ECFDF3",
    accentColor: "#2563EB",
  },

  error: {
    icon: "close-circle" as const,
    iconColor: "#DC2626",
    iconBackground: "#FEF2F2",
    accentColor: "#2563EB",
  },

  warning: {
    icon: "warning" as const,
    iconColor: "#D97706",
    iconBackground: "#FFFBEB",
    accentColor: "#6D4AFF",
  },

  info: {
    icon: "information-circle" as const,
    iconColor: "#2563EB",
    iconBackground: "#EFF6FF",
    accentColor: "#2563EB",
  },
};

export default function AppFeedbackModal({
  visible,
  type = "info",
  title,
  message,
  buttonText = "OK",
  onClose,
  onPrimaryPress,
  secondaryButtonText,
  onSecondaryPress,
  loading = false,
}: AppFeedbackModalProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(80)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  const config = FEEDBACK_CONFIG[type];

  useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      translateY.setValue(80);
      scale.setValue(0.96);

      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),

        Animated.spring(translateY, {
          toValue: 0,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),

        Animated.spring(scale, {
          toValue: 1,
          tension: 70,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),

        Animated.timing(translateY, {
          toValue: 80,
          duration: 160,
          useNativeDriver: true,
        }),

        Animated.timing(scale, {
          toValue: 0.96,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, backdropOpacity, translateY, scale]);

  const handleSecondaryPress = () => {
    if (loading) {
      return;
    }

    if (onSecondaryPress) {
      onSecondaryPress();
    }
  };

  const handlePrimaryPress = () => {
    if (loading) {
      return;
    }

    if (onPrimaryPress) {
      onPrimaryPress();
      return;
    }

    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        />

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          disabled={loading}
        />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: backdropOpacity,
              transform: [
                {
                  translateY,
                },
                {
                  scale,
                },
              ],
            },
          ]}
        >
          {/* Top accent */}
          <View
            style={[
              styles.topAccent,
              {
                backgroundColor: config.accentColor,
              },
            ]}
          />

          {/* Icon */}
          <View
            style={[
              styles.iconContainer,
              {
                backgroundColor: config.iconBackground,
              },
            ]}
          >
            <Ionicons name={config.icon} size={42} color={config.iconColor} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {secondaryButtonText && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleSecondaryPress}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.secondaryButtonText}>
                  {secondaryButtonText}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: config.accentColor,
                },
                loading && styles.primaryButtonDisabled,
              ]}
              onPress={handlePrimaryPress}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>{buttonText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11, 21, 69, 0.58)",
  },

  card: {
    width: Math.min(width - 48, 390),
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",

    shadowColor: "#0B1545",
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: {
      width: 0,
      height: 15,
    },

    elevation: 18,
    overflow: "hidden",
  },

  topAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },

  iconContainer: {
    width: 78,
    height: 78,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0B1545",
    textAlign: "center",
    letterSpacing: -0.3,
  },

  message: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: "#667085",
    textAlign: "center",
    paddingHorizontal: 8,
  },

  buttonContainer: {
    width: "100%",
    marginTop: 26,
    gap: 10,
  },

  primaryButton: {
    height: 52,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",

    shadowColor: "#2563EB",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 7,
    },

    elevation: 7,
  },

  primaryButtonDisabled: {
    opacity: 0.65,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  secondaryButton: {
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    backgroundColor: "#F4F6FB",
    borderWidth: 1,
    borderColor: "#E5E9F2",
  },

  secondaryButtonText: {
    color: "#44506D",
    fontSize: 14,
    fontWeight: "700",
  },
});
