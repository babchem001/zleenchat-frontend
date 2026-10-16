import React, { forwardRef, useMemo } from "react";
import { Text, TouchableOpacity, StyleSheet, View } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  canDeleteForEveryone: boolean;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
};

const DeleteMessageBottomSheet = forwardRef<BottomSheet, Props>(
  ({ canDeleteForEveryone, onDeleteForMe, onDeleteForEveryone }, ref) => {
    const snapPoints = useMemo(
      () => [canDeleteForEveryone ? "42%" : "35%"],
      [canDeleteForEveryone],
    );

    const closeSheet = () => {
      if (ref && typeof ref !== "function" && ref.current) {
        ref.current.close();
      }
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Delete message</Text>

              <Text style={styles.subtitle}>
                Choose what you want to do with this message.
              </Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {/* Delete for Me */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.action}
              onPress={onDeleteForMe}
            >
              <View style={styles.iconContainer}>
                <Ionicons name="person-outline" size={21} color="#252525" />
              </View>

              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Delete for Me</Text>

                <Text style={styles.actionSubtitle}>
                  Remove this message from your chat
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={19} color="#A1A1AA" />
            </TouchableOpacity>

            {/* Delete for Everyone */}
            {canDeleteForEveryone && (
              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.action}
                onPress={onDeleteForEveryone}
              >
                <View
                  style={[styles.iconContainer, styles.deleteIconContainer]}
                >
                  <Ionicons name="trash-outline" size={21} color="#EF4444" />
                </View>

                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, styles.deleteTitle]}>
                    Delete for Everyone
                  </Text>

                  <Text style={styles.actionSubtitle}>
                    Remove this message for everyone
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={19} color="#A1A1AA" />
              </TouchableOpacity>
            )}
          </View>

          {/* Cancel */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.cancelButton}
            onPress={closeSheet}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

DeleteMessageBottomSheet.displayName = "DeleteMessageBottomSheet";

export default DeleteMessageBottomSheet;

const styles = StyleSheet.create({
  background: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  handleIndicator: {
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#D4D4D8",
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },

  /* Header */

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 22,
  },

  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    marginRight: 13,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#18181B",
    letterSpacing: -0.2,
  },

  subtitle: {
    marginTop: 4,
    fontSize: 13.5,
    lineHeight: 19,
    color: "#71717A",
  },

  /* Action list */

  actionsContainer: {
    backgroundColor: "#F8F8FA",
    borderRadius: 18,
    overflow: "hidden",
  },

  action: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginRight: 13,
  },

  deleteIconContainer: {
    backgroundColor: "#FEF2F2",
  },

  actionTextContainer: {
    flex: 1,
    paddingRight: 10,
  },

  actionTitle: {
    fontSize: 15.5,
    fontWeight: "600",
    color: "#18181B",
  },

  deleteTitle: {
    color: "#EF4444",
  },

  actionSubtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 17,
    color: "#71717A",
  },

  /* Cancel */

  cancelButton: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F5",
    marginTop: 14,
  },

  cancelText: {
    fontSize: 15.5,
    fontWeight: "600",
    color: "#3F3F46",
  },
});
