import React, { forwardRef, useMemo } from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  isMe: boolean;
  isGroupCreator: boolean;
  isDeletedPlaceholder: boolean;

  canCopy: boolean;
  canEdit: boolean;

  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRemovePlaceholder: () => void;

  onSelectMessage?: () => void;
  onForwardMessage?: () => void;
};

const MessageActionBottomSheet = forwardRef<BottomSheet, Props>(
  (
    {
      isMe,
      isGroupCreator,
      isDeletedPlaceholder,
      canCopy,
      canEdit,
      onCopy,
      onEdit,
      onDelete,
      onRemovePlaceholder,
      onSelectMessage,
      onForwardMessage,
    },
    ref,
  ) => {
    const snapPoints = useMemo(() => {
      if (isDeletedPlaceholder) {
        return ["45%"];
      }
      const actionCount = 3 + (canCopy ? 1 : 0) + (canEdit ? 1 : 0);

      if (actionCount === 3) {
        return ["45%"];
      }

      if (actionCount === 4) {
        return ["58%"];
      }

      return ["65%"];
    }, [isDeletedPlaceholder, canCopy, canEdit]);

    const closeSheet = () => {
      if (ref && typeof ref !== "function" && ref.current) {
        ref.current.close();
      }
    };

    const handleAction = (callback?: () => void) => {
      if (callback) {
        callback();
      }
    };

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.container}>
          {isDeletedPlaceholder ? (
            <>
              {/* Remove Placeholder */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.actionItem}
                onPress={onRemovePlaceholder}
              >
                <View
                  style={[styles.iconContainer, styles.dangerIconContainer]}
                >
                  <Ionicons name="trash-outline" size={23} color="#EF4444" />
                </View>

                <Text style={[styles.actionText, styles.dangerText]}>
                  Remove Placeholder
                </Text>

                <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Select Message */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.actionItem}
                onPress={() => handleAction(onSelectMessage)}
              >
                <View
                  style={[styles.iconContainer, styles.primaryIconContainer]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={23}
                    color="#7C5CFF"
                  />
                </View>

                <Text style={styles.actionText}>Select Messages</Text>

                <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.actionItem}
                onPress={closeSheet}
              >
                <View
                  style={[styles.iconContainer, styles.neutralIconContainer]}
                >
                  <Ionicons name="close-outline" size={24} color="#6B7280" />
                </View>

                <Text style={styles.actionText}>Cancel</Text>

                <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Copy Message */}
              {canCopy && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.actionItem}
                  onPress={onCopy}
                >
                  <View
                    style={[styles.iconContainer, styles.primaryIconContainer]}
                  >
                    <Ionicons name="copy-outline" size={22} color="#7C5CFF" />
                  </View>

                  <Text style={styles.actionText}>Copy Message</Text>

                  <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              {/* Edit Message */}
              {canEdit && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  style={styles.actionItem}
                  onPress={onEdit}
                >
                  <View
                    style={[styles.iconContainer, styles.primaryIconContainer]}
                  >
                    <Ionicons name="create-outline" size={22} color="#7C5CFF" />
                  </View>

                  <Text style={styles.actionText}>Edit Message</Text>

                  <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
                </TouchableOpacity>
              )}

              {/* Select Message */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.actionItem}
                onPress={() => handleAction(onSelectMessage)}
              >
                <View
                  style={[styles.iconContainer, styles.primaryIconContainer]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={23}
                    color="#7C5CFF"
                  />
                </View>

                <Text style={styles.actionText}>Select Messages</Text>

                <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Forward Message */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={styles.actionItem}
                onPress={() => handleAction(onForwardMessage)}
              >
                <View
                  style={[styles.iconContainer, styles.primaryIconContainer]}
                >
                  <Ionicons
                    name="arrow-redo-outline"
                    size={23}
                    color="#7C5CFF"
                  />
                </View>

                <Text style={styles.actionText}>Forward Message</Text>

                <Ionicons name="chevron-forward" size={21} color="#9CA3AF" />
              </TouchableOpacity>

              {/* Delete Message */}
              <TouchableOpacity
                activeOpacity={0.75}
                style={[styles.actionItem, styles.deleteActionItem]}
                onPress={onDelete}
              >
                <View
                  style={[styles.iconContainer, styles.dangerIconContainer]}
                >
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                </View>

                <Text style={[styles.actionText, styles.dangerText]}>
                  Delete Message
                </Text>

                <Ionicons name="chevron-forward" size={21} color="#FCA5A5" />
              </TouchableOpacity>
            </>
          )}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);

MessageActionBottomSheet.displayName = "MessageActionBottomSheet";

export default MessageActionBottomSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },

  handleIndicator: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D6D9E0",
  },

  container: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 12,
  },

  actionItem: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 18,
    paddingVertical: 12,

    borderRadius: 22,

    backgroundColor: "#F8F8FF",
  },

  deleteActionItem: {
    backgroundColor: "#FFF5F5",
  },

  iconContainer: {
    width: 52,
    height: 52,

    borderRadius: 17,

    alignItems: "center",
    justifyContent: "center",

    marginRight: 16,
  },

  primaryIconContainer: {
    backgroundColor: "#EEE9FF",
  },

  neutralIconContainer: {
    backgroundColor: "#F1F2F5",
  },

  dangerIconContainer: {
    backgroundColor: "#FFE8EA",
  },

  actionText: {
    flex: 1,

    fontSize: 16,
    fontWeight: "600",

    color: "#171827",

    letterSpacing: -0.15,
  },

  dangerText: {
    color: "#EF4444",
  },
});
