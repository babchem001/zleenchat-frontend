import React from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

type PrivacySectionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
};

type PrivacyStyles = {
  safeArea: ViewStyle;
  header: ViewStyle;
  backButton: ViewStyle;
  headerTitle: TextStyle;
  headerSpacer: ViewStyle;

  contentContainer: ViewStyle;

  heroCard: ViewStyle;
  heroIcon: ViewStyle;
  heroTitle: TextStyle;
  heroText: TextStyle;

  section: ViewStyle;
  sectionIcon: ViewStyle;
  sectionContent: ViewStyle;
  sectionTitle: TextStyle;
  sectionText: TextStyle;

  noticeCard: ViewStyle;
  noticeIcon: ViewStyle;
  noticeContent: ViewStyle;
  noticeTitle: TextStyle;
  noticeText: TextStyle;

  footerCard: ViewStyle;
  footerText: TextStyle;
};

// Reusable section used throughout the privacy explanation screen.
const PrivacySection = ({ icon, title, children }: PrivacySectionProps) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={21} color="#4F46E5" />
      </View>

      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>{title}</Text>

        <Text style={styles.sectionText}>{children}</Text>
      </View>
    </View>
  );
};

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      {/* STEP 4 — PRIVACY SCREEN STATUS BAR */}
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#0B1545" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Privacy</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="lock-closed-outline" size={30} color="#4F46E5" />
          </View>

          <Text style={styles.heroTitle}>Your chats are private</Text>

          <Text style={styles.heroText}>
            Zleenchat uses encryption and other security measures to help
            protect your messages and media. Different types of content use
            different protection methods.
          </Text>
        </View>

        <PrivacySection
          icon="shield-checkmark-outline"
          title="How Zleenchat protects your messages"
        >
          Zleenchat uses encryption and other security measures to help protect
          conversations and shared content while you use the service.
        </PrivacySection>

        <PrivacySection
          icon="chatbubble-ellipses-outline"
          title="Text messages"
        >
          Text messages are protected by the messaging security mechanisms used
          by Zleenchat when they are transmitted and stored.
        </PrivacySection>

        <PrivacySection icon="images-outline" title="Photos">
          Photos shared through Zleenchat use encryption and security
          protections when they are uploaded and stored.
        </PrivacySection>

        <PrivacySection icon="musical-notes-outline" title="Audio">
          Audio messages use encryption and security protections when they are
          uploaded and stored.
        </PrivacySection>

        <PrivacySection icon="videocam-outline" title="Videos">
          Video messages use encryption and security protections when they are
          uploaded and stored.
        </PrivacySection>

        <PrivacySection
          icon="document-text-outline"
          title="Files and documents"
        >
          Documents and supported files use encryption and security protections
          when they are uploaded and stored.
        </PrivacySection>

        <PrivacySection icon="link-outline" title="Links">
          Links sent through a conversation are handled as message content and
          are protected by the messaging security mechanisms used by Zleenchat.
        </PrivacySection>

        <PrivacySection icon="people-outline" title="Group conversations">
          Group conversations are protected by the application's messaging,
          account, membership, and access controls. Group messages should not be
          assumed to have the same encryption treatment as direct messages.
        </PrivacySection>

        <PrivacySection
          icon="share-social-outline"
          title="Sharing and forwarding"
        >
          Zleenchat allows messages and supported content to be shared or
          forwarded. Encryption helps protect content while it is handled by the
          system, but it cannot prevent someone who can access a message from
          choosing to share or forward it.
        </PrivacySection>

        <PrivacySection
          icon="eye-off-outline"
          title="What privacy means on Zleenchat"
        >
          Privacy means that Zleenchat uses security measures to help protect
          your conversations and shared content. Access to conversations is
          controlled through the application's account, chat, and group systems.
        </PrivacySection>

        <View style={styles.noticeCard}>
          <View style={styles.noticeIcon}>
            <Ionicons
              name="information-circle-outline"
              size={23}
              color="#B45309"
            />
          </View>

          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>An important distinction</Text>

            <Text style={styles.noticeText}>
              Zleenchat's current messaging system is not presented as a
              complete end-to-end encrypted messaging system. Encryption helps
              protect your content, but the current system does not provide a
              guarantee that only the people in a conversation can access or
              decrypt every type of message.
            </Text>
          </View>
        </View>

        <View style={styles.footerCard}>
          <Ionicons name="shield-checkmark-outline" size={24} color="#4F46E5" />

          <Text style={styles.footerText}>
            These protections are designed to help keep your conversations and
            shared content more private and secure while using Zleenchat.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create<PrivacyStyles>({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E7E4FF",
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#0B1545",
    fontSize: 18,
    fontWeight: "700",
  },

  headerSpacer: {
    width: 44,
  },

  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
  },

  heroCard: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    marginBottom: 18,
    borderRadius: 22,
    backgroundColor: "#F8F9FF",
    borderWidth: 1,
    borderColor: "#E4E7FF",
  },

  heroIcon: {
    width: 62,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderRadius: 20,
    backgroundColor: "#EEF0FF",
  },

  heroTitle: {
    color: "#0B1545",
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
  },

  heroText: {
    marginTop: 9,
    color: "#69708A",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },

  section: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 17,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E7E4FF",
  },

  sectionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
    borderRadius: 14,
    backgroundColor: "#EEF0FF",
  },

  sectionContent: {
    flex: 1,
  },

  sectionTitle: {
    color: "#0B1545",
    fontSize: 15,
    fontWeight: "700",
  },

  sectionText: {
    marginTop: 5,
    color: "#69708A",
    fontSize: 13.5,
    lineHeight: 20,
  },

  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 22,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#FFF9EB",
    borderWidth: 1,
    borderColor: "#FDE7B0",
  },

  noticeIcon: {
    marginRight: 11,
    paddingTop: 1,
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    color: "#92400E",
    fontSize: 14,
    fontWeight: "700",
  },

  noticeText: {
    marginTop: 6,
    color: "#78350F",
    fontSize: 13,
    lineHeight: 19,
  },

  footerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "#F8F9FF",
  },

  footerText: {
    flex: 1,
    marginLeft: 11,
    color: "#69708A",
    fontSize: 13,
    lineHeight: 19,
  },
});
