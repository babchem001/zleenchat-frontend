import { API_BASE_URL } from "@/src/services/api/apiClient";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ScrollView,
  Image,
  TouchableWithoutFeedback,
} from "react-native";

import { useFocusEffect, useLocalSearchParams, router } from "expo-router";

import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import {
  getMyGroupMembers,
  leaveGroup,
  getGroupDetails,
  removeMember,
  uploadGroupAvatar,
  deleteGroupAvatar,
  removeMemberByModerator,
  warnMember,
  muteMember,
  unmuteMember,
} from "@/src/services/group/groupService";
import { getGroupMessages } from "@/src/services/group/groupMessageService";
import { Message } from "@/src/types/chat.types";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { decryptRemoteThumbnail } from "@/src/utils/thumbnailPipeline";

import { useAuthStore } from "@/src/store/auth/authStorage";
import { useSocket } from "@/hooks/useSocket";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { BottomSheetModal } from "@gorhom/bottom-sheet";
import GroupAvatarBottomSheet from "@/components/groups/GroupAvatarBottomSheet";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type GroupMediaPreviewProps = {
  message: Message;
  contentType: "IMAGE" | "VIDEO" | "FILE" | "LINK";
};

const getAbsoluteMediaUri = (uri?: string | null) => {
  if (!uri) {
    return null;
  }

  return uri.startsWith("http") ? uri : `${API_BASE_URL}${uri}`;
};

const getLinkHost = (content?: string | null) => {
  const match = content?.match(
    /https?:\/\/[^\s<>]+|(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/[^\s<>]*)?/i,
  );

  if (!match) {
    return content?.trim() || "Link shared";
  }

  return match[0]
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .replace(/[.,;!?)]+$/, "");
};

const GroupMediaPreview: React.FC<GroupMediaPreviewProps> = ({
  message,
  contentType,
}) => {
  const [imageUri, setImageUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      setImageUri(null);

      const localThumbnail = message.thumbnailUri || message.cachedThumbnailUri;
      if (localThumbnail) {
        if (active) {
          setImageUri(localThumbnail);
        }
        return;
      }

      if (message.thumbnailUrl) {
        if (message.encryptedThumbnailKey && message.thumbnailIV) {
          const decryptedThumbnail = await decryptRemoteThumbnail({
            thumbnailUrl: message.thumbnailUrl,
            encryptedThumbnailKey: message.encryptedThumbnailKey,
            thumbnailIV: message.thumbnailIV,
            thumbnailAuthTag: message.thumbnailAuthTag || "",
          });

          if (active) {
            setImageUri(decryptedThumbnail);
          }
        } else if (active) {
          setImageUri(getAbsoluteMediaUri(message.thumbnailUrl));
        }
        return;
      }

      if (contentType !== "IMAGE") {
        return;
      }

      const localMedia =
        message.decryptedUri || message.cachedMediaUri || message.localUri;
      if (localMedia) {
        if (active) {
          setImageUri(localMedia);
        }
        return;
      }

      if (!message.mediaUrl) {
        return;
      }

      if (
        message.isMediaEncrypted &&
        message.encryptedMediaKey &&
        message.mediaKeyIV
      ) {
        const decryptedMedia = await decryptRemoteMedia({
          mediaUrl: message.mediaUrl,
          encryptedMediaKey: message.encryptedMediaKey,
          mediaKeyIV: message.mediaKeyIV,
          mediaKeyAuthTag: message.mediaKeyAuthTag,
          mimeType: message.mimeType,
          fileName: message.fileName,
        });

        if (active) {
          setImageUri(decryptedMedia);
        }
      } else if (active) {
        setImageUri(getAbsoluteMediaUri(message.mediaUrl));
      }
    };

    loadPreview().catch((error) => {
      console.warn("Unable to load group media preview:", error);
    });

    return () => {
      active = false;
    };
  }, [
    contentType,
    message.cachedMediaUri,
    message.cachedThumbnailUri,
    message.decryptedUri,
    message.encryptedMediaKey,
    message.encryptedThumbnailKey,
    message.fileName,
    message.isMediaEncrypted,
    message.localUri,
    message.mediaKeyIV,
    message.mediaKeyAuthTag,
    message.mediaUrl,
    message.mimeType,
    message.thumbnailAuthTag,
    message.thumbnailIV,
    message.thumbnailUri,
    message.thumbnailUrl,
  ]);

  if (contentType === "IMAGE" || contentType === "VIDEO") {
    return (
      <View style={styles.mediaPreviewTile}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.mediaPreviewImage} />
        ) : (
          <View style={styles.mediaPreviewFallback} />
        )}
      </View>
    );
  }

  const fileName = message.fileName?.trim();
  const linkHost = getLinkHost(message.messageContent);

  return (
    <View style={styles.mediaPreviewTile}>
      <View style={styles.mediaPreviewDetails}>
        <Text numberOfLines={2} style={styles.mediaPreviewItemText}>
          {contentType === "FILE" ? fileName || "File shared" : linkHost}
        </Text>
      </View>
    </View>
  );
};

export default function GroupInfoScreen() {
  const { groupId, isLeft: routeIsLeft } = useLocalSearchParams<{
    groupId: string;
    isLeft?: string;
  }>();

  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<any[]>([]);
  const [groupMessages, setGroupMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<any>(null);

  const [selectedMember, setSelectedMember] = useState<any>(null);

  const [groupSettingsVisible, setGroupSettingsVisible] = useState(false);

  const [memberModalVisible, setMemberModalVisible] = useState(false);

  const [removeConfirmVisible, setRemoveConfirmVisible] = useState(false);

  // LEAVE GROUP FIX: Use a dedicated confirmation so dismissing the prompt never leaves the group.
  const [leaveConfirmVisible, setLeaveConfirmVisible] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("success");

  const [feedbackTitle, setFeedbackTitle] = useState("");

  const [feedbackMessage, setFeedbackMessage] = useState("");

  const [feedbackOnClose, setFeedbackOnClose] = useState<
    (() => void) | undefined
  >(undefined);

  const currentUser = useAuthStore((state) => state.user);
  const { socketRef, connected } = useSocket();
  const avatarSheetRef = useRef<BottomSheetModal>(null);
  const isLeft =
    typeof group?.isLeft === "boolean" ? group.isLeft : routeIsLeft === "true";
  const myMembership = members.find(
    (member) => Number(member.user.id) === Number(currentUser?.sub),
  );
  const isActiveMember =
    !isLeft && (group?.isActiveMember === true || !!myMembership);
  const isCreator =
    isActiveMember &&
    (group?.myRole === "CREATOR" || myMembership?.role === "CREATOR") &&
    Number(currentUser?.sub) === Number(group?.createdById);

  const isVisibleAdmin =
    isActiveMember &&
    myMembership?.role === "ADMIN" &&
    myMembership?.isAdminVisible === true;

  const canRemoveSelectedMember =
    !!selectedMember &&
    Number(selectedMember.user.id) !== Number(currentUser?.sub) &&
    selectedMember.role !== "CREATOR" &&
    (isCreator || isVisibleAdmin);

  const canWarnMuteSelectedMember =
    !!selectedMember &&
    Number(selectedMember.user.id) !== Number(currentUser?.sub) &&
    selectedMember.role !== "CREATOR" &&
    isVisibleAdmin;

  const showFeedback = (
    type: FeedbackType,
    title: string,
    message: string,
    onClose?: () => void,
  ) => {
    setFeedbackType(type);
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackOnClose(() => onClose);
    setFeedbackVisible(true);
  };

  const closeFeedback = () => {
    setFeedbackVisible(false);
    const callback = feedbackOnClose;
    setFeedbackOnClose(undefined);
    callback?.();
  };

  const fetchGroup = useCallback(async () => {
    try {
      const data = await getGroupDetails(Number(groupId));

      setGroup(data);
    } catch (error) {
      console.error("Error fetching group details:", error);
    }
  }, [groupId]);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await getMyGroupMembers(Number(groupId));

      setMembers(data || []);
    } catch (error) {
      console.error("Error fetching group members:", error);
    }
  }, [groupId]);

  const fetchGroupMessages = useCallback(async () => {
    try {
      const data = await getGroupMessages(Number(groupId));
      setGroupMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching group messages:", error);
    }
  }, [groupId]);

  const latestMediaMessages = useMemo(
    () =>
      groupMessages
        .filter((message) => {
          const contentType = String(message.contentType || "").toUpperCase();

          return (
            !message.deletedForAll &&
            message.type !== "SYSTEM" &&
            ["IMAGE", "VIDEO", "FILE", "LINK"].includes(contentType)
          );
        })
        .sort(
          (messageA, messageB) =>
            new Date(messageB.createdAt).getTime() -
            new Date(messageA.createdAt).getTime(),
        )
        .slice(0, 4),
    [groupMessages],
  );

  const hasLatestMedia = latestMediaMessages.length > 0;

  useEffect(() => {
    fetchMembers();
    fetchGroup();
    fetchGroupMessages();
  }, [fetchMembers, fetchGroup, fetchGroupMessages]);

  useFocusEffect(
    useCallback(() => {
      fetchGroup();
    }, [fetchGroup]),
  );

  useEffect(() => {
    if (!connected) {
      return;
    }

    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    const handleMemberJoined = ({
      groupId: joinedGroupId,
      userId,
    }: {
      groupId: number;
      userId: number;
    }) => {
      if (Number(joinedGroupId) !== Number(groupId)) {
        return;
      }
      fetchMembers();
    };

    const handleMemberRemoved = ({
      groupId: updatedGroupId,
      userId,
    }: {
      groupId: number;
      userId: number;
    }) => {
      if (Number(updatedGroupId) !== Number(groupId)) {
        return;
      }

      setMembers((previous) =>
        previous.filter((member) => Number(member.user.id) !== Number(userId)),
      );

      setSelectedMember((previous: any) => {
        if (Number(previous?.user?.id) === Number(userId)) {
          setMemberModalVisible(false);
          return null;
        }

        return previous;
      });
    };

    const handleMemberMuted = ({
      groupId: updatedGroupId,
      userId,
    }: {
      groupId: number;
      userId: number;
    }) => {
      if (Number(updatedGroupId) !== Number(groupId)) {
        return;
      }

      setMembers((previous) =>
        previous.map((member) =>
          Number(member.user.id) === Number(userId)
            ? {
                ...member,
                isMuted: true,
              }
            : member,
        ),
      );

      setSelectedMember((previous: any) =>
        Number(previous?.user?.id) === Number(userId)
          ? {
              ...previous,
              isMuted: true,
            }
          : previous,
      );
    };

    const handleMemberUnmuted = ({
      groupId: updatedGroupId,
      userId,
    }: {
      groupId: number;
      userId: number;
    }) => {
      if (Number(updatedGroupId) !== Number(groupId)) {
        return;
      }

      setMembers((previous) =>
        previous.map((member) =>
          Number(member.user.id) === Number(userId)
            ? {
                ...member,
                isMuted: false,
              }
            : member,
        ),
      );

      setSelectedMember((previous: any) =>
        Number(previous?.user?.id) === Number(userId)
          ? {
              ...previous,
              isMuted: false,
            }
          : previous,
      );
    };

    const handleMemberWarned = ({
      groupId: updatedGroupId,
      userId,
    }: {
      groupId: number;
      userId: number;
    }) => {
      if (Number(updatedGroupId) !== Number(groupId)) {
        return;
      }

      setMembers((previous) =>
        previous.map((member) =>
          Number(member.user.id) === Number(userId)
            ? {
                ...member,
                isWarned: true,
              }
            : member,
        ),
      );

      setSelectedMember((previous: any) =>
        Number(previous?.user?.id) === Number(userId)
          ? {
              ...previous,
              isWarned: true,
            }
          : previous,
      );
    };

    const handleGroupAvatarUpdated = ({
      groupId: updatedGroupId,
      avatarUrl,
    }: {
      groupId: number;
      avatarUrl: string | null;
    }) => {
      if (Number(updatedGroupId) !== Number(groupId)) {
        return;
      }

      setGroup((previous: any) => ({
        ...previous,
        avatarUrl,
      }));
    };

    const handleNewGroupMessage = (message: Message) => {
      if (Number(message.groupId) === Number(groupId)) {
        fetchGroupMessages();
      }
    };

    socket.on("newGroupMessage", handleNewGroupMessage);
    socket.on("memberJoined", handleMemberJoined);
    socket.on("memberRemovedByAdmin", handleMemberRemoved);
    socket.on("memberMuted", handleMemberMuted);
    socket.on("memberUnmuted", handleMemberUnmuted);
    socket.on("memberWarned", handleMemberWarned);
    socket.on("groupAvatarUpdated", handleGroupAvatarUpdated);

    return () => {
      socket.off("newGroupMessage", handleNewGroupMessage);
      socket.off("memberJoined", handleMemberJoined);
      socket.off("memberRemovedByAdmin", handleMemberRemoved);
      socket.off("memberMuted", handleMemberMuted);
      socket.off("memberUnmuted", handleMemberUnmuted);
      socket.off("memberWarned", handleMemberWarned);
      socket.off("groupAvatarUpdated", handleGroupAvatarUpdated);
    };
  }, [connected, socketRef, groupId, fetchMembers, fetchGroupMessages]);

  const uploadAvatar = async (uri: string) => {
    try {
      await uploadGroupAvatar(Number(groupId), uri);
      await fetchGroup();
      showFeedback(
        "success",
        "Group Photo Updated",
        "Your group photo has been updated successfully.",
      );
    } catch (error) {
      console.error("Group avatar upload error:", error);

      showFeedback(
        "error",
        "Upload Failed",
        "Unable to update the group photo. Please try again.",
      );
    }
  };

  const openGallery = async () => {
    avatarSheetRef.current?.dismiss();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const openCamera = async () => {
    avatarSheetRef.current?.dismiss();

    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      showFeedback(
        "warning",
        "Camera Permission Required",
        "Camera permission is required to take a group photo.",
      );

      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const removeAvatar = () => {
    avatarSheetRef.current?.dismiss();

    showFeedback(
      "warning",
      "Remove Group Photo?",
      "Are you sure you want to remove the current group photo?",
    );

    setFeedbackOnClose(() => async () => {
      try {
        await deleteGroupAvatar(Number(groupId));
        await fetchGroup();
        showFeedback(
          "success",
          "Group Photo Removed",
          "The group photo has been removed successfully.",
        );
      } catch (error) {
        console.error("Group avatar removal error:", error);

        showFeedback(
          "error",
          "Removal Failed",
          "Unable to remove the group photo. Please try again.",
        );
      }
    });
  };

  const handleLeaveGroup = () => {
    if (actionLoading) {
      return;
    }

    setLeaveConfirmVisible(true);
  };

  const confirmLeaveGroup = async () => {
    if (actionLoading) {
      return;
    }

    setLeaveConfirmVisible(false);
    setActionLoading(true);

    try {
      const result = await leaveGroup(Number(groupId));

      const leaveMessage = result?.newAdminUserId
        ? "You can still read this group’s history. The group remains active, and a new group admin has been appointed."
        : result?.groupHasNoActiveMembers
          ? "You can still read this group’s history. No members remain, so the group is kept as read-only history."
          : "You can still read this group’s history, but you can no longer send messages or change its details.";

      showFeedback("success", "You Left the Group", leaveMessage, () => {
        router.replace("/(tabs)/group");
      });
    } catch (error) {
      console.error("Leave group error:", error);

      showFeedback(
        "error",
        "Unable to Leave Group",
        "Something went wrong. Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameGroup = () => {
    setGroupSettingsVisible(false);

    router.push({
      pathname: "/groups/rename-group",
      params: {
        groupId: String(groupId),
      },
    });
  };

  const handleEditDescription = () => {
    setGroupSettingsVisible(false);

    router.push({
      pathname: "/groups/edit-description",
      params: {
        groupId: String(groupId),
      },
    });
  };

  const handleModerationHistory = () => {
    setGroupSettingsVisible(false);

    router.push({
      pathname: "/admin/group/moderation-history" as any,
      params: {
        groupId: String(groupId),
      },
    });
  };

  const handleAddMembers = () => {
    setGroupSettingsVisible(false);

    router.push({
      pathname: "/groups/add-member",
      params: {
        groupId: String(groupId),
      },
    });
  };

  const handleRemoveMember = () => {
    if (!selectedMember) {
      return;
    }
    setMemberModalVisible(false);
    setRemoveConfirmVisible(true);
  };

  const confirmRemoveMember = async () => {
    if (!selectedMember || actionLoading) {
      return;
    }
    setActionLoading(true);
    try {
      if (isCreator) {
        await removeMember(Number(groupId), selectedMember.user.id);
      } else {
        await removeMemberByModerator(Number(groupId), selectedMember.user.id);
      }

      setMembers((previous) =>
        previous.filter(
          (member) => Number(member.user.id) !== Number(selectedMember.user.id),
        ),
      );

      setRemoveConfirmVisible(false);
      setSelectedMember(null);
      showFeedback(
        "success",
        "Member Removed",
        "The member has been removed successfully.",
      );
    } catch (error) {
      console.error("Remove member error:", error);

      showFeedback(
        "error",
        "Unable to Remove Member",
        "Something went wrong. Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleWarnMember = async () => {
    if (!selectedMember || actionLoading) {
      return;
    }

    setActionLoading(true);

    try {
      await warnMember(
        Number(groupId),
        selectedMember.user.id,
        "Violation of group rules",
      );

      const username = selectedMember.user.profile?.username || "Member";
      setMemberModalVisible(false);
      setMembers((previous) =>
        previous.map((member) =>
          Number(member.user.id) === Number(selectedMember.user.id)
            ? {
                ...member,
                isWarned: true,
              }
            : member,
        ),
      );

      setSelectedMember((previous: any) =>
        previous
          ? {
              ...previous,
              isWarned: true,
            }
          : previous,
      );

      showFeedback(
        "success",
        "Member Warned",
        `${username} has been warned successfully.`,
      );
    } catch (error) {
      console.error("Warn member error:", error);

      showFeedback(
        "error",
        "Unable to Warn Member",
        "Something went wrong. Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleMuteMember = () => {
    if (!selectedMember || actionLoading) {
      return;
    }

    const username = selectedMember.user.profile?.username || "this member";
    setMemberModalVisible(false);
    showFeedback(
      "warning",
      "Mute Member?",
      `Are you sure you want to mute ${username}?`,
    );

    setFeedbackOnClose(() => async () => {
      setActionLoading(true);

      try {
        await muteMember(
          Number(groupId),
          selectedMember.user.id,
          "Muted by moderator",
        );

        setMembers((previous) =>
          previous.map((member) =>
            Number(member.user.id) === Number(selectedMember.user.id)
              ? {
                  ...member,
                  isMuted: true,
                }
              : member,
          ),
        );

        setSelectedMember((previous: any) =>
          previous
            ? {
                ...previous,
                isMuted: true,
              }
            : previous,
        );

        showFeedback(
          "success",
          "Member Muted",
          `${username} has been muted successfully.`,
        );
      } catch (error) {
        console.error("Mute member error:", error);

        showFeedback(
          "error",
          "Unable to Mute Member",
          "Something went wrong. Please try again.",
        );
      } finally {
        setActionLoading(false);
      }
    });
  };

  const handleUnmuteMember = async () => {
    if (!selectedMember || actionLoading) {
      return;
    }
    setActionLoading(true);
    try {
      await unmuteMember(Number(groupId), selectedMember.user.id);
      const username = selectedMember.user.profile?.username || "Member";
      setMemberModalVisible(false);
      setMembers((previous) =>
        previous.map((member) =>
          Number(member.user.id) === Number(selectedMember.user.id)
            ? {
                ...member,
                isMuted: false,
              }
            : member,
        ),
      );

      setSelectedMember((previous: any) =>
        previous
          ? {
              ...previous,
              isMuted: false,
            }
          : previous,
      );

      showFeedback(
        "success",
        "Member Unmuted",
        `${username} has been unmuted successfully.`,
      );
    } catch (error) {
      console.error("Unmute member error:", error);

      showFeedback(
        "error",
        "Unable to Unmute Member",
        "Something went wrong. Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  // STEP 4 — Shared Media navigation from Group Details
  const openGroupSharedMedia = (
    initialTab?: "IMAGE" | "VIDEO" | "FILE" | "LINK",
  ) => {
    router.push({
      pathname: "/shared-media",
      params: {
        context: "group",
        groupId: String(groupId),
        groupName: group?.name || "Group",
        isLeft: String(isLeft),
        ...(initialTab ? { initialTab } : {}),
      },
    });
  };

  const handleMessageUser = () => {
    if (
      !selectedMember ||
      Number(selectedMember.user.id) === Number(currentUser?.sub)
    ) {
      return;
    }
    setMemberModalVisible(false);
    router.push({
      pathname: "/chats/[userId]",
      params: {
        userId: selectedMember.user.id.toString(),
      },
    });
  };

  const getInitial = (username?: string) => {
    if (!username) {
      return "?";
    }

    return username.charAt(0).toUpperCase();
  };

  const renderMember = ({ item }: { item: any }) => {
    const memberIsCreator =
      item.role === "CREATOR" &&
      Number(item.user.id) === Number(group?.createdBy?.id);
    const isMe = Number(item.user.id) === Number(currentUser?.sub);
    const username = item.user.profile?.username || "User";
    const avatarUrl =
      item.user.profile?.avatarUrl || item.user.profile?.avatar || null;
    const avatarUri = getAbsoluteMediaUri(avatarUrl);
    return (
      <TouchableOpacity
        disabled={isLeft}
        activeOpacity={0.8}
        style={styles.memberRow}
        onPress={() => {
          if (isLeft) {
            return;
          }

          setSelectedMember(item);
          setMemberModalVisible(true);
        }}
      >
        <View style={styles.memberAvatar}>
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={styles.memberAvatarImage}
            />
          ) : (
            <Text style={styles.memberAvatarText}>
              {getInitial(isMe ? "You" : username)}
            </Text>
          )}
        </View>

        <View style={styles.memberInfo}>
          <Text style={styles.memberName} numberOfLines={1}>
            {isMe ? "You" : username}
          </Text>

          <View style={styles.badgesRow}>
            {memberIsCreator && (
              <Text style={styles.adminBadge}>Group Admin</Text>
            )}

            {item.isWarned && <Text style={styles.warnedBadge}>Warned</Text>}

            {item.isMuted && <Text style={styles.mutedBadge}>Muted</Text>}
          </View>
        </View>

        {!isLeft && (
          <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View
        style={[
          styles.header,
          {
            height: 72,
          },
        ]}
      >
        <TouchableOpacity
          hitSlop={16}
          activeOpacity={0.8}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={25} color="#0B1545" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Group Details</Text>

        {isCreator || isVisibleAdmin ? (
          <TouchableOpacity
            hitSlop={16}
            activeOpacity={0.8}
            onPress={() => setGroupSettingsVisible(true)}
            style={styles.headerButton}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#0B1545" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {groupSettingsVisible && (
        <Modal
          visible={groupSettingsVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setGroupSettingsVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.menuOverlay}
            onPress={() => setGroupSettingsVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.settingsMenu,
                  {
                    top: 82 + insets.top,
                  },
                ]}
              >
                {(isCreator || isVisibleAdmin) && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.menuItem}
                    onPress={handleAddMembers}
                  >
                    <Ionicons
                      name="person-add-outline"
                      size={19}
                      color="#2563EB"
                    />

                    <Text style={styles.menuItemText}>Add members</Text>
                  </TouchableOpacity>
                )}

                {isCreator && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.menuItem}
                    onPress={handleRenameGroup}
                  >
                    <Ionicons name="create-outline" size={19} color="#2563EB" />

                    <Text style={styles.menuItemText}>Edit name</Text>
                  </TouchableOpacity>
                )}

                {isCreator && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={styles.menuItem}
                    onPress={handleEditDescription}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={19}
                      color="#2563EB"
                    />

                    <Text style={styles.menuItemText}>Edit description</Text>
                  </TouchableOpacity>
                )}

                {isVisibleAdmin && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={[styles.menuItem, styles.menuItemLast]}
                    onPress={handleModerationHistory}
                  >
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={19}
                      color="#2563EB"
                    />

                    <Text style={styles.menuItemText}>Moderation History</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View pointerEvents="none" style={styles.blobTopLeft} />
        <View pointerEvents="none" style={styles.blobTopRight} />
        <View pointerEvents="none" style={styles.blobMiddleRight} />
        <View pointerEvents="none" style={styles.blobBottomLeft} />
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              activeOpacity={isCreator ? 0.8 : 1}
              disabled={!isCreator}
              onPress={() => {
                if (isCreator) {
                  avatarSheetRef.current?.present();
                }
              }}
            >
              {group?.avatarUrl ? (
                <Image
                  source={{
                    uri: `${API_BASE_URL}${group.avatarUrl}`,
                  }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.emptyAvatar}>
                  <MaterialCommunityIcons
                    name="account-group"
                    size={72}
                    color="#453B82"
                  />
                </View>
              )}
            </TouchableOpacity>

            {isCreator && (
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.avatarEditButton}
                onPress={() => avatarSheetRef.current?.present()}
              >
                <Ionicons name="pencil" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.groupName} numberOfLines={2}>
            {group?.name || "Group"}
          </Text>

          <Text style={styles.memberCount}>
            Group • {members.length}{" "}
            {members.length === 1 ? "member" : "members"}
          </Text>

          {isLeft && (
            <View style={styles.leftGroupNotice}>
              <Ionicons name="eye-outline" size={17} color="#475569" />
              <Text style={styles.leftGroupNoticeText}>
                You left this group. Its details and history remain available in
                read-only mode.
              </Text>
            </View>
          )}

          {group?.description ? (
            <Text style={styles.description} numberOfLines={4}>
              {group.description}
            </Text>
          ) : (
            <Text style={styles.description}>No group description</Text>
          )}

          {isCreator && (
            <TouchableOpacity
              activeOpacity={0.75}
              style={styles.descriptionAction}
              onPress={handleEditDescription}
            >
              <Text style={styles.descriptionActionText}>
                {group?.description ? "Edit description" : "Add description"}
              </Text>

              <Ionicons name="pencil" size={18} color="#2563EB" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>

            {members.length > 9 && (
              <TouchableOpacity activeOpacity={0.75}>
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            )}
          </View>

          {(isCreator || isVisibleAdmin) && (
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.addMemberRow}
              onPress={handleAddMembers}
            >
              <View style={styles.addMemberIcon}>
                <Ionicons name="add" size={27} color="#2563EB" />
              </View>

              <Text style={styles.addMemberText}>Add members</Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={members.slice(0, 9)}
            scrollEnabled={false}
            renderItem={renderMember}
            keyExtractor={(item) => item.user.id.toString()}
          />
        </View>

        <Modal
          visible={memberModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setMemberModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlay}
            onPress={() => setMemberModalVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />

                <Text style={styles.modalUsername}>
                  {selectedMember?.user?.profile?.username}
                </Text>

                <Text style={styles.modalEmail}>
                  {selectedMember?.user?.email}
                </Text>

                {Number(selectedMember?.user?.id) !==
                  Number(currentUser?.sub) && (
                  <TouchableOpacity
                    style={styles.modalBtn}
                    onPress={handleMessageUser}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={20}
                      color="#2563EB"
                    />

                    <Text style={styles.modalBtnText}>Message User</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => {
                    setMemberModalVisible(false);

                    router.push({
                      pathname: "/profile/[userId]",
                      params: {
                        userId: selectedMember.user.id.toString(),
                      },
                    });
                  }}
                >
                  <Ionicons name="person-outline" size={20} color="#2563EB" />

                  <Text style={styles.modalBtnText}>View Profile</Text>
                </TouchableOpacity>

                {canWarnMuteSelectedMember && (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.modalBtn,
                        actionLoading && styles.disabledModalBtn,
                      ]}
                      disabled={actionLoading}
                      onPress={handleWarnMember}
                    >
                      <Ionicons
                        name="warning-outline"
                        size={20}
                        color="#2563EB"
                      />

                      <Text style={styles.modalBtnText}>Warn Member</Text>
                    </TouchableOpacity>

                    {selectedMember?.isMuted ? (
                      <TouchableOpacity
                        style={[
                          styles.modalBtn,
                          actionLoading && styles.disabledModalBtn,
                        ]}
                        disabled={actionLoading}
                        onPress={handleUnmuteMember}
                      >
                        <Ionicons
                          name="volume-high-outline"
                          size={20}
                          color="#2563EB"
                        />

                        <Text style={styles.modalBtnText}>Unmute Member</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.modalBtn,
                          actionLoading && styles.disabledModalBtn,
                        ]}
                        disabled={actionLoading}
                        onPress={handleMuteMember}
                      >
                        <Ionicons
                          name="volume-mute-outline"
                          size={20}
                          color="#2563EB"
                        />

                        <Text style={styles.modalBtnText}>Mute Member</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {canRemoveSelectedMember && (
                  <TouchableOpacity
                    style={[
                      styles.modalBtn,
                      styles.removeModalBtn,
                      actionLoading && styles.disabledModalBtn,
                    ]}
                    disabled={actionLoading}
                    onPress={handleRemoveMember}
                  >
                    <Ionicons
                      name="person-remove-outline"
                      size={20}
                      color="#DC2626"
                    />

                    <Text
                      style={[styles.modalBtnText, styles.removeModalBtnText]}
                    >
                      Remove Member
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setMemberModalVisible(false)}
                >
                  <Text style={styles.close}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={removeConfirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRemoveConfirmVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlayCenter}
            onPress={() => setRemoveConfirmVisible(false)}
          >
            <TouchableWithoutFeedback>
              <View style={styles.confirmCard}>
                <View style={styles.confirmIcon}>
                  <Ionicons
                    name="person-remove-outline"
                    size={28}
                    color="#DC2626"
                  />
                </View>

                <Text style={styles.confirmTitle}>Remove Member</Text>

                <Text style={styles.confirmText}>
                  Are you sure you want to remove{" "}
                  <Text style={styles.confirmName}>
                    {selectedMember?.user?.profile?.username || "this member"}
                  </Text>
                  ?
                </Text>

                <TouchableOpacity
                  disabled={actionLoading}
                  style={[
                    styles.confirmRemoveButton,
                    actionLoading && styles.disabledConfirmButton,
                  ]}
                  onPress={confirmRemoveMember}
                >
                  <Text style={styles.confirmRemoveText}>Remove Member</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmCancelButton}
                  onPress={() => setRemoveConfirmVisible(false)}
                >
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </TouchableOpacity>
        </Modal>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Media, Links & Docs</Text>

            {hasLatestMedia && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => openGroupSharedMedia()}
              >
                <Text style={styles.viewAll}>View all</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasLatestMedia ? (
            <View style={styles.mediaRow}>
              {latestMediaMessages.map((message) => {
                const contentType = String(
                  message.contentType,
                ).toUpperCase() as GroupMediaPreviewProps["contentType"];

                return (
                  <TouchableOpacity
                    key={message.id}
                    activeOpacity={0.8}
                    style={styles.mediaPreviewButton}
                    onPress={() => openGroupSharedMedia(contentType)}
                  >
                    <GroupMediaPreview
                      message={message}
                      contentType={contentType}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <Text style={styles.noMediaMessages}>No Media Messages</Text>
          )}
        </View>

        {isActiveMember && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.leaveButton}
            onPress={handleLeaveGroup}
          >
            <Ionicons name="exit-outline" size={25} color="#E11D48" />

            <Text style={styles.leaveText}>Leave Group</Text>
          </TouchableOpacity>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>

      <GroupAvatarBottomSheet
        ref={avatarSheetRef}
        hasAvatar={!!group?.avatarUrl}
        onCamera={openCamera}
        onGallery={openGallery}
        onRemove={removeAvatar}
      />

      {/* LEAVE GROUP FIX: Back, backdrop, and cancel dismiss without calling leaveGroup. */}
      <Modal
        visible={leaveConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaveConfirmVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlayCenter}
          onPress={() => setLeaveConfirmVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.confirmCard}>
              <View style={styles.confirmIcon}>
                <Ionicons name="exit-outline" size={28} color="#DC2626" />
              </View>

              <Text style={styles.confirmTitle}>Leave Group?</Text>

              <Text style={styles.confirmText}>
                Are you sure you want to leave this group?
              </Text>

              <TouchableOpacity
                disabled={actionLoading}
                style={[
                  styles.confirmRemoveButton,
                  actionLoading && styles.disabledConfirmButton,
                ]}
                onPress={confirmLeaveGroup}
              >
                <Text style={styles.confirmRemoveText}>Yes, Leave Group</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setLeaveConfirmVisible(false)}
              >
                <Text style={styles.confirmCancelText}>No, Stay</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        onClose={closeFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDFDFF",
  },

  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
    position: "relative",
  },

  header: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F9",
    zIndex: 100,
    elevation: 5,
    shadowColor: "#1E3A8A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 21,
    fontWeight: "700",
    color: "#0B1545",
    marginHorizontal: 12,
  },

  blobTopLeft: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#EEF3FF",
    top: 35,
    left: -130,
    opacity: 0.9,
  },

  blobTopRight: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#F0EBFF",
    top: 150,
    right: -110,
    opacity: 0.8,
  },

  blobMiddleRight: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#F1EEFF",
    top: 650,
    right: -95,
    opacity: 0.7,
  },

  blobBottomLeft: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#EEF4FF",
    bottom: 80,
    left: -140,
    opacity: 0.75,
  },

  profileSection: {
    alignItems: "center",
    paddingTop: 34,
    paddingHorizontal: 24,
    paddingBottom: 32,
    zIndex: 2,
  },

  avatarWrapper: {
    position: "relative",
    zIndex: 10,
    elevation: 10,
  },

  avatar: {
    width: 154,
    height: 154,
    borderRadius: 77,
    borderWidth: 1,
    borderColor: "#E3E9FF",
  },

  emptyAvatar: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarEditButton: {
    position: "absolute",
    right: -3,
    bottom: 5,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 5,
  },

  groupName: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: "#0B1545",
  },

  memberCount: {
    marginTop: 8,
    fontSize: 16,
    color: "#69708A",
  },

  leftGroupNotice: {
    width: "100%",
    maxWidth: 350,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },

  leftGroupNoticeText: {
    flex: 1,
    marginLeft: 8,
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
  },

  description: {
    marginTop: 17,
    maxWidth: 330,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: "#69708A",
  },

  descriptionAction: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },

  descriptionActionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563EB",
  },

  sectionCard: {
    marginHorizontal: 18,
    marginBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF1F8",
    shadowColor: "#1E3A8A",
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 4,
    zIndex: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#0B1545",
  },

  viewAll: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "600",
  },

  addMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 2,
  },

  addMemberIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#7EA5FF",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFF",
  },

  addMemberText: {
    marginLeft: 16,
    fontSize: 17,
    fontWeight: "600",
    color: "#2563EB",
  },

  memberRow: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F4F9",
  },

  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  memberAvatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
  },

  memberAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4F46E5",
  },

  memberInfo: {
    flex: 1,
    marginLeft: 15,
    paddingRight: 10,
  },

  memberName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0B1545",
  },

  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 5,
    gap: 5,
  },

  adminBadge: {
    overflow: "hidden",
    backgroundColor: "#DCFCE7",
    color: "#15803D",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    fontSize: 11,
    fontWeight: "600",
  },

  warnedBadge: {
    overflow: "hidden",
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    fontSize: 11,
    fontWeight: "600",
  },

  mutedBadge: {
    overflow: "hidden",
    backgroundColor: "#FEF3C7",
    color: "#92400E",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    fontSize: 11,
    fontWeight: "600",
  },

  mediaRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    gap: 10,
  },

  mediaPreviewButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 82,
    borderRadius: 16,
  },

  mediaPreviewTile: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F1F4FC",
  },

  mediaPreviewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  mediaPreviewFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E8EEFC",
  },

  mediaPreviewDetails: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    paddingVertical: 5,
  },

  mediaPreviewItemText: {
    width: "100%",
    marginTop: 4,
    color: "#334155",
    fontSize: 9,
    lineHeight: 11,
    fontWeight: "600",
    textAlign: "center",
  },

  noMediaMessages: {
    paddingVertical: 12,
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },

  leaveButton: {
    marginHorizontal: 18,
    minHeight: 70,
    borderRadius: 24,
    backgroundColor: "#FFF0F3",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#FFE0E7",
    zIndex: 2,
  },

  leaveText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#E11D48",
  },

  bottomSpacing: {
    height: 20,
  },

  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,21,69,0.04)",
  },

  settingsMenu: {
    position: "absolute",
    right: 18,
    width: 230,
    borderRadius: 20,
    paddingVertical: 7,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF1F8",
    shadowColor: "#0B1545",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 12,
    zIndex: 100,
  },

  menuItem: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F5FA",
  },

  menuItemLast: {
    borderBottomWidth: 0,
  },

  menuItemText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: "600",
    color: "#0B1545",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,21,69,0.35)",
    justifyContent: "flex-end",
  },

  modalContent: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D9DEE9",
    marginBottom: 20,
  },

  modalUsername: {
    fontSize: 21,
    fontWeight: "700",
    color: "#0B1545",
  },

  modalEmail: {
    color: "#69708A",
    fontSize: 14,
    marginTop: 5,
    marginBottom: 18,
  },

  modalBtn: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F3F8",
  },

  modalBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0B1545",
  },

  removeModalBtn: {
    borderBottomWidth: 0,
  },

  removeModalBtnText: {
    color: "#DC2626",
  },

  disabledModalBtn: {
    opacity: 0.45,
  },

  closeModalButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#F4F6FB",
    justifyContent: "center",
    alignItems: "center",
  },

  close: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
  },

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(11,21,69,0.38)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  confirmCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 24,
    alignItems: "center",
  },

  confirmIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFF0F3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  confirmTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#0B1545",
  },

  confirmText: {
    marginTop: 10,
    textAlign: "center",
    color: "#64748B",
    fontSize: 15,
    lineHeight: 22,
  },

  confirmName: {
    color: "#0B1545",
    fontWeight: "700",
  },

  confirmRemoveButton: {
    width: "100%",
    height: 52,
    borderRadius: 17,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },

  confirmRemoveText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  disabledConfirmButton: {
    opacity: 0.5,
  },

  confirmCancelButton: {
    marginTop: 8,
    width: "100%",
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  confirmCancelText: {
    color: "#64748B",
    fontSize: 16,
    fontWeight: "600",
  },
});
