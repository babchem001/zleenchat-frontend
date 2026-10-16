import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "@/src/store/auth/authStorage";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /*
   * App Feedback Modal
   */
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const login = useAuthStore((state) => state.login);

  /*
   * Reusable feedback handler
   */
  const showFeedback = (type: FeedbackType, title: string, message: string) => {
    setFeedbackType(type);
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackVisible(true);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showFeedback(
        "warning",
        "Missing Information",
        "Please fill in your email or username and password.",
      );

      return;
    }

    try {
      setLoading(true);

      await login(email.trim(), password);

      /*
       * Navigation is currently handled by your authentication
       * store / auth flow after successful login.
       *
       * If you later want manual navigation here, you can
       * restore your admin/user routing logic.
       */
    } catch (error: any) {
      showFeedback(
        "error",
        "Sign In Failed",
        error?.message ||
          "Unable to sign in. Please check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative Background */}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topBlob} />
            <View style={styles.bottomBlob} />
            <View style={styles.topGlow} />
            <View style={styles.bottomGlow} />

            <View style={styles.content}>
              {/* Logo */}

              <Image
                source={require("@/assets/images/zalvro_icon_optimized.png")}
                style={styles.logo}
                contentFit="contain"
              />

              {/* Title */}

              <Text style={styles.title}>Welcome back</Text>

              <Text style={styles.subtitle}>
                Sign in to continue your conversations.
              </Text>

              {/* Login Card */}

              <View style={styles.card}>
                {/* Email */}

                <Text style={styles.label}>Email or Username</Text>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="person-outline"
                    size={22}
                    color="#2563EB"
                    style={styles.leftIcon}
                  />

                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email or username"
                    placeholderTextColor="#98A2B3"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.textInput}
                  />
                </View>

                {/* Password */}

                <Text style={styles.labelPassword}>Password</Text>

                <View style={styles.inputContainer}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color="#6D4AFF"
                    style={styles.leftIcon}
                  />

                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    placeholderTextColor="#98A2B3"
                    secureTextEntry={!showPassword}
                    style={styles.textInput}
                  />

                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={24}
                      color="#69708A"
                    />
                  </TouchableOpacity>
                </View>

                {/* Login Button */}

                <TouchableOpacity
                  style={[
                    styles.loginButton,
                    loading && styles.loginButtonDisabled,
                  ]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Register */}

              <TouchableOpacity
                onPress={() => router.push("/auth/register")}
                style={styles.registerContainer}
                activeOpacity={0.8}
              >
                <Text style={styles.registerText}>
                  Don&apos;t have an account?{" "}
                  <Text style={styles.registerLink}>Create Account</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* APP FEEDBACK MODAL */}

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        buttonText="OK"
        onClose={() => setFeedbackVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    zIndex: 5,
  },

  /* Background */

  topBlob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 140,
    backgroundColor: "#E9EEFF",
    top: -70,
    left: -120,
  },

  bottomBlob: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 130,
    backgroundColor: "#EEE8FF",
    bottom: -80,
    right: -110,
  },

  topGlow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(37,99,235,0.10)",
    top: 120,
    alignSelf: "center",
  },

  bottomGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(124,58,237,0.10)",
    bottom: 120,
    alignSelf: "center",
  },

  /* Logo */

  logo: {
    width: 104,
    height: 104,
    marginBottom: 18,
  },

  title: {
    fontSize: 40,
    fontWeight: "800",
    color: "#0B1545",
    letterSpacing: -1,
    textAlign: "center",
  },

  subtitle: {
    marginTop: 10,
    marginBottom: 54,
    fontSize: 19,
    color: "#5E6785",
    textAlign: "center",
    lineHeight: 30,
    paddingHorizontal: 20,
  },

  /* Card */

  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 24,

    shadowColor: "#1A4FFF",
    shadowOpacity: 0.06,
    shadowRadius: 22,
    shadowOffset: {
      width: 0,
      height: 14,
    },

    elevation: 8,
  },

  label: {
    fontSize: 19,
    fontWeight: "700",
    color: "#44506D",
    marginBottom: 12,
  },

  labelPassword: {
    fontSize: 19,
    fontWeight: "700",
    color: "#44506D",
    marginTop: 26,
    marginBottom: 12,
  },

  inputContainer: {
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E7F2",

    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#FFFFFF",

    paddingHorizontal: 20,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 4,
  },

  leftIcon: {
    marginRight: 14,
  },

  textInput: {
    flex: 1,
    fontSize: 17,
    color: "#111827",
    paddingVertical: 0,
  },

  loginButton: {
    marginTop: 32,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 10,
  },

  loginButtonDisabled: {
    opacity: 0.7,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 18,
    letterSpacing: 0.3,
  },

  registerContainer: {
    marginTop: 42,
  },

  registerText: {
    fontSize: 18,
    color: "#667085",
  },

  registerLink: {
    color: "#2563EB",
    fontWeight: "700",
  },
});
