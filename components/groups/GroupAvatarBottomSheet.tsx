import { forwardRef, useMemo } from "react";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from "@gorhom/bottom-sheet";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

type Props = {
  hasAvatar: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onRemove: () => void;
};

const GroupAvatarBottomSheet = forwardRef<BottomSheetModal, Props>(
  ({ hasAvatar, onCamera, onGallery, onRemove }, ref) => {
    const snapPoints = useMemo(() => [hasAvatar ? "42%" : "34%"], [hasAvatar]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        backdropComponent={(props) => (
          <BottomSheetBackdrop
            {...props}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.45}
          />
        )}
      >
        <BottomSheetView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="image-outline" size={22} color="#2563EB" />
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Group Photo</Text>
              <Text style={styles.subtitle}>Choose a photo for your group</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {/* Camera */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onCamera}
              style={styles.actionRow}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#EEF4FF" }]}>
                <Ionicons name="camera-outline" size={23} color="#2563EB" />
              </View>

              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Camera</Text>
                <Text style={styles.actionSubtitle}>
                  Take a new group photo
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#A1A1AA" />
            </TouchableOpacity>

            {/* Gallery */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={onGallery}
              style={styles.actionRow}
            >
              <View style={[styles.actionIcon, { backgroundColor: "#F3F0FF" }]}>
                <Ionicons name="images-outline" size={23} color="#4F46E5" />
              </View>

              <View style={styles.actionTextContainer}>
                <Text style={styles.actionTitle}>Gallery</Text>
                <Text style={styles.actionSubtitle}>
                  Choose a photo from your device
                </Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#A1A1AA" />
            </TouchableOpacity>

            {/* Remove */}
            {hasAvatar && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={onRemove}
                style={styles.actionRow}
              >
                <View
                  style={[styles.actionIcon, { backgroundColor: "#FEF2F2" }]}
                >
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                </View>

                <View style={styles.actionTextContainer}>
                  <Text style={[styles.actionTitle, styles.removeTitle]}>
                    Remove Photo
                  </Text>
                  <Text style={styles.actionSubtitle}>
                    Remove the current group photo
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#A1A1AA" />
              </TouchableOpacity>
            )}
          </View>

          {/* Cancel */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              ref && typeof ref !== "function" && ref.current?.dismiss()
            }
            style={styles.cancelButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

GroupAvatarBottomSheet.displayName = "GroupAvatarBottomSheet";

export default GroupAvatarBottomSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  handleIndicator: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D4D4D8",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 24,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#18181B",
    marginBottom: 3,
  },

  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#71717A",
  },

  actionsContainer: {
    backgroundColor: "#F8F8FA",
    borderRadius: 18,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },

  actionRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 15,
  },

  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  actionTextContainer: {
    flex: 1,
  },

  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#18181B",
    marginBottom: 3,
  },

  removeTitle: {
    color: "#EF4444",
  },

  actionSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    color: "#71717A",
  },

  cancelButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: "#F4F4F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 25,
  },

  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#18181B",
  },
});
