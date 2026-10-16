import { API_BASE_URL } from "@/src/services/api/apiClient";
import uuid from "react-native-uuid";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import AttachmentPicker from "@/components/chat/AttachmentPicker";
import AttachmentBottomSheet from "@/components/chat/AttachmentBottomSheet";
import AttachmentPreview from "@/components/chat/AttachmentPreview";
import MessageActionBottomSheet from "@/components/chat/MessageActionBottomSheet";
import DeleteMessageBottomSheet from "@/components/chat/DeleteMessageBottomSheet";
import PrivacyBottomSheet from "@/components/chat/PrivacyBottomSheet";
import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import {
  getGroupMessages,
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessageForMe,
  deleteGroupMessageForEveryone,
} from "@/src/services/group/groupMessageService";
import {
  removeMember,
  getGroupDetails,
  getMyGroupMembers,
  inviteAdminToGroup,
  getAdminInvitationStatus,
  AdminInvitationStatus,
} from "@/src/services/group/groupService";
import { useDraftStore, getGroupDraftKey } from "@/src/store/chat/draftStore";
import { useSocket } from "@/hooks/useSocket";
import { useAuthStore } from "@/src/store/auth/authStorage";
import { Message } from "@/src/types/chat.types";
import { useUploadQueueStore } from "@/src/store/chat/uploadQueueStore";
import GroupMessageMedia from "@/components/chat/GroupMessageMedia";

const isSameCalendarDay = (dateA: string | Date, dateB: string | Date) => {
  const a = new Date(dateA);
  const b = new Date(dateB);

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const formatMessageDate = (dateValue: string | Date) => {
  const date = new Date(dateValue);
  const now = new Date();

  if (isSameCalendarDay(date, now)) {
    return "Today";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameCalendarDay(date, yesterday)) {
    return "Yesterday";
  }

  const currentDay = now.getDay();
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;

  const startOfCurrentWeek = new Date(now);
  startOfCurrentWeek.setDate(now.getDate() + mondayOffset);
  startOfCurrentWeek.setHours(0, 0, 0, 0);

  const startOfNextWeek = new Date(startOfCurrentWeek);
  startOfNextWeek.setDate(startOfCurrentWeek.getDate() + 7);

  if (date >= startOfCurrentWeek && date < startOfNextWeek) {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const MESSAGE_EDIT_WINDOW_MS = 10 * 60 * 1000;

// LINK PREVIEW CHANGE: Added the same webpage metadata preview used in ChatScreen.
type LinkPreviewData = {
  title: string;
  description: string;
  imageUrl: string | null;
  siteName: string;
  url: string;
};

// Keep metadata and in-flight requests across message-list renders.
const linkPreviewCache = new Map<string, LinkPreviewData | null>();
const linkPreviewRequests = new Map<string, Promise<LinkPreviewData | null>>();

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const getMetaAttribute = (tag: string, attribute: string) => {
  const match = tag.match(
    new RegExp(`${attribute}\\s*=\\s*[\\"']([^\\"']+)[\\"']`, "i"),
  );
  return match?.[1] ? decodeHtmlEntities(match[1].trim()) : "";
};

const getMetaContent = (html: string, names: string[]) => {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  const wantedNames = names.map((name) => name.toLowerCase());
  for (const tag of metaTags) {
    const property = getMetaAttribute(tag, "property").toLowerCase();
    const name = getMetaAttribute(tag, "name").toLowerCase();
    if (wantedNames.includes(property) || wantedNames.includes(name)) {
      const content = getMetaAttribute(tag, "content");
      if (content) return content;
    }
  }
  return "";
};

const getPageTitle = (html: string) => {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]
    ? decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "").trim())
    : "";
};

const resolvePreviewImageUrl = (imageUrl: string, pageUrl: string) => {
  if (!imageUrl) return null;
  try {
    return new URL(imageUrl, pageUrl).toString();
  } catch {
    return imageUrl;
  }
};

const normalizePreviewUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

// LINK PREVIEW CHANGE: Typed group messages are sent as TEXT,
// so find URLs in either TEXT or LINK message content.
const getLinkPreviewUrl = (value?: unknown) => {
  if (typeof value !== "string" || !value.trim()) return null;

  const urlRegex =
    /(https?:\/\/[^\s<]+|www\.[^\s<]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<]*)?)/i;
  const match = value.match(urlRegex);
  const matchedUrl = match?.[0]?.replace(/[),.!?;:]+$/g, "");

  return matchedUrl ? normalizePreviewUrl(matchedUrl) : null;
};

const fetchLinkPreview = async (rawUrl: string) => {
  const url = normalizePreviewUrl(rawUrl);
  if (!url) return null;
  if (linkPreviewCache.has(url)) return linkPreviewCache.get(url) ?? null;
  const existingRequest = linkPreviewRequests.get(url);
  if (existingRequest) return existingRequest;

  const request = (async (): Promise<LinkPreviewData | null> => {
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/html,application/xhtml+xml" },
      });
      if (!response.ok) {
        linkPreviewCache.set(url, null);
        return null;
      }
      const contentType = response.headers.get("content-type") || "";
      if (
        contentType &&
        !/text\/html|application\/xhtml\+xml/i.test(contentType)
      ) {
        linkPreviewCache.set(url, null);
        return null;
      }
      const html = await response.text();
      const title =
        getMetaContent(html, ["og:title", "twitter:title"]) ||
        getPageTitle(html);
      const description = getMetaContent(html, [
        "og:description",
        "twitter:description",
        "description",
      ]);
      const imageUrl = resolvePreviewImageUrl(
        getMetaContent(html, [
          "og:image",
          "twitter:image",
          "twitter:image:src",
        ]),
        response.url || url,
      );
      let siteName = getMetaContent(html, ["og:site_name"]);
      if (!siteName) {
        try {
          siteName = new URL(response.url || url).hostname.replace(
            /^www\./i,
            "",
          );
        } catch {
          siteName = url;
        }
      }
      const preview: LinkPreviewData = {
        title: title || siteName,
        description,
        imageUrl,
        siteName,
        url,
      };
      if (!preview.title && !preview.description && !preview.imageUrl) {
        linkPreviewCache.set(url, null);
        return null;
      }
      linkPreviewCache.set(url, preview);
      return preview;
    } catch (error) {
      console.log("Unable to load link preview:", error);
      linkPreviewCache.set(url, null);
      return null;
    } finally {
      linkPreviewRequests.delete(url);
    }
  })();
  linkPreviewRequests.set(url, request);
  return request;
};

const LinkPreview = ({
  url,
  isMe = false,
}: {
  url: string;
  isMe?: boolean;
}) => {
  const normalizedUrl = normalizePreviewUrl(url);
  const [preview, setPreview] = useState<LinkPreviewData | null>(
    normalizedUrl ? (linkPreviewCache.get(normalizedUrl) ?? null) : null,
  );
  const [loading, setLoading] = useState(
    normalizedUrl ? !linkPreviewCache.has(normalizedUrl) : false,
  );
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!normalizedUrl) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
    const cached = linkPreviewCache.get(normalizedUrl);
    if (cached) {
      setPreview(cached);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
    if (linkPreviewCache.has(normalizedUrl)) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }
    setLoading(true);
    fetchLinkPreview(normalizedUrl).then((result) => {
      if (!mounted) return;
      setPreview(result);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [normalizedUrl]);

  if (!preview && !loading) return null;
  return (
    <View style={[styles.linkPreview, isMe && styles.linkPreviewOutgoing]}>
      {loading && !preview ? (
        <View style={styles.linkPreviewLoading}>
          <Text style={styles.linkPreviewLoadingText}>Loading preview…</Text>
        </View>
      ) : null}
      {preview ? (
        <>
          {preview.imageUrl && !imageFailed ? (
            <Image
              source={{ uri: preview.imageUrl }}
              style={styles.linkPreviewImage}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
            />
          ) : null}
          <View style={styles.linkPreviewBody}>
            {!!preview.title && (
              <Text numberOfLines={2} style={styles.linkPreviewTitle}>
                {preview.title}
              </Text>
            )}
            {!!preview.description && (
              <Text numberOfLines={3} style={styles.linkPreviewDescription}>
                {preview.description}
              </Text>
            )}
            <Text numberOfLines={1} style={styles.linkPreviewDomain}>
              {preview.siteName}
            </Text>
          </View>
        </>
      ) : null}
    </View>
  );
};

const isWithinMessageEditWindow = (message: Message) => {
  if (!message?.createdAt) {
    return false;
  }

  const createdAt = new Date(message.createdAt).getTime();

  if (!Number.isFinite(createdAt)) {
    return false;
  }

  return Date.now() - createdAt < MESSAGE_EDIT_WINDOW_MS;
};

export default function GroupChatScreen() {
  const {
    groupId,
    adminMode,
    isLeft: routeIsLeft,
  } = useLocalSearchParams<{
    groupId: string;
    adminMode?: string;
    isLeft?: string;
  }>();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(
    null,
  );
  const [members, setMembers] = useState<any[]>([]);
  const [group, setGroup] = useState<any>(null);
  const [invitingAdmin, setInvitingAdmin] = useState(false);
  const [adminInvitationStatus, setAdminInvitationStatus] =
    useState<AdminInvitationStatus>("NONE");

  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [selectedMention, setSelectedMention] = useState<any>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set(),
  );
  const [editingGroupMessage, setEditingGroupMessage] =
    useState<Message | null>(null);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [showInviteSuccess, setShowInviteSuccess] = useState(false);
  const [showInviteAdminConfirmation, setShowInviteAdminConfirmation] =
    useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackButtonText, setFeedbackButtonText] = useState("OK");
  const [feedbackSecondaryButtonText, setFeedbackSecondaryButtonText] =
    useState<string | undefined>(undefined);
  const [feedbackOnSecondaryPress, setFeedbackOnSecondaryPress] = useState<
    (() => void) | undefined
  >(undefined);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const showFeedback = useCallback(
    ({
      type = "info",
      title,
      message,
      buttonText = "OK",
      secondaryButtonText,
      onSecondaryPress,
      loading = false,
    }: {
      type?: FeedbackType;
      title: string;
      message: string;
      buttonText?: string;
      secondaryButtonText?: string;
      onSecondaryPress?: () => void;
      loading?: boolean;
    }) => {
      setFeedbackType(type);
      setFeedbackTitle(title);
      setFeedbackMessage(message);
      setFeedbackButtonText(buttonText);
      setFeedbackSecondaryButtonText(secondaryButtonText);
      setFeedbackOnSecondaryPress(
        onSecondaryPress
          ? () => {
              onSecondaryPress();
            }
          : undefined,
      );
      setFeedbackLoading(loading);
      setFeedbackVisible(true);
    },
    [],
  );

  const closeFeedback = useCallback(() => {
    if (feedbackLoading) {
      return;
    }

    setFeedbackVisible(false);
    setFeedbackSecondaryButtonText(undefined);
    setFeedbackOnSecondaryPress(undefined);
  }, [feedbackLoading]);

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.sub;
  const numericCurrentUserId = Number(currentUserId);
  const numericGroupId = Number(groupId);
  const isLeft =
    typeof group?.isLeft === "boolean" ? group.isLeft : routeIsLeft === "true";
  const canUseGroup = !!group && !isLeft;

  const groupDraftKey =
    Number.isInteger(numericCurrentUserId) &&
    numericCurrentUserId > 0 &&
    Number.isInteger(numericGroupId) &&
    numericGroupId > 0
      ? getGroupDraftKey(numericCurrentUserId, numericGroupId)
      : null;

  const persistedGroupDraft = useDraftStore((state) =>
    groupDraftKey ? (state.drafts[groupDraftKey] ?? "") : "",
  );

  const setDraft = useDraftStore((state) => state.setDraft);
  const clearDraft = useDraftStore((state) => state.clearDraft);

  const addQueuedMessage = useUploadQueueStore(
    (state) => state.addQueuedMessage,
  );

  const myMembership = members.find(
    (member) => Number(member.user.id) === Number(currentUserId),
  );

  const isCreator =
    canUseGroup &&
    (group?.myRole === "CREATOR" || myMembership?.role === "CREATOR") &&
    Number(currentUserId) === Number(group?.createdById);

  const isVisibleAdmin =
    canUseGroup &&
    myMembership?.role === "ADMIN" &&
    myMembership?.isAdminVisible === true;

  const isVisibleAdminMember = useCallback(
    (userId: number) => {
      const member = members.find((m) => Number(m.user.id) === Number(userId));

      return member?.role === "ADMIN" && member?.isAdminVisible === true;
    },
    [members],
  );

  const isAdminConversation = adminMode === "true";
  const flatListRef = useRef<FlatList>(null);
  const attachmentSheetRef = useRef<BottomSheet>(null);
  const swipeRefs = useRef<
    Record<string, React.RefObject<SwipeableMethods | null>>
  >({});

  const messageActionSheetRef = useRef<BottomSheet>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionSheetRef = useRef<BottomSheet>(null);
  const deleteMessageSheetRef = useRef<BottomSheet>(null);
  const memberModerationSheetRef = useRef<BottomSheet>(null);
  const privacySheetRef = useRef<BottomSheet>(null);

  const insets = useSafeAreaInsets();
  const { socketRef, connected } = useSocket();
  const filteredMembers = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();

    return members.filter((member) => {
      const username = member.user.profile?.username ?? "";

      return (
        Number(member.user.id) !== Number(currentUserId) &&
        username.toLowerCase().includes(query)
      );
    });
  }, [members, mentionQuery, currentUserId]);

  const normalizeForwardedLinkMessage = useCallback((message: any) => {
    if (!message) {
      return message;
    }

    const isForwarded =
      message.isForwarded === true ||
      message.isForwarded === 1 ||
      message.isForwarded === "true" ||
      message.isForwarded === "1";

    const content = String(message.messageContent || "").trim();
    const contentType = String(message.contentType || "").toUpperCase();

    const isUrlOnly =
      /^(https?:\/\/|www\.)/i.test(content) ||
      /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?$/i.test(content);

    if (isForwarded && isUrlOnly && contentType === "TEXT") {
      return {
        ...message,
        contentType: "LINK",
      };
    }

    return message;
  }, []);

  const preserveSystemMessageUsernames = useCallback((nextMessages: any[]) => {
    setMessages((previousMessages) => {
      const previousById = new Map(
        previousMessages.map((message) => [String(message.id), message]),
      );

      return nextMessages.map((message) => {
        if (message?.type !== "SYSTEM") {
          return message;
        }

        const previousMessage = previousById.get(String(message.id));

        return {
          ...message,
          _persistedActorUsername:
            message.sender?.profile?.username ||
            message._persistedActorUsername ||
            previousMessage?._persistedActorUsername ||
            null,
          _persistedTargetUsername:
            message.targetUser?.profile?.username ||
            message._persistedTargetUsername ||
            previousMessage?._persistedTargetUsername ||
            null,
        };
      });
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await getGroupMessages(Number(groupId));

      preserveSystemMessageUsernames(
        (data || []).map(normalizeForwardedLinkMessage),
      );
    } catch (error) {
      // console.log("Fetch messages error:", error);
    }
  }, [groupId, normalizeForwardedLinkMessage, preserveSystemMessageUsernames]);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await getMyGroupMembers(Number(groupId));
      setMembers(data || []);
    } catch (error) {
      console.log("Fetch members error:", error);
    }
  }, [groupId]);

  const fetchGroup = useCallback(async () => {
    try {
      const data = await getGroupDetails(Number(groupId));
      setGroup(data);
    } catch (error) {
      console.log("Fetch group error:", error);
    }
  }, [groupId]);

  const loadAdminInvitationStatus = useCallback(async () => {
    try {
      const response = await getAdminInvitationStatus(Number(groupId));

      setAdminInvitationStatus(response.status);
    } catch (error) {
      console.log("Admin invitation status error:", error);
    }
  }, [groupId]);

  useEffect(() => {
    fetchMessages();
    fetchMembers();
    fetchGroup();
    loadAdminInvitationStatus();
  }, [fetchMessages, fetchMembers, fetchGroup, loadAdminInvitationStatus]);

  useFocusEffect(
    useCallback(() => {
      fetchMembers();
      fetchGroup();
      loadAdminInvitationStatus();
    }, [fetchMembers, fetchGroup, loadAdminInvitationStatus]),
  );

  useEffect(() => {
    if (!groupDraftKey || editingGroupMessage) {
      return;
    }

    setText((currentValue) =>
      currentValue === persistedGroupDraft ? currentValue : persistedGroupDraft,
    );
  }, [groupDraftKey, persistedGroupDraft, editingGroupMessage]);

  useEffect(() => {
    if (!isLeft) {
      return;
    }

    setSelectedMessageIds(new Set());
    setSelectedMessage(null);
    setReplyingTo(null);
    setSelectedAttachment(null);
    setEditingGroupMessage(null);
    setShowMentionSuggestions(false);
  }, [isLeft]);

  useEffect(() => {
    if (!connected || !group) {
      return;
    }

    const socket = socketRef?.current;

    if (!socket) {
      return;
    }

    if (isLeft) {
      socket.emit("leaveGroup", `group_${groupId}`);
      return;
    }

    socket.emit("joinGroup", `group_${groupId}`);

    socket.emit("groupMessagesRead", {
      groupId: Number(groupId),
    });

    const handleNewGroupMessage = (message: Message) => {
      if (Number(message.groupId) !== Number(groupId)) {
        return;
      }

      const normalizedMessage = normalizeForwardedLinkMessage(message);

      // Capture usernames while the system-message relations are still available.
      const messageWithUsernameSnapshots =
        normalizedMessage?.type === "SYSTEM"
          ? {
              ...normalizedMessage,
              _persistedActorUsername:
                normalizedMessage.sender?.profile?.username ||
                normalizedMessage._persistedActorUsername ||
                null,
              _persistedTargetUsername:
                normalizedMessage.targetUser?.profile?.username ||
                normalizedMessage._persistedTargetUsername ||
                null,
            }
          : normalizedMessage;

      setMessages((prev) => {
        const optimisticIndex = prev.findIndex(
          (item) =>
            item.clientId &&
            normalizedMessage.clientId &&
            item.clientId === normalizedMessage.clientId,
        );

        if (optimisticIndex !== -1) {
          const updated = [...prev];

          updated[optimisticIndex] = {
            ...messageWithUsernameSnapshots,
            uploadStatus: "SENT",
            uploadProgress: 100,
          };

          return updated;
        }

        const exists = prev.some(
          (item) => Number(item.id) === Number(messageWithUsernameSnapshots.id),
        );

        if (exists) {
          return prev;
        }

        return [...prev, messageWithUsernameSnapshots];
      });

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      });
    };

    const handleGroupMessageDeletedForEveryone = (updatedMessage: any) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === updatedMessage.id ? updatedMessage : message,
        ),
      );
    };

    const handleGroupMessagesDelivered = ({
      userId,
      messageId,
    }: {
      groupId: number;
      userId: number;
      messageId: number;
    }) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          return {
            ...message,
            receipts: (message.receipts ?? []).map((receipt: any) =>
              receipt.userId === userId
                ? {
                    ...receipt,
                    deliveredAt: new Date().toISOString(),
                  }
                : receipt,
            ),
          };
        }),
      );
    };

    const handleGroupMessagesRead = ({
      userId,
      messageId,
    }: {
      groupId: number;
      userId: number;
      messageId: number;
    }) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          return {
            ...message,
            receipts: (message.receipts ?? []).map((receipt: any) =>
              receipt.userId === userId
                ? {
                    ...receipt,
                    readAt: new Date().toISOString(),
                  }
                : receipt,
            ),
          };
        }),
      );
    };

    const handleTypingStart = ({
      userId,
      username,
    }: {
      userId: number;
      username: string;
    }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [userId]: username,
      }));
    };

    const handleGroupMessageEdited = (updatedMessage: Message) => {
      if (!updatedMessage?.id) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) =>
          Number(message.id) === Number(updatedMessage.id)
            ? {
                ...message,
                ...updatedMessage,
              }
            : message,
        ),
      );
    };

    const handleTypingStop = ({ userId }: { userId: number }) => {
      setTypingUsers((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    };

    const handleMemberJoined = ({
      groupId: joinedGroupId,
    }: {
      groupId: number;
      userId: number;
    }) => {
      if (Number(joinedGroupId) !== Number(groupId)) {
        return;
      }

      fetchMembers();
    };

    const handleAdminInvitationCreated = ({
      groupId: invitedGroupId,
      status,
    }: {
      groupId: number;
      status: AdminInvitationStatus;
    }) => {
      if (Number(invitedGroupId) !== Number(groupId)) {
        return;
      }

      setAdminInvitationStatus(status);
    };

    const handleAdminInvitationAccepted = ({
      groupId: acceptedGroupId,
      status,
    }: {
      groupId: number;
      status: AdminInvitationStatus;
    }) => {
      if (Number(acceptedGroupId) !== Number(groupId)) {
        return;
      }

      setAdminInvitationStatus(status);
      fetchMembers();
      fetchGroup();
    };

    const handleGroupMembersUpdated = ({
      groupId: updatedGroupId,
    }: {
      groupId: number;
    }) => {
      if (Number(updatedGroupId) !== Number(groupId)) {
        return;
      }

      fetchMembers();
      fetchGroup();
    };

    const handleAdminInvitationDeclined = ({
      groupId: declinedGroupId,
      status,
    }: {
      groupId: number;
      status: AdminInvitationStatus;
    }) => {
      if (Number(declinedGroupId) !== Number(groupId)) {
        return;
      }

      setAdminInvitationStatus(status);
    };

    const handleGroupAvatarUpdated = ({
      groupId: updatedGroupId,
      avatarUrl,
    }: {
      groupId: number;
      avatarUrl: string;
    }) => {
      if (Number(updatedGroupId) !== Number(groupId)) {
        return;
      }

      setGroup((prev: any) => ({
        ...prev,
        avatarUrl,
      }));
    };

    socket.on("newGroupMessage", handleNewGroupMessage);

    socket.on(
      "groupMessageDeletedForEveryone",
      handleGroupMessageDeletedForEveryone,
    );

    socket.on("groupMessagesDelivered", handleGroupMessagesDelivered);

    socket.on("groupMessagesRead", handleGroupMessagesRead);

    socket.on("groupMessageEdited", handleGroupMessageEdited);

    socket.on("groupTyping:start", handleTypingStart);

    socket.on("groupTyping:stop", handleTypingStop);

    socket.on("memberJoined", handleMemberJoined);

    socket.on("adminInvitationCreated", handleAdminInvitationCreated);

    socket.on("adminInvitationAccepted", handleAdminInvitationAccepted);

    socket.on("adminInvitationDeclined", handleAdminInvitationDeclined);

    socket.on("groupMembersUpdated", handleGroupMembersUpdated);

    socket.on("groupAvatarUpdated", handleGroupAvatarUpdated);

    return () => {
      socket.emit("leaveGroup", `group_${groupId}`);

      socket.off("newGroupMessage", handleNewGroupMessage);

      socket.off(
        "groupMessageDeletedForEveryone",
        handleGroupMessageDeletedForEveryone,
      );

      socket.off("groupMessagesDelivered", handleGroupMessagesDelivered);

      socket.off("groupMessagesRead", handleGroupMessagesRead);

      socket.off("groupMessageEdited", handleGroupMessageEdited);

      socket.off("groupTyping:start", handleTypingStart);

      socket.off("groupTyping:stop", handleTypingStop);

      socket.off("memberJoined", handleMemberJoined);

      socket.off("adminInvitationCreated", handleAdminInvitationCreated);

      socket.off("adminInvitationAccepted", handleAdminInvitationAccepted);

      socket.off("adminInvitationDeclined", handleAdminInvitationDeclined);

      socket.off("groupMembersUpdated", handleGroupMembersUpdated);

      socket.off("groupAvatarUpdated", handleGroupAvatarUpdated);
    };
  }, [
    groupId,
    connected,
    socketRef,
    fetchMembers,
    fetchGroup,
    normalizeForwardedLinkMessage,
    group,
    isLeft,
  ]);

  const openPrivacySheet = useCallback(() => {
    privacySheetRef.current?.snapToIndex(0);
  }, []);

  const handlePickedAttachment = useCallback((file: any) => {
    setSelectedAttachment(file);
  }, []);

  const openAttachmentSheet = useCallback(() => {
    attachmentSheetRef.current?.snapToIndex(0);
  }, []);

  const pickPhoto = async () => {
    attachmentSheetRef.current?.close();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    handlePickedAttachment({
      uri: asset.uri,
      name: asset.fileName || "photo",
      mimeType: asset.mimeType,
      size: asset.fileSize,
      contentType: "IMAGE",
      width: asset.width,
      height: asset.height,
    });
  };

  const pickVideo = async () => {
    attachmentSheetRef.current?.close();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 1,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    handlePickedAttachment({
      uri: asset.uri,
      name: asset.fileName || "video",
      mimeType: asset.mimeType,
      size: asset.fileSize,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      contentType: "VIDEO",
    });
  };

  const pickAudio = async () => {
    attachmentSheetRef.current?.close();

    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      multiple: false,
    });

    if (result.canceled) {
      return;
    }

    const file = result.assets[0];

    handlePickedAttachment({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      contentType: "AUDIO",
    });
  };

  const pickDocument = async () => {
    attachmentSheetRef.current?.close();

    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
    });

    if (result.canceled) {
      return;
    }

    const file = result.assets[0];

    handlePickedAttachment({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      contentType: "FILE",
    });
  };

  const handleTyping = (value: string) => {
    if (!canUseGroup) {
      return;
    }

    setText(value);

    if (groupDraftKey) {
      setDraft(groupDraftKey, value);
    }

    const words = value.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      setMentionQuery(lastWord.slice(1));
      setShowMentionSuggestions(true);
    } else {
      setMentionQuery("");
      setShowMentionSuggestions(false);
    }

    if (!socketRef.current) {
      return;
    }

    if (!typingTimeout.current) {
      socketRef.current.emit("groupTyping:start", {
        groupId: Number(groupId),
      });
    }

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit("groupTyping:stop", {
        groupId: Number(groupId),
      });

      typingTimeout.current = null;
    }, 1000);
  };

  const handleSendGroupMessage = async () => {
    if (!canUseGroup) {
      return;
    }

    if (!text.trim() && !selectedAttachment) {
      return;
    }

    const clientId = uuid.v4().toString();
    const attachment = selectedAttachment;

    const optimisticMessage: Message = {
      id: -Date.now(),
      clientId,
      type: "GROUP",
      senderId: Number(currentUserId) || 0,
      groupId: Number(groupId),
      messageContent: text.trim(),
      contentType: attachment?.contentType || "TEXT",
      mediaUrl: null,
      fileName: attachment?.name || null,
      mimeType: attachment?.mimeType || null,
      fileSize: attachment?.size ?? null,
      localUri: attachment?.uri || null,
      duration: attachment?.duration ?? null,
      waveform: attachment?.waveform ?? null,
      videoWidth: attachment?.width ?? null,
      videoHeight: attachment?.height ?? null,
      replyToId: replyingTo?.id || null,
      replyTo: replyingTo || null,
      createdAt: new Date().toISOString(),
      uploadStatus: "QUEUED",
      uploadProgress: attachment ? 0 : 100,
      isMediaEncrypted: !!attachment,
      isForwarded: false,
      deletedById: attachment?.deletedById ?? null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    addQueuedMessage(optimisticMessage);

    setText("");

    if (groupDraftKey) {
      clearDraft(groupDraftKey);
    }

    setSelectedAttachment(null);
    setReplyingTo(null);

    socketRef.current?.emit("groupTyping:stop", {
      groupId: Number(groupId),
    });

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({
        animated: true,
      });
    });
  };

  const handleAddMembers = () => {
    if (!canUseGroup) {
      return;
    }

    router.push({
      pathname: "/groups/add-member",
      params: {
        groupId: String(groupId),
      },
    });
  };

  const handleInviteAdmin = () => {
    if (!canUseGroup) {
      return;
    }

    if (
      invitingAdmin ||
      adminInvitationStatus === "PENDING" ||
      adminInvitationStatus === "ACCEPTED"
    ) {
      return;
    }

    setShowInviteAdminConfirmation(true);
  };

  const handleConfirmInviteAdmin = async () => {
    if (
      invitingAdmin ||
      adminInvitationStatus === "PENDING" ||
      adminInvitationStatus === "ACCEPTED"
    ) {
      setShowInviteAdminConfirmation(false);
      return;
    }

    setShowInviteAdminConfirmation(false);

    try {
      setInvitingAdmin(true);

      await inviteAdminToGroup(Number(groupId));

      setAdminInvitationStatus("PENDING");
      setShowInviteSuccess(true);

      setTimeout(() => {
        setShowInviteSuccess(false);
      }, 3000);

      showFeedback({
        type: "success",
        title: "Invitation Sent",
        message: "The Admin has been invited to join this group.",
        buttonText: "OK",
      });
    } catch (error: any) {
      if (error.message === "An Admin has already been invited") {
        setAdminInvitationStatus("PENDING");
      }

      if (error.message === "This group already has an Admin") {
        setAdminInvitationStatus("ACCEPTED");
      }

      showFeedback({
        type: "error",
        title: "Unable to Invite Admin",
        message: error.message || "Something went wrong. Please try again.",
        buttonText: "OK",
      });
    } finally {
      setInvitingAdmin(false);
    }
  };

  const getSelectedMessages = () => {
    if (!selectedMessageIds.size) {
      return [];
    }

    return messages.filter((message) =>
      selectedMessageIds.has(getMessageSelectionKey(message)),
    );
  };

  const getSelectedPersistedMessageIds = () => {
    return getSelectedMessages()
      .filter((message) => !message?.deletedForAll)
      .map((message) => Number(message?.id))
      .filter((id) => Number.isInteger(id) && id > 0);
  };

  const handleForwardMessage = () => {
    const messageIds = isSelectionMode
      ? getSelectedPersistedMessageIds()
      : [Number(selectedMessage?.id)].filter(
          (id) => Number.isInteger(id) && id > 0,
        );

    if (messageIds.length === 0) {
      showFeedback({
        type: "warning",
        title: "Unable to Forward",
        message:
          "The selected message cannot be forwarded because it has not been saved yet.",
        buttonText: "OK",
      });

      return;
    }

    messageActionSheetRef.current?.close();

    if (isSelectionMode) {
      clearMessageSelection();
    } else {
      setSelectedMessage(null);
    }

    setTimeout(() => {
      router.push({
        pathname: "/chats/forward",
        params: {
          messageIds: JSON.stringify(messageIds),
          sourceType: "group",
        },
      });
    }, 200);
  };

  const handleDeleteMessage = () => {
    messageActionSheetRef.current?.close();

    setTimeout(() => {
      deleteMessageSheetRef.current?.expand();
    }, 200);
  };

  const handleRemovePlaceholder = async () => {
    if (!selectedMessage) {
      return;
    }

    try {
      await deleteGroupMessageForMe(selectedMessage.id);

      setMessages((prev) =>
        prev.filter((message) => message.id !== selectedMessage.id),
      );

      setSelectedMessage(null);
      messageActionSheetRef.current?.close();
    } catch (error) {
      console.log("Remove placeholder error:", error);

      showFeedback({
        type: "error",
        title: "Unable to Remove Message",
        message:
          "The deleted message could not be removed from your chat. Please try again.",
        buttonText: "OK",
      });
    }
  };

  const handleDeleteMessageForEveryone = async () => {
    const targetMessages = isSelectionMode
      ? getSelectedMessages()
      : selectedMessage
        ? [selectedMessage]
        : [];

    if (targetMessages.length === 0) {
      return;
    }

    const performDelete = async () => {
      try {
        const deletableMessages = targetMessages.filter((message) => {
          const messageId = Number(message?.id);

          const canDelete =
            Number(message?.senderId) === Number(currentUserId) || isCreator;

          return Number.isInteger(messageId) && messageId > 0 && canDelete;
        });

        const results = await Promise.allSettled(
          deletableMessages.map((message) =>
            deleteGroupMessageForEveryone(message.id),
          ),
        );

        const updatedMessages = results
          .filter(
            (result): result is PromiseFulfilledResult<any> =>
              result.status === "fulfilled" && !!result.value,
          )
          .map((result) => result.value);

        if (updatedMessages.length > 0) {
          setMessages((prev) =>
            prev.map((message) => {
              const updated = updatedMessages.find(
                (candidate) => candidate.id === message.id,
              );

              return updated || message;
            }),
          );
        }

        const failedCount = results.filter(
          (result) => result.status === "rejected",
        ).length;

        if (failedCount > 0) {
          showFeedback({
            type: "warning",
            title: "Some Messages Could Not Be Deleted",
            message: `${failedCount} ${
              failedCount === 1 ? "message was" : "messages were"
            } not deleted for everyone.`,
            buttonText: "OK",
          });
        }

        deleteMessageSheetRef.current?.close();
        messageActionSheetRef.current?.close();
        clearMessageSelection();
      } catch (error) {
        console.log("Delete for everyone error:", error);

        showFeedback({
          type: "error",
          title: "Delete Failed",
          message:
            "The messages could not be deleted for everyone. Please try again.",
          buttonText: "OK",
        });
      }
    };

    const deletingAnotherUsersMessage = targetMessages.some(
      (message) =>
        Number(message.senderId) !== Number(currentUserId) && isCreator,
    );

    if (deletingAnotherUsersMessage) {
      showFeedback({
        type: "warning",
        title: "Delete for Everyone?",
        message: isSelectionMode
          ? `As the Group creator, you are deleting ${targetMessages.length} selected messages for everyone in this group chat. All members will see that the selected messages were deleted.`
          : `As the Group creator, you are deleting ${
              selectedMessage?.sender?.profile?.username || "this user's"
            } message for everyone in this group chat. All members will see that you deleted the message.`,
        buttonText: "Delete for Everyone",
        secondaryButtonText: "Cancel",
        onSecondaryPress: () => {
          closeFeedback();
        },
      });

      /*
       * The primary button of AppFeedbackModal calls onClose.
       * Therefore we temporarily replace the normal close
       * behavior with the delete operation by using the
       * secondary action for cancellation and reopening
       * the confirmation through the dedicated flow below.
       */
      setFeedbackVisible(false);

      setTimeout(() => {
        showFeedback({
          type: "warning",
          title: "Delete for Everyone?",
          message: isSelectionMode
            ? `As the Group creator, you are deleting ${targetMessages.length} selected messages for everyone in this group chat. All members will see that the selected messages were deleted.`
            : `As the Group creator, you are deleting ${
                selectedMessage?.sender?.profile?.username || "this user's"
              } message for everyone in this group chat. All members will see that you deleted the message.`,
          buttonText: "Delete for Everyone",
          secondaryButtonText: "Cancel",
          onSecondaryPress: () => {
            closeFeedback();
          },
        });
      }, 0);

      setFeedbackOnSecondaryPress(() => () => {
        closeFeedback();
        performDelete();
      });

      setFeedbackSecondaryButtonText("Delete for Everyone");
      setFeedbackButtonText("Cancel");

      return;
    }

    await performDelete();
  };

  const getCopyableMessageText = (message: any) => {
    const contentType = String(message?.contentType || "").toUpperCase();

    const content =
      typeof message?.messageContent === "string"
        ? message.messageContent.trim()
        : "";

    if (!content) {
      return null;
    }

    if (contentType === "TEXT" || contentType === "LINK") {
      return content;
    }

    const isMedia = !["TEXT", "LINK"].includes(contentType);

    return isMedia ? content : null;
  };

  const handleCopyMessage = async () => {
    const targetMessages = isSelectionMode
      ? getSelectedMessages()
      : selectedMessage
        ? [selectedMessage]
        : [];

    const copyableContents = targetMessages
      .map(getCopyableMessageText)
      .filter((content): content is string => !!content);

    if (copyableContents.length === 0) {
      return;
    }

    await Clipboard.setStringAsync(copyableContents.join("\n\n"));

    messageActionSheetRef.current?.close();
    clearMessageSelection();

    showFeedback({
      type: "success",
      title: "Copied",
      message:
        copyableContents.length === 1
          ? "Message copied to your clipboard."
          : `${copyableContents.length} messages copied to your clipboard.`,
      buttonText: "OK",
    });
  };

  const handleDeleteForMe = async () => {
    const targetMessages = isSelectionMode
      ? getSelectedMessages()
      : selectedMessage
        ? [selectedMessage]
        : [];

    if (targetMessages.length === 0) {
      return;
    }

    try {
      const validMessages = targetMessages.filter((message) => {
        const messageId = Number(message?.id);

        return Number.isInteger(messageId) && messageId > 0;
      });

      const results = await Promise.allSettled(
        validMessages.map((message) => deleteGroupMessageForMe(message.id)),
      );

      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;

      const successfulIds = validMessages
        .filter((_, index) => results[index]?.status === "fulfilled")
        .map((message) => message.id);

      setMessages((prev) =>
        prev.filter((message) => !successfulIds.includes(message.id)),
      );

      if (failedCount > 0) {
        showFeedback({
          type: "warning",
          title: "Some Messages Could Not Be Deleted",
          message: `${failedCount} ${
            failedCount === 1 ? "message was" : "messages were"
          } not deleted for you.`,
          buttonText: "OK",
        });
      } else {
        showFeedback({
          type: "success",
          title: "Message Deleted",
          message:
            successfulIds.length === 1
              ? "The message was deleted for you."
              : `${successfulIds.length} messages were deleted for you.`,
          buttonText: "OK",
        });
      }

      deleteMessageSheetRef.current?.close();
      messageActionSheetRef.current?.close();
      clearMessageSelection();
    } catch (error) {
      console.log("Delete for me error:", error);

      showFeedback({
        type: "error",
        title: "Delete Failed",
        message: "The messages could not be deleted for you. Please try again.",
        buttonText: "OK",
      });
    }
  };

  const getMessageSelectionKey = (message: any) => {
    if (message?.id !== undefined && message?.id !== null) {
      return String(message.id);
    }

    return message?.clientId ? String(message.clientId) : "";
  };

  const isMessageSelected = (message: any) => {
    const key = getMessageSelectionKey(message);

    return key.length > 0 && selectedMessageIds.has(key);
  };

  const isSelectionMode = selectedMessageIds.size > 0;

  const toggleMessageSelection = (message: any) => {
    const key = getMessageSelectionKey(message);

    if (!key) return;

    setSelectedMessageIds((previous) => {
      const next = new Set(previous);

      next.has(key) ? next.delete(key) : next.add(key);

      return next;
    });
  };

  const handleSelectMessage = () => {
    if (!selectedMessage) return;

    const key = getMessageSelectionKey(selectedMessage);

    if (!key) return;

    setSelectedMessageIds((previous) => {
      const next = new Set(previous);
      next.add(key);
      return next;
    });

    messageActionSheetRef.current?.close();
    setSelectedMessage(null);
  };

  const handleMessagePress = (message: any) => {
    if (canUseGroup && isSelectionMode) {
      toggleMessageSelection(message);
    }
  };

  const handleMessageLongPress = (message: any) => {
    if (!canUseGroup) {
      return;
    }

    if (isSelectionMode) {
      toggleMessageSelection(message);
      return;
    }

    setSelectedMessage(message);
    messageActionSheetRef.current?.expand();
  };

  const handleReplySwipe = (message: any) => {
    if (!canUseGroup || isSelectionMode || message?.deletedForAll) {
      return;
    }

    setReplyingTo(message);

    requestAnimationFrame(() => {
      const key = getMessageSelectionKey(message);

      swipeRefs.current[key]?.current?.close();
    });
  };

  const clearMessageSelection = () => {
    setSelectedMessageIds(new Set());
    setSelectedMessage(null);
    setReplyingTo(null);
  };

  const handleRemoveMember = async (userId: number, username: string) => {
    showFeedback({
      type: "warning",
      title: "Remove Member",
      message: `Do you want to remove ${username} from this group?`,
      buttonText: "Remove",
      secondaryButtonText: "Cancel",
      onSecondaryPress: () => {
        closeFeedback();
      },
    });

    /*
     * Since the shared modal primary button only calls
     * onClose, the actual removal is intentionally kept
     * behind a second confirmation-compatible interaction.
     */
  };

  const handleEditMessage = () => {
    if (!selectedMessage || !canEditSelectedMessage) {
      return;
    }

    if (!isWithinMessageEditWindow(selectedMessage)) {
      messageActionSheetRef.current?.close();

      showFeedback({
        type: "warning",
        title: "Edit Message",
        message: "Messages can only be edited within 10 minutes of sending.",
        buttonText: "OK",
      });

      return;
    }

    setEditingGroupMessage(selectedMessage);
    setDraftMessage(selectedMessage.messageContent);

    messageActionSheetRef.current?.close();
  };

  const handleSaveEditedMessage = async () => {
    if (!editingGroupMessage) {
      return;
    }

    if (!isWithinMessageEditWindow(editingGroupMessage)) {
      setEditingGroupMessage(null);
      setDraftMessage("");

      showFeedback({
        type: "warning",
        title: "Edit Message",
        message: "Messages can only be edited within 10 minutes of sending.",
        buttonText: "OK",
      });

      return;
    }

    const trimmed = draftMessage.trim();

    if (!trimmed) {
      return;
    }

    try {
      const updated = await editGroupMessage(editingGroupMessage.id, trimmed);

      setMessages((prev) =>
        prev.map((message) => (message.id === updated.id ? updated : message)),
      );

      setEditingGroupMessage(null);
      setDraftMessage("");

      showFeedback({
        type: "success",
        title: "Message Edited",
        message: "Your message has been updated successfully.",
        buttonText: "OK",
      });
    } catch (error) {
      console.log("Edit message error:", error);

      showFeedback({
        type: "error",
        title: "Unable to Edit Message",
        message: "The message could not be edited. Please try again.",
        buttonText: "OK",
      });
    }
  };

  const formatTime = (date?: string | Date | null) => {
    if (!date) {
      return "";
    }

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) {
      return "";
    }

    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getGroupMessageStatus = (message: any) => {
    if (!message.receipts) {
      return "SENT";
    }

    const otherReceipts = message.receipts.filter(
      (receipt: any) => Number(receipt.userId) !== Number(message.senderId),
    );

    if (otherReceipts.length === 0) {
      return "SENT";
    }

    const allRead = otherReceipts.every(
      (receipt: any) => receipt.readAt !== null,
    );

    if (allRead) {
      return "READ";
    }

    const allDelivered = otherReceipts.every(
      (receipt: any) => receipt.deliveredAt !== null,
    );

    if (allDelivered) {
      return "DELIVERED";
    }

    return "SENT";
  };

  const resolveMediaUrl = (mediaUrl?: string | null) => {
    if (!mediaUrl) {
      return null;
    }

    return mediaUrl.startsWith("http")
      ? mediaUrl
      : `${API_BASE_URL}${mediaUrl}`;
  };

  const getInitial = (username?: string) => {
    return username?.charAt(0)?.toUpperCase() || "U";
  };

  const openMentionMenu = (mention: any) => {
    setSelectedMention(mention);

    setTimeout(() => {
      mentionSheetRef.current?.snapToIndex(0);
    }, 100);
  };

  const selectedMessageContentType = String(
    selectedMessage?.contentType || "",
  ).toUpperCase();

  const isSelectedMessageMedia =
    selectedMessageContentType !== "TEXT" &&
    selectedMessageContentType !== "LINK";

  const hasSelectedMessageCaption =
    typeof selectedMessage?.messageContent === "string" &&
    selectedMessage.messageContent.trim().length > 0;

  const canCopySelectedMessage =
    selectedMessageContentType === "TEXT" ||
    selectedMessageContentType === "LINK" ||
    (isSelectedMessageMedia && hasSelectedMessageCaption);

  const canEditSelectedMessage =
    Number(selectedMessage?.senderId) === Number(currentUserId) &&
    canCopySelectedMessage &&
    isWithinMessageEditWindow(selectedMessage);

  const selectedMessages = useMemo(
    () =>
      messages.filter((message) =>
        selectedMessageIds.has(getMessageSelectionKey(message)),
      ),
    [messages, selectedMessageIds],
  );

  const canCopySelectedMessages =
    selectedMessages.length > 0 &&
    selectedMessages.every((message) => {
      const contentType = String(message?.contentType || "").toUpperCase();

      const hasContent =
        typeof message?.messageContent === "string" &&
        message.messageContent.trim().length > 0;

      if (!hasContent || message?.deletedForAll) {
        return false;
      }

      return contentType === "TEXT" || contentType === "LINK" || hasContent;
    });

  const canDeleteSelectedMessagesForEveryone =
    selectedMessages.length > 0 &&
    selectedMessages.every(
      (message) =>
        !message?.deletedForAll &&
        (Number(message?.senderId) === Number(currentUserId) || isCreator),
    );

  const openLink = async (url: string) => {
    let finalUrl = url.trim();

    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    try {
      await Linking.openURL(finalUrl);
    } catch (error) {
      console.log("Unable to open link:", error);

      showFeedback({
        type: "error",
        title: "Unable to Open Link",
        message: "This link could not be opened on your device.",
        buttonText: "OK",
      });
    }
  };

  const scrollToRepliedMessage = useCallback(
    (repliedMessage: any) => {
      const targetId = Number(repliedMessage?.id);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        return;
      }

      const targetIndex = messages.findIndex(
        (message) => Number(message?.id) === targetId,
      );

      if (targetIndex < 0) {
        console.log(
          "Reply target is not currently loaded in this group:",
          targetId,
        );

        return;
      }

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0,
        });
      });
    },
    [messages],
  );

  const renderMessageMeta = (item: any, isMe: boolean) => {
    if (!isMe) {
      return (
        <View style={styles.compactMetaRow}>
          {item.editedAt && <Text style={styles.edited}>Edited</Text>}

          <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
        </View>
      );
    }

    const messageStatus = getGroupMessageStatus(item);

    let statusIcon:
      | "checkmark"
      | "checkmark-done"
      | "time-outline"
      | "cloud-upload-outline" = "checkmark";

    let statusColor = "#94A3B8";

    if (item.uploadStatus === "QUEUED") {
      statusIcon = "time-outline";
      statusColor = "#F59E0B";
    } else if (item.uploadStatus === "UPLOADING") {
      statusIcon = "cloud-upload-outline";
      statusColor = "#2563EB";
    } else if (messageStatus === "READ") {
      statusIcon = "checkmark-done";
      statusColor = "#60A5FA";
    } else if (messageStatus === "DELIVERED") {
      statusIcon = "checkmark-done";
      statusColor = "#94A3B8";
    }

    return (
      <View style={styles.compactMetaRow}>
        {item.editedAt && <Text style={styles.edited}>Edited</Text>}

        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>

        <Ionicons
          name={statusIcon}
          size={15}
          color={statusColor}
          style={styles.statusIcon}
        />
      </View>
    );
  };

  const renderMessageContent = (item: any) => {
    if (!item.messageContent) {
      return null;
    }

    if (String(item.contentType).toUpperCase() === "LINK") {
      return (
        <Text
          style={[styles.messageText, styles.linkText]}
          onPress={() =>
            isSelectionMode
              ? handleMessagePress(item)
              : openLink(item.messageContent)
          }
        >
          {item.messageContent}
        </Text>
      );
    }

    const urlRegex =
      /(https?:\/\/[^\s<]+|www\.[^\s<]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<]*)?)/gi;

    const mentions = item.mentions ?? [];

    const renderTextPart = (part: string, keyPrefix: string) => {
      if (!part) {
        return null;
      }

      const mentionRegex = /(@[a-zA-Z0-9_.]+)/g;

      const mentionParts = part.split(mentionRegex);

      if (mentions.length === 0) {
        return part;
      }

      return mentionParts.map((mentionPart: string, index: number) => {
        if (!mentionPart.startsWith("@")) {
          return mentionPart;
        }

        const username = mentionPart.substring(1).toLowerCase();

        const mention = item.mentions?.find(
          (m: any) => m.user?.profile?.username?.toLowerCase() === username,
        );

        if (!mention) {
          return mentionPart;
        }

        const isCurrentUserMention =
          Number(mention.user.id) === Number(currentUserId);

        return (
          <Text
            key={`${keyPrefix}-mention-${index}`}
            style={[
              styles.mentionText,
              isCurrentUserMention && styles.myMentionText,
            ]}
            onPress={() =>
              isSelectionMode
                ? handleMessagePress(item)
                : router.push({
                    pathname: "/profile/[userId]",
                    params: {
                      userId: String(mention.user.id),
                    },
                  })
            }
            onLongPress={() =>
              isSelectionMode
                ? handleMessageLongPress(item)
                : openMentionMenu(mention)
            }
          >
            {mentionPart}
          </Text>
        );
      });
    };

    const urlParts = item.messageContent.split(urlRegex);

    return (
      <Text style={styles.messageText}>
        {urlParts.map((part: string, index: number) => {
          urlRegex.lastIndex = 0;

          if (urlRegex.test(part)) {
            urlRegex.lastIndex = 0;

            const linkUrl = part.replace(/[),.!?;:]+$/g, "");

            const trailingText = part.slice(linkUrl.length);

            return (
              <React.Fragment key={`url-${index}`}>
                <Text
                  style={styles.linkText}
                  onPress={() =>
                    isSelectionMode
                      ? handleMessagePress(item)
                      : openLink(linkUrl)
                  }
                >
                  {linkUrl}
                </Text>

                {trailingText
                  ? renderTextPart(trailingText, `trailing-${index}`)
                  : null}
              </React.Fragment>
            );
          }

          urlRegex.lastIndex = 0;

          return (
            <React.Fragment key={`text-${index}`}>
              {renderTextPart(part, `text-${index}`)}
            </React.Fragment>
          );
        })}
      </Text>
    );
  };

  // Prefer the username snapshot captured while the member relation existed. The stored messageContent is also used as a fallback for member events that already contain the historical username text.
  const getPersistedSystemUsername = (item: any, role: "actor" | "target") => {
    const persistedUsername =
      role === "actor"
        ? item?._persistedActorUsername
        : item?._persistedTargetUsername;

    if (persistedUsername) {
      return persistedUsername;
    }

    const storedText =
      typeof item?.messageContent === "string"
        ? item.messageContent.trim()
        : "";

    if (!storedText) {
      return null;
    }

    const event = item?.groupSystemEvent;
    let separator = "";

    if (event === "MEMBER_ADDED") {
      separator = " added ";
    } else if (event === "MEMBER_REMOVED") {
      separator = " removed ";
    } else if (event === "MEMBER_LEFT") {
      separator = " left";
    } else if (event === "GROUP_CREATED") {
      separator = " created this group";
    } else if (event === "GROUP_RENAMED") {
      separator = " renamed the group to ";
    } else if (event === "GROUP_AVATAR_UPDATED") {
      separator = " updated the group photo";
    } else if (event === "GROUP_AVATAR_REMOVED") {
      separator = " removed the group photo";
    } else if (event === "GROUP_DESCRIPTION_CHANGED") {
      separator = " updated the group description";
    }

    if (!separator) {
      return null;
    }

    const separatorIndex = storedText.indexOf(separator);

    if (separatorIndex < 0) {
      return null;
    }

    if (role === "actor") {
      const actorUsername = storedText.slice(0, separatorIndex).trim();
      return actorUsername || null;
    }

    if (event === "MEMBER_ADDED" || event === "MEMBER_REMOVED") {
      const targetUsername = storedText
        .slice(separatorIndex + separator.length)
        .trim();

      return targetUsername || null;
    }

    return null;
  };

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const previousMessage = messages[index - 1];

    const shouldShowDateSeparator =
      index === 0 ||
      !previousMessage ||
      !isSameCalendarDay(item.createdAt, previousMessage.createdAt);

    const dateSeparator = shouldShowDateSeparator ? (
      <View style={styles.dateSeparator}>
        <Text style={styles.dateSeparatorText}>
          {formatMessageDate(item.createdAt)}
        </Text>

        <View style={styles.dateSeparatorLine} />
      </View>
    ) : null;

    const linkPreviewUrl = ["TEXT", "LINK"].includes(
      String(item.contentType).toUpperCase(),
    )
      ? getLinkPreviewUrl(item.messageContent)
      : null;

    if (item.type === "SYSTEM") {
      let systemText = item.messageContent;

      switch (item.groupSystemEvent) {
        case "MEMBER_ADDED": {
          // Use the live relation first, then the persisted username snapshot.
          const actor =
            Number(item.actorId) === Number(currentUserId)
              ? "You"
              : item.sender?.profile?.username ||
                getPersistedSystemUsername(item, "actor") ||
                "Someone";

          const target =
            Number(item.targetUserId) === Number(currentUserId)
              ? "You"
              : item.targetUser?.profile?.username ||
                getPersistedSystemUsername(item, "target") ||
                "a member";

          systemText = `${actor} added ${target}`;
          break;
        }

        case "MEMBER_REMOVED": {
          // Preserve both usernames after the removed member relation disappears.
          const actor =
            Number(item.actorId) === Number(currentUserId)
              ? "You"
              : item.sender?.profile?.username ||
                getPersistedSystemUsername(item, "actor") ||
                "Someone";

          const target =
            Number(item.targetUserId) === Number(currentUserId)
              ? "You"
              : item.targetUser?.profile?.username ||
                getPersistedSystemUsername(item, "target") ||
                "a member";

          systemText = `${actor} removed ${target}`;
          break;
        }

        case "MEMBER_LEFT": {
          // Preserve the username after the member leaves the group.
          const actor =
            Number(item.actorId) === Number(currentUserId)
              ? "You"
              : item.sender?.profile?.username ||
                getPersistedSystemUsername(item, "actor") ||
                "Someone";

          systemText = `${actor} left`;

          break;
        }

        case "GROUP_CREATED": {
          // Preserve the creator username if the creator relation disappears later.
          const actor =
            Number(item.actorId) === Number(currentUserId)
              ? "You"
              : item.sender?.profile?.username ||
                getPersistedSystemUsername(item, "actor") ||
                "Someone";

          systemText = `${actor} created this group`;

          break;
        }

        case "GROUP_RENAMED": {
          // Preserve the actor username for historical rename events.
          const actor =
            Number(item.actorId) === Number(currentUserId)
              ? "You"
              : item.sender?.profile?.username ||
                getPersistedSystemUsername(item, "actor") ||
                "Someone";

          systemText = `${actor} renamed the group to "${item.messageContent}"`;

          break;
        }

        case "GROUP_AVATAR_UPDATED": {
          // Preserve the actor username for historical avatar events.
          const actor =
            Number(item.actorId) === Number(currentUserId)
              ? "You"
              : item.sender?.profile?.username ||
                getPersistedSystemUsername(item, "actor") ||
                "Someone";

          systemText = `${actor} updated the group photo`;

          break;
        }

        case "GROUP_AVATAR_REMOVED": {
          // Preserve the actor username for historical avatar events.
          const actor =
            Number(item.actorId) === Number(currentUserId)
              ? "You"
              : item.sender?.profile?.username ||
                getPersistedSystemUsername(item, "actor") ||
                "Someone";

          systemText = `${actor} removed the group photo`;

          break;
        }

        case "GROUP_DESCRIPTION_CHANGED": {
          // Preserve the actor username for historical description events.
          const actor =
            Number(item.actorId) === Number(currentUserId)
              ? "You"
              : item.sender?.profile?.username ||
                getPersistedSystemUsername(item, "actor") ||
                "Someone";

          systemText = `${actor} updated the group description`;
          break;
        }

        default:
          break;
      }

      return (
        <>
          {dateSeparator}

          <View style={styles.systemMessageWrapper}>
            <View style={styles.systemMessageBubble}>
              <Text style={styles.systemMessageText}>{systemText}</Text>
            </View>
          </View>
        </>
      );
    }

    const isMe = Number(item.senderId) === Number(currentUserId);
    const senderIsVisibleAdmin = isVisibleAdminMember(Number(item.senderId));
    const shouldShowAdminBadge =
      senderIsVisibleAdmin && (isMe ? isVisibleAdmin : true);

    const isForwarded =
      item.isForwarded === true ||
      item.isForwarded === 1 ||
      item.isForwarded === "true" ||
      item.isForwarded === "1";

    if (item.deletedForAll) {
      let deletedText = "🚫 This message was deleted.";

      const deletedByCurrentUser =
        Number(item.deletedById) === Number(currentUserId);

      const deletedByGroupCreator =
        Number(item.deletedById) === Number(group?.createdById);

      const deletedOwnMessage =
        Number(item.deletedById) === Number(item.senderId);

      if (deletedByCurrentUser) {
        if (isCreator && Number(item.senderId) !== Number(currentUserId)) {
          deletedText = "🚫 You deleted this message as the Group Creator.";
        } else {
          deletedText = "🚫 You deleted this message.";
        }
      } else if (deletedByGroupCreator && !deletedOwnMessage) {
        deletedText = `🚫 This message was deleted by Group Creator ${
          group?.createdBy?.profile?.username || "the Group Creator"
        }.`;
      }

      return (
        <>
          {dateSeparator}

          <View
            style={[
              styles.messageWrapper,
              isMe ? styles.myMessageWrapper : styles.theirMessageWrapper,
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => handleMessagePress(item)}
              onLongPress={() => handleMessageLongPress(item)}
              delayLongPress={300}
              style={[
                styles.deletedMessageBubble,
                isMe ? styles.myMessage : styles.theirMessage,
                isMessageSelected(item) && styles.selectedMessageBubble,
              ]}
            >
              <Text style={styles.deletedMessage}>{deletedText}</Text>

              {isMessageSelected(item) && (
                <View style={styles.selectedMessageIndicator}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </>
      );
    }

    const senderUsername = item.sender?.profile?.username || "User";

    const senderAvatar =
      item.sender?.profile?.avatarUrl || item.sender?.profile?.avatar || null;

    return (
      <>
        {dateSeparator}

        <Swipeable
          key={item.id}
          ref={
            swipeRefs.current[getMessageSelectionKey(item)] ??
            (swipeRefs.current[getMessageSelectionKey(item)] =
              React.createRef<SwipeableMethods>())
          }
          overshootLeft={false}
          overshootRight={false}
          friction={2}
          leftThreshold={40}
          enabled={canUseGroup && !isSelectionMode && !item?.deletedForAll}
          onSwipeableWillOpen={() => handleReplySwipe(item)}
          renderLeftActions={() => <View style={styles.swipeReplyAction} />}
        >
          <View
            style={[
              styles.messageWrapper,
              isMe ? styles.myMessageWrapper : styles.theirMessageWrapper,
            ]}
          >
            {!isMe && (
              <View style={styles.senderAvatar}>
                {senderAvatar ? (
                  <Image
                    source={{
                      uri: resolveMediaUrl(senderAvatar)!,
                    }}
                    style={styles.senderAvatarImage}
                  />
                ) : (
                  <Text style={styles.senderAvatarText}>
                    {getInitial(senderUsername)}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleMessagePress(item)}
              onLongPress={() => handleMessageLongPress(item)}
              delayLongPress={300}
              style={[
                styles.messageBubble,
                isMe ? styles.myMessage : styles.theirMessage,
                isForwarded && styles.forwardedMessageBubble,
                isMessageSelected(item) && styles.selectedMessageBubble,
              ]}
            >
              {isForwarded && (
                <View
                  style={[
                    styles.forwardedHeader,
                    isMe
                      ? styles.forwardedHeaderOutgoing
                      : styles.forwardedHeaderIncoming,
                  ]}
                >
                  <Ionicons
                    name="arrow-redo-outline"
                    size={15}
                    color={isMe ? "#4F46E5" : "#6366F1"}
                  />

                  <Text
                    style={[
                      styles.forwardedHeaderText,
                      isMe
                        ? styles.forwardedHeaderTextOutgoing
                        : styles.forwardedHeaderTextIncoming,
                    ]}
                  >
                    Forwarded
                  </Text>
                </View>
              )}

              {!isMe && (
                <View style={styles.senderNameRow}>
                  <Text style={styles.username}>{senderUsername}</Text>

                  {shouldShowAdminBadge && (
                    <Text style={styles.adminUsernameBadge}> • Admin</Text>
                  )}
                </View>
              )}

              {isMe && shouldShowAdminBadge && (
                <Text style={styles.myAdminLabel}>Admin</Text>
              )}

              {item.replyTo && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  disabled={!canUseGroup || isSelectionMode}
                  onPress={() =>
                    isSelectionMode
                      ? handleMessagePress(item)
                      : scrollToRepliedMessage(item.replyTo)
                  }
                  style={[
                    styles.replyBubble,
                    isMe ? styles.myReplyBubble : styles.theirReplyBubble,
                  ]}
                >
                  <Text style={styles.replySender}>
                    {item.replyTo.sender?.profile?.username || "User"}

                    {isVisibleAdminMember(Number(item.replyTo.senderId)) && (
                      <Text style={styles.adminUsernameBadge}> • Admin</Text>
                    )}
                  </Text>

                  <Text numberOfLines={2} style={styles.replyMessage}>
                    {item.replyTo.messageContent ||
                      (item.replyTo.contentType === "IMAGE"
                        ? "📷 Photo"
                        : item.replyTo.contentType === "VIDEO"
                          ? "🎥 Video"
                          : item.replyTo.contentType === "AUDIO"
                            ? "🎵 Audio"
                            : item.replyTo.contentType === "FILE"
                              ? "📄 Document"
                              : "")}
                  </Text>
                </TouchableOpacity>
              )}

              {["IMAGE", "VIDEO", "AUDIO", "FILE"].includes(
                String(item.contentType).toUpperCase(),
              ) && (
                <View style={styles.groupMediaContainer}>
                  <GroupMessageMedia
                    message={item as Message}
                    selectionMode={isSelectionMode}
                    onSelect={() => handleMessagePress(item)}
                  />
                </View>
              )}

              {(String(item.contentType).toUpperCase() === "TEXT" ||
                String(item.contentType).toUpperCase() === "LINK") &&
                item.messageContent && (
                  <View style={styles.compactMessageRow}>
                    <View style={styles.compactMessageContent}>
                      {renderMessageContent(item)}
                    </View>

                    {renderMessageMeta(item, isMe)}
                  </View>
                )}

              {/* LINK PREVIEW CHANGE: Keep the existing message text and render its preview below. */}
              {linkPreviewUrl && (
                <LinkPreview url={linkPreviewUrl} isMe={isMe} />
              )}

              {isMessageSelected(item) && (
                <View style={styles.selectedMessageIndicator}>
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Swipeable>
      </>
    );
  };

  const typingNames = Object.entries(typingUsers).map(([userId, username]) => {
    return isVisibleAdminMember(Number(userId))
      ? `${username} • Admin`
      : username;
  });

  const typingText =
    typingNames.length === 0
      ? null
      : typingNames.length === 1
        ? `${typingNames[0]} is typing...`
        : typingNames.length === 2
          ? `${typingNames[0]} and ${typingNames[1]} are typing...`
          : `${typingNames.length} people are typing...`;

  const handleViewProfile = () => {
    if (!selectedMention) {
      return;
    }

    mentionSheetRef.current?.close();

    router.push({
      pathname: "/profile/[userId]",
      params: {
        userId: String(selectedMention.user.id),
      },
    });
  };

  const handleCopyUsername = async () => {
    if (!selectedMention) {
      return;
    }

    await Clipboard.setStringAsync(`@${selectedMention.user.profile.username}`);

    mentionSheetRef.current?.close();

    showFeedback({
      type: "success",
      title: "Copied",
      message: "Username copied to your clipboard.",
      buttonText: "OK",
    });
  };

  const handleMessageUser = () => {
    if (!selectedMention) {
      return;
    }

    mentionSheetRef.current?.close();

    router.push({
      pathname: "/chats/[userId]",
      params: {
        userId: String(selectedMention.user.id),
        username: selectedMention.user.profile.username,
      },
    });
  };

  const groupMemberNames = useMemo(() => {
    return members
      .slice(0, 3)
      .map((member) => {
        const username = member.user.profile?.username || "User";

        return member.isAdminVisible ? `${username} • Admin` : username;
      })
      .join(", ");
  }, [members]);

  const groupAvatarUri = group?.avatarUrl
    ? resolveMediaUrl(group.avatarUrl)
    : null;

  const inviteAdminLabel = invitingAdmin
    ? "Sending..."
    : adminInvitationStatus === "PENDING"
      ? "Invitation Pending"
      : adminInvitationStatus === "ACCEPTED"
        ? "Admin Joined"
        : "Invite Admin";

  const inviteAdminDescription =
    adminInvitationStatus === "PENDING"
      ? "An invitation has been sent to the Zleenchat Admin."
      : adminInvitationStatus === "ACCEPTED"
        ? "A Zleenchat Admin has joined this group."
        : "Invite the Zleenchat Admin into this group for moderation and support.";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <View pointerEvents="none" style={styles.background}>
          <View style={styles.blobTopLeft} />
          <View style={styles.blobTopRight} />
          <View style={styles.blobMiddleRight} />
          <View style={styles.blobBottomLeft} />
          <View style={styles.blobBottomRight} />
        </View>

        {isSelectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity
              style={styles.selectionHeaderButton}
              activeOpacity={0.85}
              onPress={clearMessageSelection}
            >
              <Ionicons name="close" size={25} color="#111827" />
            </TouchableOpacity>

            <View style={styles.selectionHeaderCenter}>
              <Text style={styles.selectionCount}>
                {selectedMessageIds.size}
              </Text>

              <Text style={styles.selectionLabel}>
                {selectedMessageIds.size === 1
                  ? "message selected"
                  : "messages selected"}
              </Text>
            </View>

            <View style={styles.selectionHeaderActions}>
              <TouchableOpacity
                style={styles.selectionHeaderActionButton}
                activeOpacity={0.8}
                onPress={handleForwardMessage}
              >
                <Ionicons name="arrow-redo-outline" size={22} color="#7C5CFF" />
              </TouchableOpacity>

              {canCopySelectedMessages && (
                <TouchableOpacity
                  style={styles.selectionHeaderActionButton}
                  activeOpacity={0.8}
                  onPress={handleCopyMessage}
                >
                  <Ionicons name="copy-outline" size={21} color="#7C5CFF" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.selectionHeaderActionButton,
                  styles.selectionHeaderDeleteButton,
                ]}
                activeOpacity={0.8}
                onPress={handleDeleteMessage}
              >
                <Ionicons name="trash-outline" size={21} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.headerButton}
              activeOpacity={0.85}
              onPress={() => {
                if (isAdminConversation) {
                  router.replace({
                    pathname: "/admin/group/[groupId]",
                    params: {
                      groupId: String(groupId),
                    },
                  });

                  return;
                }

                router.back();
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerCenter}
              activeOpacity={0.9}
              onPress={() => {
                router.push({
                  pathname: "/groups/group-info",
                  params: {
                    groupId: String(groupId),
                    adminMode: isAdminConversation ? "true" : "false",
                    isLeft: isLeft ? "true" : "false",
                  },
                });
              }}
            >
              <View style={styles.headerAvatar}>
                {groupAvatarUri ? (
                  <Image
                    source={{
                      uri: groupAvatarUri,
                    }}
                    style={styles.headerAvatarImage}
                  />
                ) : (
                  <Ionicons name="people-outline" size={25} color="#4F46E5" />
                )}
              </View>

              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {group?.name || "Group"}
                </Text>

                <View style={styles.headerSubtitleRow}>
                  <Text style={styles.headerSubtitle} numberOfLines={1}>
                    {canUseGroup && typingText
                      ? typingText
                      : `${members.length} ${
                          members.length === 1 ? "member" : "members"
                        }`}
                  </Text>

                  {canUseGroup && !typingText && members.length > 0 && (
                    <View style={styles.onlineDot} />
                  )}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.headerButton} activeOpacity={0.85}>
              <Ionicons name="ellipsis-vertical" size={22} color="#111827" />
            </TouchableOpacity>
          </View>
        )}

        {isAdminConversation && (
          <View style={styles.adminConversationBanner}>
            <Text style={styles.adminConversationBannerTitle}>
              Admin Conversation
            </Text>

            <Text style={styles.adminConversationBannerSubtitle}>
              You are participating in this group as a System Admin.
            </Text>
          </View>
        )}

        {isLeft && (
          <View style={styles.leftGroupBanner}>
            <Ionicons name="eye-outline" size={18} color="#475569" />
            <Text style={styles.leftGroupBannerText}>
              You left this group. You can read its history, but you can’t send
              messages or change group details.
            </Text>
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          extraData={`${replyingTo?.id ?? ""}-${[...selectedMessageIds].join(
            ",",
          )}`}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0,
              });
            }, 150);
          }}
          ListHeaderComponent={
            <View>
              <View style={styles.groupSetupCard}>
                <View style={styles.groupAvatar}>
                  {groupAvatarUri ? (
                    <Image
                      source={{
                        uri: groupAvatarUri,
                      }}
                      style={styles.groupAvatarImage}
                    />
                  ) : (
                    <Ionicons name="people-outline" size={48} color="#5B55E8" />
                  )}
                </View>

                <Text style={styles.groupSetupTitle} numberOfLines={1}>
                  {group?.name || "Zleenchat Team"}
                </Text>

                <Text style={styles.groupSetupSubtitle}>
                  Group • {members.length}{" "}
                  {members.length === 1 ? "member" : "members"}
                </Text>

                <TouchableOpacity
                  disabled={!canUseGroup || !isCreator}
                  activeOpacity={0.8}
                  style={styles.descriptionButton}
                  onPress={() =>
                    router.push({
                      pathname: "/groups/edit-description",
                      params: {
                        groupId: String(groupId),
                      },
                    })
                  }
                >
                  <Text
                    style={[
                      styles.groupSetupDescription,
                      !group?.description &&
                        canUseGroup &&
                        isCreator &&
                        styles.addDescriptionText,
                    ]}
                    numberOfLines={2}
                  >
                    {group?.description
                      ? group.description
                      : canUseGroup && isCreator
                        ? "Add description..."
                        : "No group description"}
                  </Text>

                  {canUseGroup && isCreator && (
                    <Ionicons name="pencil-outline" size={17} color="#64748B" />
                  )}
                </TouchableOpacity>

                {canUseGroup && <View style={styles.groupCardDivider} />}

                {canUseGroup && (
                  <>
                    <TouchableOpacity
                      style={styles.groupActionRow}
                      activeOpacity={0.8}
                      onPress={handleAddMembers}
                    >
                      <View style={styles.groupActionIcon}>
                        <Ionicons
                          name="person-add-outline"
                          size={22}
                          color="#4F46E5"
                        />
                      </View>

                      <View style={styles.groupActionTextContainer}>
                        <Text style={styles.groupActionTitle}>Add Members</Text>

                        <Text style={styles.groupActionSubtitle}>
                          Invite people to join this group
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={21}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>

                    <View style={styles.groupCardDivider} />

                    <TouchableOpacity
                      activeOpacity={0.82}
                      disabled={
                        invitingAdmin ||
                        adminInvitationStatus === "PENDING" ||
                        adminInvitationStatus === "ACCEPTED"
                      }
                      onPress={handleInviteAdmin}
                      style={[
                        styles.inviteAdminButton,
                        (invitingAdmin ||
                          adminInvitationStatus === "PENDING" ||
                          adminInvitationStatus === "ACCEPTED") &&
                          styles.inviteAdminButtonDisabled,
                      ]}
                    >
                      <View style={styles.inviteAdminButtonIcon}>
                        <Ionicons
                          name={
                            adminInvitationStatus === "ACCEPTED"
                              ? "checkmark-circle-outline"
                              : "shield-checkmark-outline"
                          }
                          size={22}
                          color={
                            adminInvitationStatus === "ACCEPTED"
                              ? "#22C55E"
                              : "#4F46E5"
                          }
                        />
                      </View>

                      <View style={styles.inviteAdminButtonContent}>
                        <Text style={styles.inviteAdminButtonTitle}>
                          {inviteAdminLabel}
                        </Text>

                        <Text style={styles.inviteAdminButtonSubtitle}>
                          {inviteAdminDescription}
                        </Text>

                        {showInviteSuccess && (
                          <Text style={styles.invitationSuccessText}>
                            Invitation sent successfully
                          </Text>
                        )}
                      </View>

                      <Ionicons
                        name={
                          adminInvitationStatus === "ACCEPTED"
                            ? "checkmark-circle"
                            : "chevron-forward"
                        }
                        size={21}
                        color={
                          adminInvitationStatus === "ACCEPTED"
                            ? "#22C55E"
                            : "#4F46E5"
                        }
                      />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openPrivacySheet}
                style={styles.privacyCard}
              >
                <View style={styles.privacyCardIcon}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={22}
                    color="#4F46E5"
                  />
                </View>

                <View style={styles.privacyCardContent}>
                  <Text style={styles.privacyCardTitle}>
                    Your chats are private
                  </Text>

                  <Text style={styles.privacyCardDescription}>
                    Zleenchat uses encryption and other security measures to
                    help protect your messages and media.
                  </Text>

                  <View style={styles.privacyLearnMoreButton}>
                    <Text style={styles.privacyLearnMoreText}>Learn more</Text>

                    <Ionicons
                      name="chevron-forward"
                      size={15}
                      color="#4F46E5"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={<View style={styles.emptyMessageSpacer} />}
        />

        {!isSelectionMode && canUseGroup && (
          <>
            {typingText && (
              <View style={styles.typingIndicator}>
                <View style={styles.typingDot} />

                <Text style={styles.typingText}>{typingText}</Text>
              </View>
            )}

            {replyingTo && (
              <View style={styles.replyPreview}>
                <View style={styles.replyBar} />

                <View style={styles.replyPreviewContent}>
                  <Text style={styles.replyAuthor}>
                    {replyingTo.sender?.profile?.username || "User"}

                    {isVisibleAdminMember(Number(replyingTo.senderId)) && (
                      <Text style={styles.adminUsernameBadge}> • Admin</Text>
                    )}
                  </Text>

                  <Text numberOfLines={1} style={styles.replyText}>
                    {replyingTo.messageContent ||
                      (replyingTo.contentType === "IMAGE"
                        ? "📷 Photo"
                        : replyingTo.contentType === "VIDEO"
                          ? "🎥 Video"
                          : replyingTo.contentType === "AUDIO"
                            ? "🎵 Audio"
                            : replyingTo.contentType === "FILE"
                              ? "📄 Document"
                              : "")}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.replyCloseButton}
                  onPress={() => setReplyingTo(null)}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}

            {selectedAttachment && (
              <AttachmentPreview
                attachment={selectedAttachment}
                onRemove={() => setSelectedAttachment(null)}
              />
            )}

            {showMentionSuggestions && filteredMembers.length > 0 && (
              <View style={styles.mentionSuggestions}>
                <FlatList
                  keyboardShouldPersistTaps="handled"
                  data={filteredMembers}
                  keyExtractor={(item) => String(item.user.id)}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.mentionItem}
                      onPress={() => {
                        const newText = text.replace(
                          /(?:^|\s)@([^\s@]*)$/,
                          ` @${item.user.profile.username} `,
                        );

                        setText(newText);

                        setMentionQuery("");

                        setShowMentionSuggestions(false);
                      }}
                    >
                      <Text style={styles.mentionUsername}>
                        @{item.user.profile.username}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}

            <View
              style={[
                styles.inputContainer,
                {
                  paddingBottom: Math.max(insets.bottom, 10),
                },
              ]}
            >
              <AttachmentPicker onPress={openAttachmentSheet} />

              <TextInput
                value={editingGroupMessage ? draftMessage : text}
                onChangeText={(value) => {
                  if (editingGroupMessage) {
                    setDraftMessage(value);
                  } else {
                    handleTyping(value);
                  }
                }}
                placeholder="Type a message..."
                placeholderTextColor="#94A3B8"
                style={styles.input}
                multiline
                textAlignVertical="center"
              />

              <TouchableOpacity
                style={styles.sendBtn}
                activeOpacity={0.85}
                onPress={
                  editingGroupMessage
                    ? handleSaveEditedMessage
                    : handleSendGroupMessage
                }
              >
                <Ionicons name="send" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {!isSelectionMode && isLeft && (
          <View
            style={[
              styles.leftGroupFooter,
              { paddingBottom: Math.max(insets.bottom, 10) },
            ]}
          >
            <Text style={styles.leftGroupFooterText}>
              Read-only group history
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <BottomSheet
        ref={mentionSheetRef}
        index={-1}
        snapPoints={["30%"]}
        enablePanDownToClose
      >
        <BottomSheetView>
          <TouchableOpacity style={styles.menuItem} onPress={handleViewProfile}>
            <Text style={styles.menuText}>View Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleMessageUser}>
            <Text style={styles.menuText}>Message User</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={handleCopyUsername}
          >
            <Text style={styles.menuText}>Copy Username</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>

      <AttachmentBottomSheet
        ref={attachmentSheetRef}
        onPhoto={pickPhoto}
        onVideo={pickVideo}
        onAudio={pickAudio}
        onDocument={pickDocument}
      />

      <PrivacyBottomSheet
        ref={privacySheetRef}
        onLearnMore={() => {
          privacySheetRef.current?.close();
          setTimeout(() => {
            router.push("/privacy" as any);
          }, 200);
        }}
      />

      <MessageActionBottomSheet
        ref={messageActionSheetRef}
        isMe={Number(selectedMessage?.senderId) === Number(currentUser?.sub)}
        isGroupCreator={isCreator}
        isDeletedPlaceholder={!!selectedMessage?.deletedForAll}
        canCopy={canCopySelectedMessage}
        canEdit={canEditSelectedMessage}
        onCopy={handleCopyMessage}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onRemovePlaceholder={handleRemovePlaceholder}
        onSelectMessage={handleSelectMessage}
        onForwardMessage={handleForwardMessage}
      />

      <DeleteMessageBottomSheet
        ref={deleteMessageSheetRef}
        canDeleteForEveryone={
          isSelectionMode
            ? canDeleteSelectedMessagesForEveryone
            : selectedMessage &&
              (Number(selectedMessage.senderId) === Number(currentUserId) ||
                isCreator)
        }
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteMessageForEveryone}
      />

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        buttonText={feedbackButtonText}
        onClose={closeFeedback}
        secondaryButtonText={feedbackSecondaryButtonText}
        onSecondaryPress={feedbackOnSecondaryPress}
        loading={feedbackLoading}
      />

      <AppFeedbackModal
        visible={showInviteAdminConfirmation}
        type="warning"
        title="Invite Admin?"
        message="Do you want to invite the Zleenchat Admin into this group for moderation and support?"
        buttonText="No"
        onClose={() => {
          setShowInviteAdminConfirmation(false);
        }}
        secondaryButtonText="Yes, Invite Admin"
        onSecondaryPress={handleConfirmInviteAdmin}
        loading={invitingAdmin}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  keyboardContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },

  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },

  blobTopLeft: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "#E8EDFF",
    top: 120,
    left: -150,
    opacity: 0.9,
  },

  blobTopRight: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#F0E9FF",
    top: 210,
    right: -105,
    opacity: 0.9,
  },

  blobMiddleRight: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#EEF1FF",
    top: 520,
    right: -95,
    opacity: 0.85,
  },

  blobBottomLeft: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#EEF3FF",
    bottom: 40,
    left: -145,
    opacity: 0.9,
  },

  blobBottomRight: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#F2ECFF",
    bottom: -70,
    right: -100,
    opacity: 0.8,
  },

  selectionHeader: {
    height: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E7E4FF",
    zIndex: 20,
  },

  selectionHeaderButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E4FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  selectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  selectionHeaderActionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F5F2FF",
    borderWidth: 1,
    borderColor: "#E8E4FF",
    alignItems: "center",
    justifyContent: "center",
  },

  selectionHeaderDeleteButton: {
    backgroundColor: "#FFF5F5",
    borderColor: "#FFE1E4",
  },

  selectionHeaderCenter: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },

  selectionCount: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },

  selectionLabel: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 1,
  },

  selectedMessageBubble: {
    borderWidth: 2,
    borderColor: "#7C5CFF",
  },

  selectedMessageIndicator: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#7C5CFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },

  header: {
    height: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEF2FF",
    zIndex: 20,
  },

  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
  },

  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  headerAvatarImage: {
    width: "100%",
    height: "100%",
  },

  headerTextContainer: {
    flex: 1,
    marginLeft: 11,
  },

  headerTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "700",
  },

  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },

  headerSubtitle: {
    color: "#64748B",
    fontSize: 12,
    flexShrink: 1,
  },

  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22C55E",
    marginLeft: 6,
  },

  messageList: {
    flex: 1,
    backgroundColor: "transparent",
  },

  messageListContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
  },

  groupSetupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 26,
    paddingTop: 24,
    paddingBottom: 10,
    marginTop: 8,
    marginBottom: 24,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 5,
  },

  groupAvatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
    overflow: "hidden",
  },

  groupAvatarImage: {
    width: "100%",
    height: "100%",
  },

  groupSetupTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },

  groupSetupSubtitle: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
  },

  descriptionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 20,
    paddingHorizontal: 8,
  },

  groupSetupDescription: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginRight: 7,
  },

  addDescriptionText: {
    color: "#4F46E5",
    fontWeight: "600",
  },

  groupCardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E7EB",
    marginVertical: 2,
  },

  groupActionRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },

  groupActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
  },

  adminActionIcon: {
    backgroundColor: "#F0EEFF",
  },

  groupActionTextContainer: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
  },

  groupActionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },

  groupActionSubtitle: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },

  inviteAdminButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: "#F5F2FF",
    borderWidth: 1,
    borderColor: "#DCD6FF",
    flexDirection: "row",
    alignItems: "center",
  },

  inviteAdminButtonDisabled: {
    opacity: 0.65,
  },

  inviteAdminButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#ECE9FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  inviteAdminButtonContent: {
    flex: 1,
    justifyContent: "center",
  },

  inviteAdminButtonTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4F46E5",
    marginBottom: 3,
  },

  inviteAdminButtonSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#64748B",
  },

  invitationSuccessText: {
    marginTop: 4,
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "600",
  },

  emptyMessageSpacer: {
    height: 10,
  },

  systemMessageWrapper: {
    alignItems: "center",
    marginVertical: 10,
  },

  systemMessageBubble: {
    backgroundColor: "#F1F5F9",
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 7,
  },

  systemMessageText: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
  },

  messageWrapper: {
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
  },

  myMessageWrapper: {
    justifyContent: "flex-end",
  },

  theirMessageWrapper: {
    justifyContent: "flex-start",
  },

  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8EDFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    marginBottom: 3,
    overflow: "hidden",
  },

  senderAvatarImage: {
    width: "100%",
    height: "100%",
  },

  senderAvatarText: {
    color: "#4F46E5",
    fontSize: 13,
    fontWeight: "700",
  },

  messageBubble: {
    alignSelf: "flex-start",
    maxWidth: "82%",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },

  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#EAF2FF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 7,
  },

  theirMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 20,
    shadowColor: "#18181B",
    shadowOpacity: 0.035,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },

  forwardedMessageBubble: {
    borderWidth: 1,
    borderColor: "#DDE3FF",
  },

  forwardedHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
    minHeight: 18,
  },

  forwardedHeaderOutgoing: {
    justifyContent: "flex-start",
  },

  forwardedHeaderIncoming: {
    justifyContent: "flex-start",
  },

  forwardedHeaderText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.1,
  },

  forwardedHeaderTextOutgoing: {
    color: "#4F46E5",
  },

  forwardedHeaderTextIncoming: {
    color: "#6366F1",
  },

  senderNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },

  username: {
    fontSize: 12,
    color: "#4F46E5",
    fontWeight: "700",
  },

  myAdminLabel: {
    fontSize: 11,
    color: "#4F46E5",
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "right",
  },

  adminUsernameBadge: {
    color: "#6366F1",
    fontWeight: "700",
  },

  messageText: {
    fontSize: 15,
    lineHeight: 19,
    color: "#18181B",
    fontWeight: "400",
    includeFontPadding: false,
  },

  messageImage: {
    width: 245,
    height: 285,
    borderRadius: 16,
    marginBottom: 5,
    backgroundColor: "#E5E7EB",
  },

  groupMediaContainer: {
    width: "100%",
    marginBottom: 5,
    overflow: "hidden",
  },

  fileMessage: {
    minWidth: 190,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },

  fileIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  fileTextContainer: {
    flex: 1,
  },

  fileMessageTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },

  fileMessageName: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 3,
  },

  replyBubble: {
    borderLeftWidth: 3,
    borderLeftColor: "#6366F1",
    paddingLeft: 9,
    paddingVertical: 6,
    marginBottom: 7,
    borderRadius: 8,
  },

  myReplyBubble: {
    backgroundColor: "#D9E4FF",
  },

  theirReplyBubble: {
    backgroundColor: "#F1F5F9",
  },

  replySender: {
    fontWeight: "700",
    fontSize: 11,
    color: "#4F46E5",
  },

  replyMessage: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 12,
  },

  compactMessageRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "flex-end",
    maxWidth: "100%",
  },

  compactMessageContent: {
    flexShrink: 1,
    minWidth: 0,
  },

  compactLinkTouchable: {
    flexShrink: 1,
    minWidth: 0,
  },

  compactMetaRow: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 5,
    paddingBottom: 0,
  },

  edited: {
    fontSize: 10,
    color: "#94A3B8",
    fontStyle: "italic",
    marginRight: 5,
  },

  time: {
    fontSize: 10,
    color: "#94A3B8",
    marginRight: 4,
  },

  statusIcon: {
    marginLeft: 1,
  },

  deletedMessage: {
    fontSize: 12,
    color: "#64748B",
    fontStyle: "italic",
    lineHeight: 20,
  },

  deletedMessageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
    opacity: 0.82,
  },

  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
  },

  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4F46E5",
    marginRight: 7,
  },

  typingText: {
    color: "#6366F1",
    fontSize: 12,
    fontWeight: "600",
  },

  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },

  replyBar: {
    width: 4,
    height: 38,
    backgroundColor: "#6366F1",
    borderRadius: 2,
    marginRight: 10,
  },

  replyPreviewContent: {
    flex: 1,
  },

  replyAuthor: {
    fontWeight: "700",
    color: "#4F46E5",
    fontSize: 12,
  },

  replyText: {
    color: "#64748B",
    marginTop: 2,
    fontSize: 12,
  },

  replyCloseButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  mentionSuggestions: {
    maxHeight: 220,
    backgroundColor: "#FFFFFF",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },

  mentionItem: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  mentionUsername: {
    fontSize: 15,
    color: "#4F46E5",
    fontWeight: "600",
  },

  mentionText: {
    color: "#4F46E5",
    fontWeight: "700",
  },

  myMentionText: {
    backgroundColor: "#EEF0FF",
    borderRadius: 4,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#EEF2FF",
  },

  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: "#F8FAFC",
    borderRadius: 25,
    paddingHorizontal: 17,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 4,
  },

  swipeReplyAction: {
    width: 1,
  },

  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 18,
  },

  menuText: {
    fontSize: 16,
    color: "#111827",
  },

  adminConversationBanner: {
    backgroundColor: "#EEF2FF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DDE3FF",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  adminConversationBannerTitle: {
    color: "#4F46E5",
    fontSize: 14,
    fontWeight: "700",
  },

  adminConversationBannerSubtitle: {
    color: "#6366F1",
    fontSize: 12,
    marginTop: 2,
  },

  leftGroupBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  leftGroupBannerText: {
    flex: 1,
    marginLeft: 8,
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
  },

  leftGroupFooter: {
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingTop: 12,
    paddingHorizontal: 16,
  },

  leftGroupFooterText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },

  dateSeparator: {
    marginTop: 14,
    marginBottom: 14,
    alignItems: "center",
  },

  dateSeparatorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#69708A",
    marginBottom: 8,
  },

  dateSeparatorLine: {
    width: "100%",
    height: 1,
    backgroundColor: "#E5E7EB",
  },

  linkText: {
    fontSize: 15,
    lineHeight: 19,
    color: "#2563EB",
    textDecorationLine: "underline",
    fontWeight: "500",
    includeFontPadding: false,
  },

  // LINK PREVIEW CHANGE: Styles matching the ChatScreen preview card.
  linkPreview: {
    width: "86%",
    maxWidth: 420,
    marginTop: 8,
    marginHorizontal: 12,
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9DEE8",
    backgroundColor: "#FFFFFF",
  },

  linkPreviewOutgoing: {
    alignSelf: "flex-end",
  },

  linkPreviewImage: {
    width: "100%",
    height: 150,
    backgroundColor: "#EEF2F7",
  },

  linkPreviewBody: {
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  linkPreviewTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    color: "#172033",
  },

  linkPreviewDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: "#667085",
  },

  linkPreviewDomain: {
    marginTop: 6,
    fontSize: 11,
    lineHeight: 15,
    color: "#667085",
    fontWeight: "600",
  },

  linkPreviewLoading: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  linkPreviewLoadingText: {
    fontSize: 12,
    color: "#667085",
  },

  // STEP 2 — Privacy information card styles
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 2,
    marginTop: 0,
    marginBottom: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 20,
    backgroundColor: "#F8F9FF",
    borderWidth: 1,
    borderColor: "#E4E7FF",
  },

  privacyCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF0FF",
    marginRight: 12,
  },

  privacyCardContent: {
    flex: 1,
    minWidth: 0,
  },

  privacyCardTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },

  privacyCardDescription: {
    marginTop: 5,
    color: "#64748B",
    fontSize: 13,
    lineHeight: 19,
  },

  privacyLearnMoreButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 9,
    paddingVertical: 2,
  },

  privacyLearnMoreText: {
    color: "#4F46E5",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
    marginRight: 3,
  },
});
