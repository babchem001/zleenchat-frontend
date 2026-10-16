import React, { forwardRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

type PrivacyBottomSheetProps = {
  onLearnMore?: () => void;
};

// This component is shared by ChatScreen.tsx and GroupChatScreen.tsx.
const PrivacyBottomSheet = forwardRef<BottomSheet, PrivacyBottomSheetProps>(
  ({ onLearnMore }, ref) => {
    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={["68%"]}
        enablePanDownToClose
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* — Privacy sheet header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="lock-closed-outline" size={24} color="#4F46E5" />
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Your chats are private</Text>

              <Text style={styles.description}>
                Zleenchat uses encryption and other security measures to help
                protect your messages and media. Different types of content use
                different protection methods.
              </Text>
            </View>
          </View>

          {/* Protected content types */}
          <View style={styles.messageTypesContainer}>
            <PrivacyTypeRow
              icon="chatbubble-ellipses-outline"
              title="Text messages"
              description="Your text conversations are protected by Zleenchat's messaging security measures."
            />

            <PrivacyTypeRow
              icon="images-outline"
              title="Photos"
              description="Photos are encrypted before they are uploaded and stored."
            />

            <PrivacyTypeRow
              icon="musical-notes-outline"
              title="Audio"
              description="Audio messages are encrypted before they are uploaded and stored."
            />

            <PrivacyTypeRow
              icon="videocam-outline"
              title="Videos"
              description="Video messages are encrypted before they are uploaded and stored."
            />

            <PrivacyTypeRow
              icon="document-text-outline"
              title="Files"
              description="Documents and files are encrypted before they are uploaded and stored."
            />

            <PrivacyTypeRow
              icon="link-outline"
              title="Links"
              description="Links sent in conversations are handled as message content and are protected by Zleenchat's messaging security measures."
            />
          </View>

          {/* Learn more action */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onLearnMore}
            style={styles.learnMoreButton}
          >
            <Text style={styles.learnMoreText}>Learn more</Text>

            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

PrivacyBottomSheet.displayName = "PrivacyBottomSheet";

type PrivacyTypeRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
};

const PrivacyTypeRow = ({ icon, title, description }: PrivacyTypeRowProps) => {
  return (
    <View style={styles.typeRow}>
      <View style={styles.typeIcon}>
        <Ionicons name={icon} size={20} color="#4F46E5" />
      </View>

      <View style={styles.typeTextContainer}>
        <Text style={styles.typeTitle}>{title}</Text>

        <Text style={styles.typeDescription}>{description}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  handleIndicator: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },

  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF0FF",
    marginRight: 13,
  },

  headerTextContainer: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "800",
  },

  description: {
    marginTop: 7,
    color: "#64748B",
    fontSize: 13.5,
    lineHeight: 20,
  },

  messageTypesContainer: {
    borderRadius: 20,
    backgroundColor: "#F8F9FF",
    borderWidth: 1,
    borderColor: "#E4E7FF",
    paddingHorizontal: 14,
    paddingVertical: 5,
  },

  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },

  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF0FF",
    marginRight: 12,
  },

  typeTextContainer: {
    flex: 1,
    minWidth: 0,
  },

  typeTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },

  typeDescription: {
    marginTop: 3,
    color: "#64748B",
    fontSize: 12.5,
    lineHeight: 18,
  },

  learnMoreButton: {
    minHeight: 46,
    marginTop: 22,
    paddingHorizontal: 20,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    backgroundColor: "#4F46E5",
  },

  learnMoreText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
    marginRight: 7,
  },
});

export default PrivacyBottomSheet;
