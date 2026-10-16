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
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { FlashList } from "@shopify/flash-list";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import uuid from "react-native-uuid";

import {
  getConversationMessages,
  sendMessage,
  editDirectMessage,
  searchConversationMessages,
  deleteDirectMessagesForMe,
  deleteDirectMessagesForEveryone,
} from "@/src/services/chat/chatService";

import { Message } from "@/src/types/chat.types";
import { useAuthStore } from "@/src/store/auth/authStorage";
import { useSocket } from "@/hooks/useSocket";
import { useTypingStore } from "@/src/store/chat/typingStore";
import { useUploadQueueStore } from "@/src/store/chat/uploadQueueStore";
import { useNetworkStore } from "@/src/store/network/networkStore";

import MessageBubble from "@/components/chat/MessageBubble";
import AttachmentPreview from "@/components/chat/AttachmentPreview";

import {
  getOtherUserProfileById,
  getUserDetails,
  UserDetails,
} from "@/src/services/profile/profileService";

import { API_BASE_URL } from "@/src/services/api/apiClient";

import AttachmentBottomSheet from "@/components/chat/AttachmentBottomSheet";
import MessageActionBottomSheet from "@/components/chat/MessageActionBottomSheet";
import DeleteMessageBottomSheet from "@/components/chat/DeleteMessageBottomSheet";

import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useDraftStore, getDirectDraftKey } from "@/src/store/chat/draftStore";
import BottomSheet from "@gorhom/bottom-sheet";
import PrivacyBottomSheet from "@/components/chat/PrivacyBottomSheet";

import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

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

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

// Message edit timeframe
const MESSAGE_EDIT_WINDOW_MS = 10 * 60 * 1000;

const normalizeForwardedLinkMessage = (message: Message): Message => {
  if (!message) {
    return message;
  }

  const isForwarded = message.isForwarded === true;
  const content =
    typeof message.messageContent === "string"
      ? message.messageContent.trim()
      : "";

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
};

const hydrateReplyReferences = (items: Message[]): Message[] => {
  const messageById = new Map<number, Message>();

  items.forEach((message) => {
    const id = Number(message?.id);

    if (Number.isInteger(id) && id > 0) {
      messageById.set(id, message);
    }
  });

  return items.map((message) => {
    const replyId = Number(message?.replyToId);

    if (!Number.isInteger(replyId) || replyId <= 0) {
      return message;
    }

    const resolvedReply = messageById.get(replyId);

    if (!resolvedReply) {
      return message;
    }

    return {
      ...message,
      replyTo: message.replyTo
        ? {
            ...resolvedReply,
            ...message.replyTo,
          }
        : resolvedReply,
    };
  });
};

const mergePersistedMessage = (
  existing: Message | undefined,
  incoming: Message,
  availableMessages: Message[],
): Message => {
  const replyId =
    incoming?.replyToId != null
      ? Number(incoming.replyToId)
      : existing?.replyToId != null
        ? Number(existing.replyToId)
        : null;

  const replyTarget =
    (replyId && availableMessages.find((msg) => Number(msg.id) === replyId)) ||
    existing?.replyTo ||
    incoming?.replyTo ||
    undefined;

  return {
    ...(existing || {}),
    ...incoming,
    replyToId: replyId,
    replyTo: replyTarget,
  };
};

export default function ChatScreen() {
  const { userId, username, avatarUrl } = useLocalSearchParams();

  const parsedUserId = Number(userId);

  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = Number(currentUser?.sub);

  const directDraftKey =
    Number.isInteger(currentUserId) &&
    Number.isInteger(parsedUserId) &&
    parsedUserId > 0
      ? getDirectDraftKey(currentUserId, parsedUserId)
      : null;

  const persistedDraft = useDraftStore((state) =>
    directDraftKey ? (state.drafts[directDraftKey] ?? "") : "",
  );

  const setDraft = useDraftStore((state) => state.setDraft);
  const clearDraft = useDraftStore((state) => state.clearDraft);

  const { socketRef, connected } = useSocket();

  const params = useLocalSearchParams();

  const flatListRef = useRef<any>(null);

  const pendingDeliveredMessageIdsRef = useRef<Set<number>>(new Set());

  const attachmentSheetRef = useRef<BottomSheet>(null);
  const messageActionSheetRef = useRef<BottomSheet>(null);
  const deleteMessageSheetRef = useRef<BottomSheet>(null);
  const privacySheetRef = useRef<BottomSheet>(null);

  const swipeRefs = useRef<
    Record<string, React.RefObject<SwipeableMethods | null>>
  >({});

  const isNearBottomRef = useRef(true);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTyping = useTypingStore((state) => state.setTyping);

  const {
    queuedMessages,
    addQueuedMessage,
    updateQueuedMessage,
    removeQueuedMessage,
  } = useUploadQueueStore();

  const routeUsername =
    typeof params.username === "string" ? params.username : undefined;

  const routeAvatarUrl =
    typeof params.avatarUrl === "string" ? params.avatarUrl : undefined;

  const [chatUser, setChatUser] = useState({
    id: parsedUserId,
    profile: {
      username: routeUsername,
      avatarUrl: routeAvatarUrl,
    },
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [selectedAttachment, setSelectedAttachment] = useState<any | null>(
    null,
  );

  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(
    new Set(),
  );

  const [chatUserPresence, setChatUserPresence] = useState<{
    online: boolean;
    lastSeen: string | null;
  }>({
    online: false,
    lastSeen: null,
  });

  const [blockStatus, setBlockStatus] = useState<UserDetails["blockStatus"]>({
    iBlockedThem: false,
    theyBlockedMe: false,
  });

  /*
   * ============================================================
   * APP FEEDBACK
   * ============================================================
   */

  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");

  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const showFeedback = useCallback(
    (type: FeedbackType, title: string, message: string) => {
      setFeedbackType(type);
      setFeedbackTitle(title);
      setFeedbackMessage(message);
      setFeedbackVisible(true);
    },
    [],
  );

  const closeFeedback = useCallback(() => {
    setFeedbackVisible(false);
  }, []);

  const refreshBlockStatus = useCallback(async () => {
    if (!parsedUserId) {
      return;
    }

    try {
      const profile = await getUserDetails(parsedUserId);

      if (profile.blockStatus) {
        setBlockStatus(profile.blockStatus);
      }
    } catch (error) {
      console.log("Refresh block status error:", error);
    }
  }, [parsedUserId]);

  const refreshChatUserPresence = useCallback(async () => {
    if (!parsedUserId) {
      return;
    }

    try {
      const userDetails = await getUserDetails(parsedUserId);

      setChatUserPresence({
        online: Boolean(userDetails.online),
        lastSeen: userDetails.lastSeen ?? null,
      });
    } catch (error) {
      console.log("Chat user presence fetch error:", error);
    }
  }, [parsedUserId]);

  useFocusEffect(
    useCallback(() => {
      refreshBlockStatus();
      refreshChatUserPresence();
    }, [refreshBlockStatus, refreshChatUserPresence]),
  );

  useEffect(() => {
    if (!parsedUserId) {
      return;
    }

    refreshChatUserPresence();

    const interval = setInterval(() => {
      refreshChatUserPresence();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [parsedUserId, refreshChatUserPresence]);

  useEffect(() => {
    if (!directDraftKey) {
      return;
    }

    setInput((currentValue) =>
      currentValue === persistedDraft ? currentValue : persistedDraft,
    );
  }, [directDraftKey, persistedDraft]);

  const isOnline = useNetworkStore((state) => state.isOnline);

  const [nextCursor, setNextCursor] = useState<number | null>(null);

  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [isSearchMode, setIsSearchMode] = useState(params.search === "true");

  const [searchQuery, setSearchQuery] = useState("");

  const [showDatePicker, setShowDatePicker] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [searchMatchIds, setSearchMatchIds] = useState<number[]>([]);

  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  const queuedCount = queuedMessages.filter(
    (msg) => msg.receiverId === parsedUserId,
  ).length;

  const avatarUri = chatUser?.profile?.avatarUrl
    ? `${API_BASE_URL}${chatUser.profile.avatarUrl}`
    : null;

  const messagingBlocked =
    blockStatus.iBlockedThem || blockStatus.theyBlockedMe;

  // ================= RESTRUCTURED =================
  // Search state is completely cleared when leaving search mode.
  const handleExitSearch = () => {
    setIsSearchMode(false);
    setSearchQuery("");
    setSearchMatchIds([]);
    setActiveSearchIndex(0);
    setHasSearched(false);
  };

  useEffect(() => {
    if (messagingBlocked) {
      handleExitSearch();
    }
  }, [messagingBlocked]);

  const insets = useSafeAreaInsets();

  const formatLastSeen = (date: string | null) => {
    if (!date) {
      return "Offline";
    }

    return new Date(date).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  useEffect(() => {
    console.log("ChatScreen socket:", socketRef.current?.id);
  }, [connected]);

  // ================= PROFILE =================

  useEffect(() => {
    if (!parsedUserId) return;

    if (routeUsername && routeAvatarUrl !== undefined) {
      return;
    }

    const fetchChatUser = async () => {
      try {
        const profile = await getOtherUserProfileById(parsedUserId);

        setChatUser((prev) => ({
          ...prev,
          profile: {
            username: profile.username,
            avatarUrl: profile.avatarUrl ?? undefined,
          },
        }));
      } catch (error) {
        console.log("Chat header profile fetch error:", error);
      }
    };

    fetchChatUser();
  }, [parsedUserId]);

  // Initial Messages

  useEffect(() => {
    if (!parsedUserId) return;

    const fetchMessages = async () => {
      try {
        const data = await getConversationMessages(parsedUserId);

        if (data.blockStatus) {
          setBlockStatus(data.blockStatus);
        }

        setMessages(
          hydrateReplyReferences(
            data.messages.map(normalizeForwardedLinkMessage),
          ),
        );

        setTimeout(() => {
          flatListRef.current?.scrollToEnd({
            animated: false,
          });
        }, 100);

        setNextCursor(data.nextCursor);
        setHasMoreMessages(data.hasMoreMessagesToLoad);

        socketRef.current?.emit("markAsRead", {
          senderId: parsedUserId,
        });
      } catch (error) {
        // console.log("Fetch messages error:", error);
      }
    };

    fetchMessages();
  }, [parsedUserId]);

  // ================= LOAD OLDER PAGINATED MESSAGES =================

  const loadOlderMessages = async () => {
    if (!nextCursor || loadingMore || !hasMoreMessages) {
      return;
    }

    try {
      setLoadingMore(true);

      const data = await getConversationMessages(
        parsedUserId,
        nextCursor,
        selectedDate ?? undefined,
      );

      setMessages((prev) => {
        const existingIds = new Set(
          prev
            .filter((message) => message.id != null)
            .map((message) => Number(message.id)),
        );

        const olderMessages = data.messages
          .map(normalizeForwardedLinkMessage)
          .filter((message) => {
            if (message.id == null) {
              return true;
            }

            return !existingIds.has(Number(message.id));
          });

        return hydrateReplyReferences([...olderMessages, ...prev]);
      });

      setNextCursor(data.nextCursor);
      setHasMoreMessages(data.hasMoreMessagesToLoad);
    } catch (error) {
      console.log("Pagination error:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  // ================= QUEUED MESSAGES =================

  useEffect(() => {
    if (!queuedMessages.length) return;

    setMessages((prev) => {
      const merged = [...prev];

      queuedMessages.forEach((queuedMsg) => {
        const exists = merged.some(
          (msg) => msg.clientId === queuedMsg.clientId,
        );

        if (!exists) {
          merged.push(queuedMsg);
        }
      });

      return merged;
    });
  }, [queuedMessages]);

  // ================= RETRY PENDING =================

  useEffect(() => {
    if (!isOnline) return;
  }, [isOnline]);

  const handleCalendarPress = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = async (event: any, pickedDate?: Date) => {
    setShowDatePicker(false);

    if (event.type === "dismissed" || !pickedDate) {
      return;
    }

    const year = pickedDate.getFullYear();
    const month = String(pickedDate.getMonth() + 1).padStart(2, "0");

    const day = String(pickedDate.getDate()).padStart(2, "0");

    const date = `${year}-${month}-${day}`;

    try {
      console.log("📅 Selected date:", date);

      const data = await getConversationMessages(parsedUserId, undefined, date);

      console.log("📅 DATE FILTER RESULT:", {
        date,
        messageCount: data.messages.length,
        messageIds: data.messages.map((message) => message.id),
      });

      setSelectedDate(date);

      setMessages(
        hydrateReplyReferences(
          data.messages.map(normalizeForwardedLinkMessage),
        ),
      );

      setNextCursor(data.nextCursor);

      setHasMoreMessages(data.hasMoreMessagesToLoad);

      if (data.blockStatus) {
        setBlockStatus(data.blockStatus);
      }

      setSearchMatchIds([]);
      setActiveSearchIndex(0);
      setHasSearched(false);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: false,
        });
      }, 100);
    } catch (error) {
      console.log("Date-filtered messages error:", error);
    }
  };

  const handleClearDateFilter = async () => {
    try {
      console.log("📅 Returning to normal conversation");

      setSelectedDate(null);
      setMessages([]);
      setNextCursor(null);
      setHasMoreMessages(true);

      const data = await getConversationMessages(parsedUserId);

      if (data.blockStatus) {
        setBlockStatus(data.blockStatus);
      }

      setMessages(
        hydrateReplyReferences(
          data.messages.map(normalizeForwardedLinkMessage),
        ),
      );

      setNextCursor(data.nextCursor);
      setHasMoreMessages(data.hasMoreMessagesToLoad);
      setSearchMatchIds([]);
      setActiveSearchIndex(0);
      setHasSearched(false);

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({
          animated: false,
        });
      }, 100);
    } catch (error) {
      console.log("Return to normal conversation error:", error);
    }
  };

  // ================= LINK PREVIEW =================
  // LINK PREVIEW CHANGE: Added only for webpage link previews.
  // Existing message/link behavior remains unchanged.

  type LinkPreviewData = {
    title: string;
    description: string;
    imageUrl: string | null;
    siteName: string;
    url: string;
  };

  const linkPreviewCache = new Map<string, LinkPreviewData | null>();

  const linkPreviewRequests = new Map<
    string,
    Promise<LinkPreviewData | null>
  >();

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
      new RegExp(`${attribute}\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']`, "i"),
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

        if (content) {
          return content;
        }
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
    if (!imageUrl) {
      return null;
    }

    try {
      return new URL(imageUrl, pageUrl).toString();
    } catch {
      return imageUrl;
    }
  };

  const normalizePreviewUrl = (value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      return "";
    }

    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };

  const fetchLinkPreview = async (rawUrl: string) => {
    const url = normalizePreviewUrl(rawUrl);

    if (!url) {
      return null;
    }

    if (linkPreviewCache.has(url)) {
      return linkPreviewCache.get(url) ?? null;
    }

    const existingRequest = linkPreviewRequests.get(url);

    if (existingRequest) {
      return existingRequest;
    }

    const request = (async () => {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
          },
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
        if (!mounted) {
          return;
        }

        setPreview(result);
        setLoading(false);
      });

      return () => {
        mounted = false;
      };
    }, [normalizedUrl]);

    if (!preview && !loading) {
      return null;
    }

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
                source={{
                  uri: preview.imageUrl,
                }}
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

  // ================= TRACK USER SCROLL POSITION =================

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;

    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;

    isNearBottomRef.current = distanceFromBottom < 300;
  };

  // ================= NEW MESSAGE =================

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      const normalizedMessage = normalizeForwardedLinkMessage(message);

      setMessages((prev) => {
        const optimisticIndex = prev.findIndex(
          (msg) =>
            msg.clientId &&
            normalizedMessage.clientId &&
            msg.clientId === normalizedMessage.clientId,
        );

        if (optimisticIndex !== -1) {
          const updated = [...prev];

          const optimisticMessage = prev[optimisticIndex];

          const persistedMessageId = Number(normalizedMessage?.id);

          const wasDeliveredBeforePersistence =
            Number.isInteger(persistedMessageId) &&
            pendingDeliveredMessageIdsRef.current.has(persistedMessageId);

          if (wasDeliveredBeforePersistence) {
            pendingDeliveredMessageIdsRef.current.delete(persistedMessageId);
          }

          updated[optimisticIndex] = {
            ...mergePersistedMessage(
              optimisticMessage,
              normalizedMessage,
              prev,
            ),
            localId: optimisticMessage.localId,
            clientId: normalizedMessage.clientId || optimisticMessage.clientId,
            uploadStatus: "SENT",
            uploadProgress: 100,
            status: wasDeliveredBeforePersistence
              ? "DELIVERED"
              : (normalizedMessage.status ??
                optimisticMessage.status ??
                "SENT"),
          };

          return hydrateReplyReferences(updated);
        }

        const existingIndex = prev.findIndex(
          (msg) =>
            Number(msg.id) === Number(normalizedMessage.id) ||
            (!!msg.clientId &&
              !!normalizedMessage.clientId &&
              msg.clientId === normalizedMessage.clientId),
        );

        if (existingIndex !== -1) {
          const updated = [...prev];

          const existingMessage = prev[existingIndex];

          const persistedMessageId = Number(normalizedMessage?.id);

          const wasDeliveredBeforePersistence =
            Number.isInteger(persistedMessageId) &&
            pendingDeliveredMessageIdsRef.current.has(persistedMessageId);

          if (wasDeliveredBeforePersistence) {
            pendingDeliveredMessageIdsRef.current.delete(persistedMessageId);
          }

          updated[existingIndex] = {
            ...mergePersistedMessage(existingMessage, normalizedMessage, prev),
            status: wasDeliveredBeforePersistence
              ? "DELIVERED"
              : (normalizedMessage.status ?? existingMessage.status ?? "SENT"),
          };

          return hydrateReplyReferences(updated);
        }

        return hydrateReplyReferences([...prev, message]);
      });

      const isIncomingMessage =
        Number(normalizedMessage.senderId) === Number(parsedUserId) &&
        Number(normalizedMessage.receiverId) === Number(currentUserId);

      if (isIncomingMessage) {
        socket.emit("markAsRead", {
          senderId: parsedUserId,
        });
      }

      if (normalizedMessage.clientId) {
        removeQueuedMessage(normalizedMessage.clientId);
      }

      requestAnimationFrame(() => {
        if (isNearBottomRef.current) {
          flatListRef.current?.scrollToEnd({
            animated: true,
          });
        }
      });
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socketRef, connected, parsedUserId]);

  // ================= TYPING =================

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const handleTypingStart = ({ fromUserId }: { fromUserId: number }) => {
      if (fromUserId === parsedUserId) {
        setIsTyping(true);
      }

      setTyping(fromUserId, true);
    };

    const handleTypingStop = ({ fromUserId }: { fromUserId: number }) => {
      if (fromUserId === parsedUserId) {
        setIsTyping(false);
      }

      setTyping(fromUserId, false);
    };

    socket.on("typing:start", handleTypingStart);

    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("typing:start", handleTypingStart);

      socket.off("typing:stop", handleTypingStop);
    };
  }, [parsedUserId, connected, socketRef]);

  // ================= DELIVERED =================

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const handleDelivered = ({ messageId }: { messageId: number | string }) => {
      const deliveredId = Number(messageId);

      if (!Number.isInteger(deliveredId) || deliveredId <= 0) {
        console.log("Invalid message:delivered messageId:", messageId);

        return;
      }

      console.log("message:delivered received:", deliveredId);

      setMessages((prev) => {
        const messageExists = prev.some(
          (message) => Number(message.id) === deliveredId,
        );

        if (!messageExists) {
          pendingDeliveredMessageIdsRef.current.add(deliveredId);

          return prev;
        }

        return prev.map((message) =>
          Number(message.id) === deliveredId
            ? {
                ...message,
                status: "DELIVERED",
              }
            : message,
        );
      });
    };

    socket.on("message:delivered", handleDelivered);

    return () => {
      socket.off("message:delivered", handleDelivered);
    };
  }, [parsedUserId, connected, socketRef]);

  // ================= READ =================

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const handleRead = ({ readerId }: { readerId: number | string }) => {
      const readByUserId = Number(readerId);

      if (
        !Number.isInteger(readByUserId) ||
        readByUserId !== Number(parsedUserId)
      ) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) => {
          if (Number(message.senderId) !== Number(currentUserId)) {
            return message;
          }

          return {
            ...message,
            status: "READ",
          };
        }),
      );
    };

    socket.on("messagesRead", handleRead);

    return () => {
      socket.off("messagesRead", handleRead);
    };
  }, [parsedUserId, connected, socketRef]);

  // ============================================================
  // RESTRUCTURED: DIRECT MESSAGE EDIT SOCKET EVENT
  // ============================================================

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const handleMessageEdited = (updatedMessage: Message) => {
      if (!updatedMessage?.id) {
        return;
      }

      setMessages((prev) =>
        hydrateReplyReferences(
          prev.map((message) =>
            Number(message.id) === Number(updatedMessage.id)
              ? {
                  ...message,
                  ...normalizeForwardedLinkMessage(updatedMessage),
                  replyTo: message.replyTo || updatedMessage.replyTo,
                }
              : message,
          ),
        ),
      );

      setEditingMessage((current) =>
        current && Number(current.id) === Number(updatedMessage.id)
          ? null
          : current,
      );

      setEditDraft((current) =>
        editingMessage &&
        Number(editingMessage.id) === Number(updatedMessage.id)
          ? ""
          : current,
      );
    };

    socket.on("messageEdited", handleMessageEdited);

    return () => {
      socket.off("messageEdited", handleMessageEdited);
    };
  }, [connected, socketRef, editingMessage]);

  // ================= DIRECT MESSAGE DELETION =================

  useEffect(() => {
    if (!connected) return;

    const socket = socketRef.current;

    if (!socket) return;

    const handleDeletedForMe = ({
      messageIds,
      userId,
    }: {
      messageIds: number[];
      userId: number;
    }) => {
      if (Number(userId) !== Number(currentUser?.sub)) {
        return;
      }

      const deletedIds = new Set(messageIds.map(Number));

      setMessages((prev) =>
        prev.filter((message) => !deletedIds.has(Number(message.id))),
      );

      handleExitSearch();
    };

    const handleDeletedForEveryone = ({
      messageIds,
      deletedById,
    }: {
      messageIds: number[];
      deletedById: number;
    }) => {
      const deletedIds = new Set(messageIds.map(Number));

      setMessages((prev) =>
        prev.map((message) => {
          if (!deletedIds.has(Number(message.id))) {
            return message;
          }

          return {
            ...message,
            deletedForAll: true,
            deletedAt: message.deletedAt ?? new Date().toISOString(),
            deletedById,
            messageContent: "",
            mediaUrl: null,
            fileName: null,
            mimeType: null,
            fileSize: null,
            encryptedMediaKey: null,
            mediaIV: null,
            mediaAuthTag: null,
            encryptedThumbnailKey: null,
            thumbnailUrl: null,
            thumbnailIV: null,
            thumbnailAuthTag: null,
            duration: null,
            waveform: null,
            videoWidth: null,
            videoHeight: null,
            replyToId: null,
            replyTo: undefined,
          };
        }),
      );

      handleExitSearch();
    };

    socket.on("directMessagesDeletedForMe", handleDeletedForMe);

    socket.on("directMessagesDeletedForEveryone", handleDeletedForEveryone);

    return () => {
      socket.off("directMessagesDeletedForMe", handleDeletedForMe);

      socket.off("directMessagesDeletedForEveryone", handleDeletedForEveryone);
    };
  }, [connected, socketRef, currentUser?.sub]);

  // ================= HANDLE TYPING =================

  const handleTyping = (text: string) => {
    setInput(text);

    if (directDraftKey) {
      setDraft(directDraftKey, text);
    }

    if (!socketRef.current) return;

    if (!typingTimeout.current) {
      socketRef.current.emit("typing:start", {
        toUserId: parsedUserId,
      });
    }

    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }

    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit("typing:stop", {
        toUserId: parsedUserId,
      });

      typingTimeout.current = null;
    }, 1000);
  };

  //ATTACHMENTS
  const openAttachmentSheet = () => {
    attachmentSheetRef.current?.snapToIndex(0);
  };

  const pickPhoto = async () => {
    attachmentSheetRef.current?.close();

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (result.canceled) return;

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

    if (result.canceled) return;

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

    if (result.canceled) return;

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

    if (result.canceled) return;

    const file = result.assets[0];

    handlePickedAttachment({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      contentType: "FILE",
    });
  };

  const handlePickedAttachment = (file: any) => {
    setSelectedAttachment(file);
  };

  const openPrivacySheet = useCallback(() => {
    privacySheetRef.current?.snapToIndex(0);
  }, []);

  // MESSAGE ACTIONS / SELECTION / REPLY

  const getMessageSelectionKey = useCallback((message: Message) => {
    if (message?.id !== undefined && message?.id !== null) {
      return String(message.id);
    }

    return message?.clientId ? String(message.clientId) : "";
  }, []);

  const isSelectionMode = selectedMessageIds.size > 0;

  const isMessageSelected = useCallback(
    (message: Message) => {
      const key = getMessageSelectionKey(message);
      return !!key && selectedMessageIds.has(key);
    },
    [getMessageSelectionKey, selectedMessageIds],
  );

  const getSelectedMessages = useCallback(() => {
    return messages.filter((message) =>
      selectedMessageIds.has(getMessageSelectionKey(message)),
    );
  }, [messages, selectedMessageIds, getMessageSelectionKey]);

  const getSelectedPersistedMessageIds = useCallback(() => {
    return getSelectedMessages()
      .filter((message) => !message?.deletedForAll)
      .map((message) => Number(message?.id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }, [getSelectedMessages]);

  const getCopyableMessageText = useCallback((message: Message) => {
    if (message?.deletedForAll) {
      return null;
    }

    const contentType = String(message?.contentType || "").toUpperCase();

    const content =
      typeof message?.messageContent === "string"
        ? message.messageContent.trim()
        : "";

    if (contentType === "TEXT" || contentType === "LINK") {
      return content || null;
    }

    return content ? content : null;
  }, []);

  const selectedMessages = useMemo(
    () => getSelectedMessages(),
    [getSelectedMessages],
  );

  const canCopySelectedMessages =
    selectedMessages.length > 0 &&
    selectedMessages.every((message) => !!getCopyableMessageText(message));

  const selectedMessageContentType = String(
    selectedMessage?.contentType || "",
  ).toUpperCase();

  const selectedMessageContent =
    typeof selectedMessage?.messageContent === "string"
      ? selectedMessage.messageContent.trim()
      : "";

  const canCopySelectedMessage =
    !!selectedMessage &&
    !selectedMessage.deletedForAll &&
    !!selectedMessageContent &&
    (selectedMessageContentType === "TEXT" ||
      selectedMessageContentType === "LINK" ||
      !!selectedMessageContent);

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

  const canEditSelectedMessage =
    !!selectedMessage &&
    !selectedMessage.deletedForAll &&
    Number(selectedMessage.senderId) === Number(currentUser?.sub) &&
    !!selectedMessageContent &&
    isWithinMessageEditWindow(selectedMessage);

  const canDeleteSelectedMessagesForEveryone =
    selectedMessages.length > 0 &&
    selectedMessages.every(
      (message) =>
        Number(message?.senderId) === Number(currentUser?.sub) &&
        Number(message?.id) > 0,
    );

  const clearMessageSelection = useCallback(() => {
    setSelectedMessageIds(new Set());
    setSelectedMessage(null);
    setReplyingTo(null);
  }, []);

  const toggleMessageSelection = useCallback(
    (message: Message) => {
      const key = getMessageSelectionKey(message);

      if (!key) {
        return;
      }

      setSelectedMessageIds((previous) => {
        const next = new Set(previous);

        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }

        return next;
      });
    },
    [getMessageSelectionKey],
  );

  const handleSelectMessage = useCallback(() => {
    if (!selectedMessage) {
      return;
    }

    toggleMessageSelection(selectedMessage);

    messageActionSheetRef.current?.close();

    setSelectedMessage(null);
  }, [selectedMessage, toggleMessageSelection]);

  const handleMessagePress = useCallback(
    (message: Message) => {
      if (isSelectionMode) {
        toggleMessageSelection(message);
      }
    },
    [isSelectionMode, toggleMessageSelection],
  );

  const handleMessageLongPress = useCallback(
    (message: Message) => {
      if (isSelectionMode) {
        toggleMessageSelection(message);

        return;
      }

      setSelectedMessage(message);

      messageActionSheetRef.current?.expand();
    },
    [isSelectionMode, toggleMessageSelection],
  );

  const handleReplySwipe = useCallback(
    (message: Message) => {
      if (isSelectionMode || message?.deletedForAll) {
        return;
      }

      setReplyingTo(message);

      requestAnimationFrame(() => {
        const key = getMessageSelectionKey(message);

        swipeRefs.current[key]?.current?.close();
      });
    },
    [isSelectionMode, getMessageSelectionKey],
  );

  const handleEditMessage = useCallback(() => {
    if (!selectedMessage || !canEditSelectedMessage) {
      return;
    }

    if (!isWithinMessageEditWindow(selectedMessage)) {
      messageActionSheetRef.current?.close();

      showFeedback(
        "warning",
        "Edit Message",
        "Messages can only be edited within 10 minutes of sending.",
      );

      return;
    }

    const content =
      typeof selectedMessage.messageContent === "string"
        ? selectedMessage.messageContent
        : "";

    if (!content.trim()) {
      return;
    }

    setEditingMessage(selectedMessage);

    setEditDraft(content);

    setSelectedMessage(null);

    messageActionSheetRef.current?.close();
  }, [selectedMessage, canEditSelectedMessage, showFeedback]);

  const handleSaveEditedMessage = useCallback(async () => {
    if (!editingMessage) {
      return;
    }

    if (!isWithinMessageEditWindow(editingMessage)) {
      setEditingMessage(null);
      setEditDraft("");

      showFeedback(
        "warning",
        "Edit Message",
        "Messages can only be edited within 10 minutes of sending.",
      );

      return;
    }

    const trimmed = editDraft.trim();

    if (!trimmed) {
      return;
    }

    try {
      const updated = await editDirectMessage(
        Number(editingMessage.id),
        trimmed,
      );

      setMessages((prev) =>
        hydrateReplyReferences(
          prev.map((message) =>
            Number(message.id) === Number(updated.id)
              ? {
                  ...message,
                  ...normalizeForwardedLinkMessage(updated),
                  replyTo: message.replyTo || updated.replyTo,
                }
              : message,
          ),
        ),
      );

      setEditingMessage(null);
      setEditDraft("");
    } catch (error) {
      console.log("Direct message edit error:", error);

      showFeedback(
        "error",
        "Edit Message",
        "The message could not be edited. Please try again.",
      );
    }
  }, [editingMessage, editDraft, showFeedback]);

  // ============================================================
  // RESTRUCTURED: CANCEL DIRECT MESSAGE EDIT
  // ============================================================

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditDraft("");
  }, []);

  const handleCopyMessage = useCallback(async () => {
    const targetMessages = isSelectionMode
      ? getSelectedMessages()
      : selectedMessage
        ? [selectedMessage]
        : [];

    const contents = targetMessages
      .map(getCopyableMessageText)
      .filter((value): value is string => !!value);

    if (!contents.length) {
      return;
    }

    await Clipboard.setStringAsync(contents.join("\n\n"));

    messageActionSheetRef.current?.close();

    clearMessageSelection();
  }, [
    isSelectionMode,
    getSelectedMessages,
    selectedMessage,
    getCopyableMessageText,
    clearMessageSelection,
  ]);

  const handleForwardMessage = useCallback(() => {
    const messageIds = isSelectionMode
      ? getSelectedPersistedMessageIds()
      : [Number(selectedMessage?.id)].filter(
          (id) => Number.isInteger(id) && id > 0,
        );

    if (!messageIds.length) {
      showFeedback(
        "warning",
        "Unable to Forward",
        "The selected message cannot be forwarded because it has not been saved yet.",
      );

      return;
    }

    messageActionSheetRef.current?.close();

    clearMessageSelection();

    setTimeout(() => {
      router.push({
        pathname: "/chats/forward",
        params: {
          messageIds: JSON.stringify(messageIds),
          sourceType: "direct",
        },
      });
    }, 200);
  }, [
    isSelectionMode,
    getSelectedPersistedMessageIds,
    selectedMessage,
    clearMessageSelection,
    showFeedback,
  ]);

  const handleDeleteMessage = useCallback(() => {
    if (!selectedMessage && !isSelectionMode) {
      return;
    }

    messageActionSheetRef.current?.close();

    setTimeout(() => {
      deleteMessageSheetRef.current?.expand();
    }, 200);
  }, [selectedMessage, isSelectionMode]);

  const handleDeleteForMe = useCallback(async () => {
    const targetMessages = isSelectionMode
      ? getSelectedMessages()
      : selectedMessage
        ? [selectedMessage]
        : [];

    const ids = targetMessages
      .map((message) => Number(message?.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!ids.length) {
      return;
    }

    try {
      await deleteDirectMessagesForMe(ids);

      const idSet = new Set(ids);

      setMessages((previous) =>
        previous.filter((message) => !idSet.has(Number(message.id))),
      );

      deleteMessageSheetRef.current?.close();
      messageActionSheetRef.current?.close();

      clearMessageSelection();
    } catch (error) {
      console.log("Direct delete for me error:", error);

      showFeedback(
        "error",
        "Delete Failed",
        "Unable to delete the selected message(s).",
      );
    }
  }, [
    isSelectionMode,
    getSelectedMessages,
    selectedMessage,
    clearMessageSelection,
    showFeedback,
  ]);

  const handleDeleteForEveryone = useCallback(async () => {
    const targetMessages = isSelectionMode
      ? getSelectedMessages()
      : selectedMessage
        ? [selectedMessage]
        : [];

    const ids = targetMessages
      .map((message) => Number(message?.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (!ids.length) {
      return;
    }

    const unauthorized = targetMessages.some(
      (message) => Number(message?.senderId) !== Number(currentUser?.sub),
    );

    if (unauthorized) {
      showFeedback(
        "warning",
        "Unable to Delete",
        "You can only delete your own messages for everyone.",
      );

      return;
    }

    try {
      await deleteDirectMessagesForEveryone(ids);

      const idSet = new Set(ids);

      setMessages((previous) =>
        previous.map((message) =>
          idSet.has(Number(message.id))
            ? {
                ...message,
                deletedForAll: true,
                deletedAt: message.deletedAt ?? new Date().toISOString(),
                messageContent: "",
                mediaUrl: null,
                fileName: null,
                mimeType: null,
                fileSize: null,
                encryptedMediaKey: null,
                mediaIV: null,
                mediaAuthTag: null,
                encryptedThumbnailKey: null,
                thumbnailUrl: null,
                thumbnailIV: null,
                thumbnailAuthTag: null,
                duration: null,
                waveform: null,
                videoWidth: null,
                videoHeight: null,
                replyToId: null,
                replyTo: undefined,
              }
            : message,
        ),
      );

      deleteMessageSheetRef.current?.close();
      messageActionSheetRef.current?.close();

      clearMessageSelection();
    } catch (error) {
      console.log("Direct delete for everyone error:", error);

      showFeedback(
        "error",
        "Delete Failed",
        "Unable to delete the selected message(s) for everyone.",
      );
    }
  }, [
    isSelectionMode,
    getSelectedMessages,
    selectedMessage,
    currentUser?.sub,
    clearMessageSelection,
    showFeedback,
  ]);

  const handleRemovePlaceholder = useCallback(async () => {
    if (!selectedMessage) {
      return;
    }

    await handleDeleteForMe();
  }, [selectedMessage, handleDeleteForMe]);

  // ================= REPLY TARGET NAVIGATION =================

  const scrollToRepliedMessage = useCallback(
    (repliedMessage: Message) => {
      const targetId = Number(repliedMessage?.id);

      if (!Number.isInteger(targetId) || targetId <= 0) {
        return;
      }

      const index = messages.findIndex(
        (message) => Number(message.id) === targetId,
      );

      if (index < 0) {
        console.log(
          "Reply target is not currently loaded in this conversation:",
          targetId,
        );

        return;
      }

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.08,
        });
      });
    },
    [messages],
  );

  // ================= SEND MESSAGE =================

  const handleSendMessage = async () => {
    if (messagingBlocked) {
      return;
    }

    if (!input.trim() && !selectedAttachment) {
      return;
    }

    const clientId = uuid.v4().toString();

    const replyToSnapshot = replyingTo;

    const replyToId = replyToSnapshot?.id ? Number(replyToSnapshot.id) : null;

    const tempMessage: Message = {
      id: 0,
      clientId,
      senderId: currentUser?.sub || 0,
      receiverId: parsedUserId,
      messageContent: input || "",
      type: "DIRECT",
      contentType: selectedAttachment?.contentType || "TEXT",
      localUri: selectedAttachment?.uri || null,
      fileName: selectedAttachment?.name || null,
      mimeType: selectedAttachment?.mimeType || null,
      fileSize: selectedAttachment?.size ?? null,
      createdAt: new Date().toISOString(),
      uploadProgress: selectedAttachment ? 0 : 100,
      uploadStatus: selectedAttachment ? "QUEUED" : "SENT",
      isMediaEncrypted: !!selectedAttachment,
      duration: selectedAttachment?.duration ?? null,
      waveform: selectedAttachment?.waveform ?? null,
      videoWidth: selectedAttachment?.width ?? null,
      videoHeight: selectedAttachment?.height ?? null,
      isForwarded: selectedAttachment?.isForwarded ?? false,
      replyToId,
      replyTo: replyToSnapshot || undefined,
      deletedById: selectedAttachment?.deletedById,
    };

    setMessages((prev) => [...prev, tempMessage]);

    if (!isOnline) {
      addQueuedMessage({
        ...tempMessage,
        uploadStatus: "QUEUED",
      });

      setInput("");

      if (directDraftKey) {
        clearDraft(directDraftKey);
      }

      setSelectedAttachment(null);
      setReplyingTo(null);

      return;
    }

    requestAnimationFrame(() => {
      if (isNearBottomRef.current) {
        flatListRef.current?.scrollToEnd({
          animated: true,
        });
      }
    });

    if (selectedAttachment) {
      addQueuedMessage({
        ...tempMessage,
        uploadStatus: "QUEUED",
      });
    } else {
      try {
        const trimmedMessage = input.trim();

        const urlRegex =
          /^(https?:\/\/[^\s]+|www\.[^\s]+|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s]*)?)$/i;

        const detectedContentType = urlRegex.test(trimmedMessage)
          ? "LINK"
          : "TEXT";

        const savedMessage = await sendMessage(parsedUserId, {
          clientId,
          messageContent: trimmedMessage,
          contentType: detectedContentType,
          isForwarded: false,
          replyToId,
        });

        setMessages((prev) => {
          const pendingDeliveredIds = pendingDeliveredMessageIdsRef.current;

          const persistedMessageId = Number(savedMessage?.id);

          const wasDeliveredBeforePersistence =
            Number.isInteger(persistedMessageId) &&
            pendingDeliveredIds.has(persistedMessageId);

          if (wasDeliveredBeforePersistence) {
            pendingDeliveredIds.delete(persistedMessageId);
          }

          return hydrateReplyReferences(
            prev.map((msg) =>
              msg.clientId === clientId
                ? {
                    ...mergePersistedMessage(msg, savedMessage, prev),
                    clientId,
                    status: wasDeliveredBeforePersistence
                      ? "DELIVERED"
                      : (savedMessage.status ?? msg.status ?? "SENT"),
                  }
                : msg,
            ),
          );
        });
      } catch (error) {
        console.log("Text message send error:", error);

        if (!isOnline) {
          addQueuedMessage({
            ...tempMessage,
            uploadStatus: "QUEUED",
          });
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.clientId === clientId
                ? {
                    ...msg,
                    uploadStatus: "FAILED",
                  }
                : msg,
            ),
          );
        }
      }
    }

    setInput("");

    if (directDraftKey) {
      clearDraft(directDraftKey);
    }

    setSelectedAttachment(null);
    setReplyingTo(null);
  };

  const scrollToSearchMessage = useCallback(
    (messageId: number) => {
      const index = messages.findIndex(
        (message) => Number(message.id) === Number(messageId),
      );

      if (index < 0) {
        console.log("Search message is not currently loaded:", messageId);

        return;
      }

      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
    },
    [messages],
  );

  useEffect(() => {
    if (!isSearchMode) return;
    if (searchMatchIds.length === 0) return;

    const activeMessageId = searchMatchIds[activeSearchIndex];

    if (!activeMessageId) return;

    const index = messages.findIndex(
      (message) => Number(message.id) === Number(activeMessageId),
    );

    if (index < 0) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToSearchMessage(activeMessageId);
      });
    });
  }, [
    isSearchMode,
    searchMatchIds,
    activeSearchIndex,
    messages,
    scrollToSearchMessage,
  ]);

  const handleSearchSubmit = async () => {
    const query = searchQuery.trim();

    if (!query) {
      setHasSearched(false);
      setSearchMatchIds([]);
      setActiveSearchIndex(0);

      return;
    }

    try {
      const result = await searchConversationMessages(parsedUserId, query);

      console.log("SEARCH RESULT:", {
        query,
        count: result.count,
        ids: result.messages.map((message) => message.id),
      });

      setHasSearched(true);

      const matchIds = result.messages.map((message) => Number(message.id));

      setSearchMatchIds(matchIds);

      setActiveSearchIndex(0);

      if (result.messages.length === 0) {
        return;
      }

      setMessages((prev) => {
        const messageMap = new Map<number, Message>();

        prev.forEach((message) => {
          messageMap.set(Number(message.id), message);
        });

        result.messages
          .map(normalizeForwardedLinkMessage)
          .forEach((message) => {
            messageMap.set(Number(message.id), message);
          });

        const mergedMessages = Array.from(messageMap.values()).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        return hydrateReplyReferences(mergedMessages);
      });
    } catch (error) {
      console.log("Search messages error:", error);

      setHasSearched(false);
      setSearchMatchIds([]);
      setActiveSearchIndex(0);
    }
  };

  const goToNextSearchMatch = () => {
    if (searchMatchIds.length === 0) {
      return;
    }

    setActiveSearchIndex((current) =>
      current >= searchMatchIds.length - 1 ? 0 : current + 1,
    );
  };

  const goToPreviousSearchMatch = () => {
    if (searchMatchIds.length === 0) {
      return;
    }

    setActiveSearchIndex((current) =>
      current <= 0 ? searchMatchIds.length - 1 : current - 1,
    );
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isMe = item.senderId === currentUser?.sub;

      const searchIndex = searchMatchIds.indexOf(Number(item.id));

      const previousMessage = messages[index - 1];

      const shouldShowDateSeparator =
        index === 0 ||
        !previousMessage ||
        !isSameCalendarDay(item.createdAt, previousMessage.createdAt);

      return (
        <>
          {shouldShowDateSeparator && (
            <View style={styles.dateSeparator}>
              <Text style={styles.dateSeparatorText}>
                {formatMessageDate(item.createdAt)}
              </Text>

              <View style={styles.dateSeparatorLine} />
            </View>
          )}

          <Swipeable
            key={getMessageSelectionKey(item)}
            ref={
              swipeRefs.current[getMessageSelectionKey(item)] ??
              (swipeRefs.current[getMessageSelectionKey(item)] =
                React.createRef<SwipeableMethods>())
            }
            overshootLeft={false}
            overshootRight={false}
            friction={2}
            leftThreshold={40}
            enabled={!isSelectionMode && !item?.deletedForAll}
            onSwipeableWillOpen={() => {
              handleReplySwipe(item);
            }}
            renderLeftActions={() => <View style={styles.swipeReplyAction} />}
          >
            <View style={styles.directSwipeableContent}>
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => handleMessagePress(item)}
                onLongPress={() => handleMessageLongPress(item)}
                delayLongPress={300}
                style={[
                  styles.directMessageInteraction,
                  isMessageSelected(item) && styles.selectedMessageInteraction,
                ]}
              >
                <MessageBubble
                  message={item}
                  isMe={isMe}
                  onReplyPress={scrollToRepliedMessage}
                  searchQuery={isSearchMode ? searchQuery : ""}
                  isActiveSearchMatch={
                    searchIndex !== -1 && searchIndex === activeSearchIndex
                  }
                />

                {String(item.contentType || "").toUpperCase() === "LINK" &&
                  item.messageContent && (
                    <LinkPreview url={item.messageContent} isMe={isMe} />
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
    },
    [
      messages,
      currentUser?.sub,
      searchMatchIds,
      activeSearchIndex,
      isSearchMode,
      searchQuery,
      isSelectionMode,
      isMessageSelected,
      handleMessagePress,
      handleMessageLongPress,
      handleReplySwipe,
      getMessageSelectionKey,
      scrollToRepliedMessage,
    ],
  );

  // ================= KEY EXTRACTOR =================

  const keyExtractor = useCallback(
    (item: Message) => item.clientId || item.localId || item.id.toString(),
    [],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top + 20}
      >
        <View pointerEvents="none" style={styles.blobTopLeft} />

        <View pointerEvents="none" style={styles.blobTopRight} />

        <View pointerEvents="none" style={styles.blobBottomLeft} />

        <View pointerEvents="none" style={styles.blobBottomRight} />

        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline-outline" size={16} color="#FFFFFF" />

            <Text style={styles.offlineText}>
              You&apos;re offline. Messages will be sent automatically when
              you&apos;re back online.
            </Text>
          </View>
        )}

        {messagingBlocked && (
          <View
            style={[
              styles.offlineBanner,
              {
                backgroundColor: "#DC2626",
              },
            ]}
          >
            <Ionicons name="lock-closed-outline" size={16} color="#FFFFFF" />

            <Text style={styles.offlineText}>
              {blockStatus.iBlockedThem
                ? "You blocked this user. Unblock them to send messages."
                : "This user has blocked you. You can't send new messages."}
            </Text>
          </View>
        )}

        {queuedCount > 0 && (
          <View style={styles.queueBanner}>
            <Ionicons name="time-outline" size={16} color="#7C5C00" />

            <Text style={styles.queueText}>
              {queuedCount} message
              {queuedCount > 1 ? "s" : ""} waiting to send
            </Text>
          </View>
        )}

        {/* ======================================================
            SEARCH HEADER
            ====================================================== */}

        {isSelectionMode ? (
          <View
            style={[
              styles.selectionHeader,
              {
                paddingTop: Math.max(insets.top, 8),
              },
            ]}
          >
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
        ) : isSearchMode ? (
          <>
            <View
              style={[
                styles.chatHeader,
                {
                  paddingTop: Math.max(insets.top, 8),
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.backButton}
                onPress={handleExitSearch}
              >
                <Ionicons name="arrow-back" size={22} color="#0B1545" />
              </TouchableOpacity>

              <View style={styles.searchInputWrapper}>
                <Ionicons name="search-outline" size={20} color="#69708A" />

                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search messages"
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                  returnKeyType="search"
                  onSubmitEditing={handleSearchSubmit}
                  autoFocus
                />

                <View style={styles.searchNavigation}>
                  <Text style={styles.searchMatchCount}>
                    {searchMatchIds.length > 0
                      ? `${activeSearchIndex + 1}/${searchMatchIds.length}`
                      : "0/0"}
                  </Text>

                  <TouchableOpacity
                    onPress={goToPreviousSearchMatch}
                    disabled={searchMatchIds.length === 0}
                    style={styles.searchNavButton}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={20}
                      color={searchMatchIds.length ? "#2563EB" : "#9CA3AF"}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={goToNextSearchMatch}
                    disabled={searchMatchIds.length === 0}
                    style={styles.searchNavButton}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={searchMatchIds.length ? "#2563EB" : "#9CA3AF"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.calendarButton}
                onPress={handleCalendarPress}
              >
                <Ionicons name="calendar-outline" size={22} color="#2563EB" />
              </TouchableOpacity>
            </View>

            {hasSearched &&
              searchQuery.trim().length > 0 &&
              searchMatchIds.length === 0 && (
                <View style={styles.searchNotFoundBubble}>
                  <Text style={styles.searchNotFoundText}>
                    No messages found.
                  </Text>
                </View>
              )}
          </>
        ) : (
          <View
            style={[
              styles.chatHeader,
              {
                paddingTop: Math.max(insets.top, 8),
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={22} color="#0B1545" />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.headerProfile}
              onPress={() =>
                router.push({
                  pathname: "/profile/user-details" as any,
                  params: {
                    userId: parsedUserId.toString(),
                  },
                })
              }
            >
              <View style={styles.avatarContainer}>
                {avatarUri ? (
                  <Image
                    source={{
                      uri: avatarUri,
                    }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>
                      {chatUser?.profile?.username?.charAt(0)?.toUpperCase() ||
                        "U"}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.headerInfo}>
                <Text numberOfLines={1} style={styles.headerUsername}>
                  {chatUser?.profile?.username || "Unknown"}
                </Text>

                <Text style={styles.headerStatus}>
                  {isTyping
                    ? "Typing..."
                    : chatUserPresence.online
                      ? "Online"
                      : chatUserPresence.lastSeen
                        ? `Last seen ${formatLastSeen(
                            chatUserPresence.lastSeen,
                          )}`
                        : "Offline"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {selectedDate && (
          <View style={styles.dateFilterBanner}>
            <View style={styles.dateFilterInfo}>
              <Ionicons name="calendar-outline" size={18} color="#2563EB" />

              <Text style={styles.dateFilterText}>
                {formatMessageDate(`${selectedDate}T00:00:00`)}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleClearDateFilter}
              style={styles.clearDateFilterButton}
            >
              <Ionicons name="close" size={18} color="#2563EB" />

              <Text style={styles.clearDateFilterText}>
                Back to conversation
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Flashlist */}

        <View
          style={{
            flex: 1,
          }}
        >
          {selectedDate && messages.length === 0 ? (
            <View style={styles.noMessagesContainer}>
              <View style={styles.noMessagesIcon}>
                <Ionicons name="calendar-outline" size={34} color="#2563EB" />
              </View>

              <Text style={styles.noMessagesTitle}>
                No messages on this day
              </Text>

              <Text style={styles.noMessagesSubtitle}>
                There are no messages in this conversation for{" "}
                {formatMessageDate(`${selectedDate}T00:00:00`)}.
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleClearDateFilter}
                style={styles.backToConversationButton}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={18}
                  color="#FFFFFF"
                />

                <Text style={styles.backToConversationText}>
                  Back to conversation
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlashList<Message>
              ref={flatListRef}
              data={messages}
              renderItem={renderItem}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.listContent,
                {
                  paddingTop: 18,
                  paddingBottom: 90,
                },
              ]}
              removeClippedSubviews
              drawDistance={1200}
              onStartReached={loadOlderMessages}
              onStartReachedThreshold={0.2}
              showsVerticalScrollIndicator={false}
              maintainVisibleContentPosition={{
                autoscrollToBottomThreshold: 0.2,
              }}
              onScroll={handleScroll}
              ListHeaderComponent={
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
                      <Text style={styles.privacyLearnMoreText}>
                        Learn more
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={15}
                        color="#4F46E5"
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              }
            />
          )}
        </View>

        {isTyping && (
          <View style={styles.typingContainer}>
            <Ionicons name="ellipse" size={8} color="#2563EB" />

            <Text style={styles.typingText}>
              {chatUser?.profile?.username} is typing…
            </Text>
          </View>
        )}

        {!isSelectionMode && replyingTo && (
          <View style={styles.replyPreview}>
            <View style={styles.replyBar} />

            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyAuthor}>
                {replyingTo.sender?.profile?.username ||
                  (Number(replyingTo.senderId) === Number(currentUser?.sub)
                    ? "You"
                    : chatUser?.profile?.username || "User")}
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
                          : "Message")}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setReplyingTo(null)}
              style={styles.replyClose}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {!isSelectionMode && selectedAttachment && (
          <AttachmentPreview
            attachment={selectedAttachment}
            onRemove={() => setSelectedAttachment(null)}
          />
        )}

        {!isSelectionMode && (
          <View
            style={[
              styles.composerWrapper,
              {
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            {editingMessage && (
              <View style={styles.editingBanner}>
                <View style={styles.editingBannerContent}>
                  <Ionicons name="create-outline" size={16} color="#2563EB" />

                  <View style={styles.editingBannerTextContainer}>
                    <Text style={styles.editingBannerTitle}>
                      Editing Message
                    </Text>

                    <Text style={styles.editingBannerMessage} numberOfLines={1}>
                      {editingMessage.messageContent}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={handleCancelEdit}
                  style={styles.editingCancelButton}
                >
                  <Ionicons name="close" size={19} color="#64748B" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputContainer}>
              {!editingMessage && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={messagingBlocked}
                  onPress={openAttachmentSheet}
                  style={[
                    styles.attachButton,
                    messagingBlocked && {
                      opacity: 0.5,
                    },
                  ]}
                >
                  <Ionicons name="attach" size={22} color="#69708A" />
                </TouchableOpacity>
              )}

              <TextInput
                editable={!messagingBlocked}
                value={editingMessage ? editDraft : input}
                onChangeText={editingMessage ? setEditDraft : handleTyping}
                placeholder={
                  messagingBlocked
                    ? "Messaging unavailable"
                    : editingMessage
                      ? "Edit message..."
                      : "Type a message..."
                }
                placeholderTextColor="#94A3B8"
                style={styles.input}
                multiline
              />

              <TouchableOpacity
                activeOpacity={0.85}
                disabled={
                  messagingBlocked ||
                  (editingMessage
                    ? !editDraft.trim()
                    : !input.trim() && !selectedAttachment)
                }
                onPress={
                  editingMessage ? handleSaveEditedMessage : handleSendMessage
                }
                style={[
                  styles.sendBtn,
                  messagingBlocked && {
                    opacity: 0.5,
                  },
                ]}
              >
                <Ionicons
                  name={editingMessage ? "checkmark" : "send"}
                  size={editingMessage ? 21 : 18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <AttachmentBottomSheet
        ref={attachmentSheetRef}
        onPhoto={pickPhoto}
        onVideo={pickVideo}
        onAudio={pickAudio}
        onDocument={pickDocument}
      />

      <MessageActionBottomSheet
        ref={messageActionSheetRef}
        isMe={Number(selectedMessage?.senderId) === Number(currentUser?.sub)}
        isGroupCreator={false}
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

      <PrivacyBottomSheet
        ref={privacySheetRef}
        onLearnMore={() => {
          privacySheetRef.current?.close();
          setTimeout(() => {
            router.push("/privacy" as any);
          }, 200);
        }}
      />

      <DeleteMessageBottomSheet
        ref={deleteMessageSheetRef}
        canDeleteForEveryone={
          isSelectionMode
            ? canDeleteSelectedMessagesForEveryone
            : Number(selectedMessage?.senderId) === Number(currentUser?.sub)
        }
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
      />

      {showDatePicker && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display={Platform.OS === "android" ? "calendar" : "default"}
          onChange={handleDateChange}
        />
      )}

      {/* ============================================================
          GLOBAL SCREEN FEEDBACK
          ============================================================ */}

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        buttonText="OK"
        onClose={closeFeedback}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  blobTopLeft: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "#E9EEFF",
    top: 70,
    left: -140,
    opacity: 0.95,
  },

  blobTopRight: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "#EEE8FF",
    top: 150,
    right: -110,
    opacity: 0.85,
  },

  blobBottomLeft: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "#EEF4FF",
    bottom: 30,
    left: -150,
    opacity: 0.85,
  },

  blobBottomRight: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#F1ECFF",
    bottom: -20,
    right: -100,
    opacity: 0.8,
  },

  chatHeader: {
    height: 70,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FC",
  },

  selectionHeader: {
    minHeight: 70,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7FC",
  },

  selectionHeaderButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F4F5",
  },

  selectionHeaderCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },

  selectionCount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },

  selectionLabel: {
    marginTop: 1,
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748B",
  },

  selectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  selectionHeaderActionButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0ECFF",
  },

  selectionHeaderDeleteButton: {
    backgroundColor: "#FFF1F2",
  },

  directMessageInteraction: {
    position: "relative",
    width: "100%",
  },

  selectedMessageInteraction: {
    borderRadius: 20,
    backgroundColor: "rgba(124,92,255,0.08)",
  },

  selectedMessageIndicator: {
    position: "absolute",
    top: 8,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C5CFF",
    zIndex: 10,
    elevation: 5,
  },

  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingVertical: 8,
    paddingRight: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  replyBar: {
    width: 4,
    alignSelf: "stretch",
    borderRadius: 4,
    backgroundColor: "#7C5CFF",
    marginRight: 10,
  },

  replyPreviewContent: {
    flex: 1,
    minWidth: 0,
  },

  replyAuthor: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4338CA",
  },

  replyText: {
    marginTop: 2,
    fontSize: 13,
    color: "#64748B",
  },

  replyClose: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 3,
  },

  headerProfile: {
    flex: 1,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
  },

  avatarContainer: {
    position: "relative",
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },

  avatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#E9EEFF",
    justifyContent: "center",
    alignItems: "center",
  },

  backArrow: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "600",
  },

  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2563EB",
  },

  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },

  headerUsername: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0B1545",
  },

  headerStatus: {
    marginTop: 2,
    fontSize: 13,
    color: "#69708A",
  },

  listContent: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 90,
  },

  typingContainer: {
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  typingText: {
    marginLeft: 8,
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
  },

  editingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#DCE7FF",
  },

  editingBannerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  editingBannerTextContainer: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
  },

  editingBannerTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2563EB",
  },

  editingBannerMessage: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B",
  },

  editingCancelButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  composerWrapper: {
    paddingHorizontal: 18,
    paddingTop: 6,
    backgroundColor: "transparent",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#2563EB",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 8,
  },

  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  input: {
    flex: 1,
    marginHorizontal: 10,
    fontSize: 15,
    color: "#0B1545",
    maxHeight: 120,
    paddingVertical: 8,
  },

  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 10,
    paddingHorizontal: 18,
  },

  offlineText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
    marginLeft: 8,
  },

  queueBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF3C7",
    paddingVertical: 10,
  },

  queueText: {
    marginLeft: 8,
    color: "#7C5C00",
    fontWeight: "600",
    fontSize: 13,
  },

  searchInputWrapper: {
    flex: 1,
    height: 46,
    marginHorizontal: 10,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: "#F4F7FD",
    flexDirection: "row",
    alignItems: "center",
  },

  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#0B1545",
  },

  calendarButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
    justifyContent: "center",
    alignItems: "center",
  },

  searchNavigation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  searchMatchCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#69708A",
    marginHorizontal: 4,
  },

  searchNavButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  searchNotFoundBubble: {
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    zIndex: 10,
  },

  searchNotFoundText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#69708A",
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

  dateFilterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "#EEF4FF",
    borderWidth: 1,
    borderColor: "#DCE7FF",
  },

  dateFilterInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  dateFilterText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },

  clearDateFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 7,
  },

  clearDateFilterText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#2563EB",
  },

  noMessagesContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },

  noMessagesIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EEF4FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  noMessagesTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0B1545",
    textAlign: "center",
  },

  noMessagesSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#69708A",
    textAlign: "center",
  },

  backToConversationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: "#2563EB",
  },

  backToConversationText: {
    marginLeft: 7,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  swipeReplyAction: {
    width: 1,
  },

  directSwipeableContent: {
    width: "100%",
  },

  // STEP 2 — Privacy information card styles
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 2,
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
});
