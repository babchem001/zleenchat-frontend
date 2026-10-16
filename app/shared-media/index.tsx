import * as Haptics from "expo-haptics";
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
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  TextInput,
  Animated,
  Keyboard,
} from "react-native";

import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  getSharedMedia,
  getGroupSharedMedia,
  SharedMediaItem,
  SharedMediaType,
} from "@/src/services/chat/sharedMediaService";

import PhotoGrid from "@/components/shared-media/PhotoGrid";
import VideoGrid from "@/components/shared-media/VideoGrid";
import AudioList from "@/components/shared-media/AudioList";
import FileList from "@/components/shared-media/FileList";
import LinkList from "@/components/shared-media/LinkList";

import EmptySharedMedia from "@/components/shared-media/EmptySharedMedia";
import SharedMediaSkeleton from "@/components/shared-media/SharedMediaSkeleton";

import filterSharedMedia, {
  SharedMediaFilterOptions,
} from "@/src/utils/filterSharedMedia";

import SharedMediaSortSheet from "@/components/shared-media/SharedMediaSortSheet";

import sortSharedMedia, {
  SharedMediaSortOption,
} from "@/src/utils/sortSharedMedia";

import {
  deleteDirectMessagesForMe,
  deleteDirectMessagesForEveryone,
} from "@/src/services/chat/chatService";

import {
  deleteGroupMessageForMe,
  deleteGroupMessageForEveryone,
} from "@/src/services/group/groupMessageService";

import { useAuthStore } from "@/src/store/auth/authStorage";
import { useSocket } from "@/hooks/useSocket";

import AppFeedbackModal, {
  FeedbackType,
} from "@/src/components/AppFeedbackModal";

type DeleteAction = "ME" | "EVERYONE";

export default function SharedMediaScreen() {
  type SharedMediaContext = "user" | "group";

  const {
    context,
    userId,
    username,
    groupId,
    groupName,
    initialTab,
    isLeft: routeIsLeft,
  } = useLocalSearchParams<{
    context?: SharedMediaContext;
    userId: string;
    username?: string;
    groupId?: string;
    groupName?: string;
    initialTab?: SharedMediaType;
    isLeft?: string;
  }>();

  const mediaContext: SharedMediaContext =
    context === "group" ? "group" : "user";
  const isReadOnlyGroup = mediaContext === "group" && routeIsLeft === "true";

  const [selectedTab, setSelectedTab] = useState<SharedMediaType>(
    initialTab ?? "IMAGE",
  );

  const [items, setItems] = useState<SharedMediaItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");

  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [selectedFilter, setSelectedFilter] = useState("All");

  const [sortVisible, setSortVisible] = useState(false);

  const [sortOption, setSortOption] = useState<SharedMediaSortOption>("NEWEST");

  const [selectionMode, setSelectionMode] = useState(false);

  const [selectedItems, setSelectedItems] = useState<Set<number>>(
    () => new Set(),
  );

  const [searchFocused, setSearchFocused] = useState(false);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [feedbackVisible, setFeedbackVisible] = useState(false);

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("info");

  const [feedbackTitle, setFeedbackTitle] = useState("");

  const [feedbackMessage, setFeedbackMessage] = useState("");

  const [feedbackButtonText, setFeedbackButtonText] = useState("OK");

  const [feedbackSecondaryButtonText, setFeedbackSecondaryButtonText] =
    useState<string | undefined>(undefined);

  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [feedbackAction, setFeedbackAction] = useState<DeleteAction | null>(
    null,
  );

  const insets = useSafeAreaInsets();

  const focusAnim = useRef(new Animated.Value(0)).current;

  const listOpacity = useRef(new Animated.Value(1)).current;

  const selectionTransition = useRef(new Animated.Value(0)).current;

  const selectionActionsAnim = useRef(new Animated.Value(0)).current;

  const selectionCounterScale = useRef(new Animated.Value(1)).current;

  const selectionCounterOpacity = useRef(new Animated.Value(1)).current;

  const currentUser = useAuthStore((state) => state.user);

  const currentUserId = currentUser?.sub;

  const { socketRef, connected } = useSocket();

  const closeFeedback = useCallback(() => {
    if (feedbackLoading) {
      return;
    }

    setFeedbackVisible(false);

    setFeedbackAction(null);

    setFeedbackSecondaryButtonText(undefined);
  }, [feedbackLoading]);

  const showFeedback = useCallback(
    ({
      type = "info",
      title,
      message,
      buttonText = "OK",
      secondaryButtonText,
      action = null,
    }: {
      type?: FeedbackType;
      title: string;
      message: string;
      buttonText?: string;
      secondaryButtonText?: string;
      action?: DeleteAction | null;
    }) => {
      setFeedbackType(type);

      setFeedbackTitle(title);

      setFeedbackMessage(message);

      setFeedbackButtonText(buttonText);

      setFeedbackSecondaryButtonText(secondaryButtonText);

      setFeedbackAction(action);

      setFeedbackVisible(true);
    },
    [],
  );

  const loadSharedMedia = useCallback(
    async ({ isRefresh = false }: { isRefresh?: boolean } = {}) => {
      // Group context
      if (mediaContext === "group") {
        if (!groupId) {
          setItems([]);

          setError("Unable to identify this group.");

          if (!isRefresh) {
            setLoading(false);
          }

          return;
        }

        try {
          if (!isRefresh) {
            setLoading(true);
          }

          setError(null);

          const media = await getGroupSharedMedia(Number(groupId), selectedTab);

          setItems(media);
        } catch (error) {
          console.log("Group shared media fetch error:", error);

          setItems([]);

          const status = (error as any)?.response?.status;
          setError(
            status === 403
              ? "You are not authorized to view this group's shared media."
              : "Unable to load group shared media. Please try again.",
          );
        } finally {
          if (!isRefresh) {
            setLoading(false);
          }
        }

        return;
      }

      if (!userId) {
        if (!isRefresh) {
          setLoading(false);
        }

        return;
      }

      try {
        if (!isRefresh) {
          setLoading(true);
        }

        setError(null);

        const media = await getSharedMedia(Number(userId), selectedTab);

        setItems(media);
      } catch (error) {
        console.log("Shared media fetch error:", error);

        setItems([]);

        setError("Unable to load shared media.");
      } finally {
        if (!isRefresh) {
          setLoading(false);
        }
      }
    },
    [groupId, mediaContext, selectedTab, userId],
  );

  useEffect(() => {
    Animated.timing(selectionTransition, {
      toValue: selectionMode && !isReadOnlyGroup ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [selectionMode, isReadOnlyGroup, selectionTransition]);

  useEffect(() => {
    if (!isReadOnlyGroup) {
      return;
    }

    setSelectionMode(false);
    setSelectedItems(new Set());
  }, [isReadOnlyGroup]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    if (mediaContext === "user") {
      const handleDeletedForMe = ({
        messageIds,
        userId,
      }: {
        messageIds: number[];
        userId: number;
      }) => {
        if (Number(userId) !== Number(currentUserId)) {
          return;
        }

        const deletedIds = new Set(messageIds.map(Number));

        setItems((previous) =>
          previous.filter((item) => !deletedIds.has(Number(item.id))),
        );

        setSelectedItems((previous) => {
          const next = new Set(previous);

          deletedIds.forEach((id) => {
            next.delete(id);
          });

          return next;
        });
      };

      const handleDeletedForEveryone = ({
        messageIds,
      }: {
        messageIds: number[];
        deletedById: number;
      }) => {
        const deletedIds = new Set(messageIds.map(Number));

        setItems((previous) =>
          previous.filter((item) => !deletedIds.has(Number(item.id))),
        );

        setSelectedItems((previous) => {
          const next = new Set(previous);

          deletedIds.forEach((id) => {
            next.delete(id);
          });

          return next;
        });
      };

      socket.on("directMessagesDeletedForMe", handleDeletedForMe);

      socket.on("directMessagesDeletedForEveryone", handleDeletedForEveryone);

      return () => {
        socket.off("directMessagesDeletedForMe", handleDeletedForMe);

        socket.off(
          "directMessagesDeletedForEveryone",
          handleDeletedForEveryone,
        );
      };
    }

    if (mediaContext === "group" && groupId) {
      const handleGroupMessageDeletedForEveryone = (updatedMessage: {
        id: number;
        groupId?: number | null;
      }) => {
        // STEP 5:
        // Ignore group deletion events belonging to another group.
        if (Number(updatedMessage?.groupId) !== Number(groupId)) {
          return;
        }

        const deletedId = Number(updatedMessage?.id);

        if (!Number.isInteger(deletedId)) {
          return;
        }

        setItems((previous) =>
          previous.filter((item) => Number(item.id) !== deletedId),
        );

        setSelectedItems((previous) => {
          const next = new Set(previous);

          next.delete(deletedId);

          return next;
        });
      };

      socket.on(
        "groupMessageDeletedForEveryone",
        handleGroupMessageDeletedForEveryone,
      );

      return () => {
        socket.off(
          "groupMessageDeletedForEveryone",
          handleGroupMessageDeletedForEveryone,
        );
      };
    }
  }, [connected, currentUserId, mediaContext, groupId, socketRef]);

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      await loadSharedMedia({
        isRefresh: true,
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadSharedMedia]);

  useEffect(() => {
    loadSharedMedia();
  }, [loadSharedMedia]);

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: searchFocused ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [searchFocused, focusAnim]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(listOpacity, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),

      Animated.timing(listOpacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [sortOption, listOpacity]);

  useEffect(() => {
    if (selectionMode && selectedItems.size === 0) {
      setSelectionMode(false);
    }
  }, [selectionMode, selectedItems]);

  const searchBorderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#EEF2FF", "#2563EB"],
  });

  const searchShadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.18],
  });

  const filterChips = useMemo(
    () => [
      "All",
      "Today",
      "This Week",
      "This Month",
      "Images",
      "Videos",
      "Audio",
      "Files",
      "Links",
    ],
    [],
  );

  const handleFilterPress = useCallback((chip: string) => {
    setSelectedFilter(chip);
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const enterSelectionMode = useCallback(
    (itemId: number) => {
      if (isReadOnlyGroup) {
        return;
      }

      Keyboard.dismiss();

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => {},
      );

      setSelectionMode(true);

      setSelectedItems(new Set([itemId]));
    },
    [isReadOnlyGroup],
  );

  const toggleSelection = useCallback(
    (itemId: number) => {
      if (isReadOnlyGroup) {
        return;
      }

      Keyboard.dismiss();

      void Haptics.selectionAsync().catch(() => {});

      setSelectedItems((previous) => {
        const next = new Set(previous);

        if (next.has(itemId)) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }

        return next;
      });
    },
    [isReadOnlyGroup],
  );

  const filterOptions = useMemo<SharedMediaFilterOptions>(() => {
    const now = new Date();

    switch (selectedFilter) {
      case "Today": {
        const fromDate = new Date(now);

        fromDate.setHours(0, 0, 0, 0);

        return {
          query: debouncedQuery,
          fromDate,
        };
      }

      case "This Week": {
        const fromDate = new Date(now);

        fromDate.setDate(now.getDate() - 7);

        return {
          query: debouncedQuery,
          fromDate,
        };
      }

      case "This Month": {
        const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);

        return {
          query: debouncedQuery,
          fromDate,
        };
      }

      case "Images":
        return {
          query: debouncedQuery,
          mediaType: "IMAGE",
        };

      case "Videos":
        return {
          query: debouncedQuery,
          mediaType: "VIDEO",
        };

      case "Audio":
        return {
          query: debouncedQuery,
          mediaType: "AUDIO",
        };

      case "Files":
        return {
          query: debouncedQuery,
          mediaType: "FILE",
        };

      case "Links":
        return {
          query: debouncedQuery,
          mediaType: "LINK",
        };

      default:
        return {
          query: debouncedQuery,
        };
    }
  }, [debouncedQuery, selectedFilter]);

  const visibleItems = useMemo(() => {
    const filtered = filterSharedMedia(items, filterOptions);

    return sortSharedMedia(filtered, sortOption);
  }, [items, filterOptions, sortOption]);

  const selectAll = useCallback(() => {
    if (isReadOnlyGroup || visibleItems.length === 0) {
      return;
    }

    Keyboard.dismiss();

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => {},
    );

    setSelectedItems((previous) => {
      const next = new Set(previous);

      for (const item of visibleItems) {
        next.add(item.id);
      }

      return next;
    });

    setSelectionMode(true);
  }, [isReadOnlyGroup, visibleItems]);

  const exitSelectionMode = useCallback(() => {
    Keyboard.dismiss();

    void Haptics.selectionAsync().catch(() => {});

    setSelectionMode(false);

    setSelectedItems(new Set());
  }, []);

  const itemsById = useMemo(() => {
    const map = new Map<number, SharedMediaItem>();

    for (const item of items) {
      map.set(item.id, item);
    }

    return map;
  }, [items]);

  const selectedMedia = useMemo(() => {
    const result: SharedMediaItem[] = [];

    for (const id of selectedItems) {
      const item = itemsById.get(id);

      if (item) {
        result.push(item);
      }
    }

    return result;
  }, [selectedItems, itemsById]);

  useEffect(() => {
    if (selectedItems.size === 0) {
      return;
    }

    const availableIds = new Set(items.map((item) => Number(item.id)));

    setSelectedItems((previous) => {
      let changed = false;

      const next = new Set<number>();

      for (const id of previous) {
        if (availableIds.has(Number(id))) {
          next.add(id);
        } else {
          changed = true;
        }
      }

      if (!changed) {
        return previous;
      }

      return next;
    });
  }, [items, selectedItems.size]);

  const handleForward = useCallback(() => {
    if (isReadOnlyGroup || selectedMedia.length === 0) {
      return;
    }

    router.push({
      pathname: "/chats/forward",

      params: {
        messageIds: JSON.stringify(selectedMedia.map((item) => item.id)),

        // STEP 5:
        // Preserve whether selected media came from a direct
        // conversation or a group conversation.
        sourceType: mediaContext,
      },
    });
  }, [isReadOnlyGroup, selectedMedia, mediaContext]);

  const performDelete = useCallback(
    async (action: DeleteAction) => {
      if (isReadOnlyGroup || selectedMedia.length === 0) {
        closeFeedback();

        return;
      }

      const messageIds = selectedMedia.map((item) => Number(item.id));

      const previousItems = items;

      setFeedbackLoading(true);

      setItems((previous) =>
        previous.filter((item) => !selectedItems.has(item.id)),
      );

      try {
        if (mediaContext === "group") {
          // STEP 5:
          // Group shared media uses the existing group-message
          // deletion services rather than direct-message services.
          if (action === "ME") {
            await Promise.all(
              messageIds.map((messageId) => deleteGroupMessageForMe(messageId)),
            );
          } else {
            await Promise.all(
              messageIds.map((messageId) =>
                deleteGroupMessageForEveryone(messageId),
              ),
            );
          }
        } else {
          // Existing direct-message behavior remains unchanged.
          if (action === "ME") {
            await deleteDirectMessagesForMe(messageIds);
          } else {
            await deleteDirectMessagesForEveryone(messageIds);
          }
        }

        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});

        setFeedbackLoading(false);

        setFeedbackVisible(false);

        setFeedbackAction(null);

        exitSelectionMode();
      } catch (error) {
        console.log(
          `Delete media ${action === "ME" ? "for me" : "for everyone"} error:`,
          error,
        );

        setItems(previousItems);

        setFeedbackLoading(false);

        setFeedbackAction(null);

        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        ).catch(() => {});

        showFeedback({
          type: "error",

          title: "Delete failed",

          message:
            action === "ME"
              ? "Unable to delete the selected media. Please try again."
              : "Unable to delete the selected media for everyone. Please try again.",
        });
      }
    },
    [
      selectedMedia,
      isReadOnlyGroup,
      mediaContext,
      closeFeedback,
      items,
      selectedItems,
      exitSelectionMode,
      showFeedback,
    ],
  );

  const handleFeedbackClose = useCallback(() => {
    if (feedbackLoading) {
      return;
    }

    if (feedbackAction === "ME") {
      void performDelete("ME");

      return;
    }

    closeFeedback();
  }, [feedbackLoading, feedbackAction, performDelete, closeFeedback]);

  const showFileFeedback = useCallback(
    (type: FeedbackType, title: string, message: string, buttonText = "OK") => {
      showFeedback({
        type,
        title,
        message,
        buttonText,
      });
    },
    [showFeedback],
  );

  const handleFeedbackSecondaryPress = useCallback(() => {
    if (feedbackLoading) {
      return;
    }

    if (feedbackAction === "EVERYONE") {
      void performDelete("EVERYONE");
    }
  }, [feedbackLoading, feedbackAction, performDelete]);

  const handleDelete = useCallback(() => {
    if (isReadOnlyGroup || selectedMedia.length === 0) {
      return;
    }

    const allOwnedByCurrentUser = selectedMedia.every(
      (item) => Number(item.senderId) === Number(currentUserId),
    );

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
      () => {},
    );

    showFeedback({
      type: "warning",

      title: "Delete selected media?",

      message: `${selectedMedia.length} item${
        selectedMedia.length === 1 ? "" : "s"
      } selected. Choose how you want to delete ${
        selectedMedia.length === 1 ? "it" : "them"
      }.`,

      buttonText: "Delete for Me",

      secondaryButtonText: allOwnedByCurrentUser
        ? "Delete for Everyone"
        : undefined,

      action: allOwnedByCurrentUser ? "EVERYONE" : "ME",
    });
  }, [isReadOnlyGroup, selectedMedia, currentUserId, showFeedback]);

  const mediaContent = useMemo(() => {
    switch (selectedTab) {
      case "IMAGE":
        return (
          <PhotoGrid
            items={visibleItems}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            selectionMode={selectionMode}
            selectedItems={selectedItems}
            onEnterSelectionMode={enterSelectionMode}
            onToggleSelection={toggleSelection}
          />
        );

      case "VIDEO":
        return (
          <VideoGrid
            items={visibleItems}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            selectionMode={selectionMode}
            selectedItems={selectedItems}
            onEnterSelectionMode={enterSelectionMode}
            onToggleSelection={toggleSelection}
          />
        );

      case "AUDIO":
        return (
          <AudioList
            items={visibleItems}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            selectionMode={selectionMode}
            selectedItems={selectedItems}
            onEnterSelectionMode={enterSelectionMode}
            onToggleSelection={toggleSelection}
          />
        );

      case "FILE":
        return (
          <FileList
            items={visibleItems}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            selectionMode={selectionMode}
            selectedItems={selectedItems}
            onEnterSelectionMode={enterSelectionMode}
            onToggleSelection={toggleSelection}
            // STEP UI CHANGE / TYPE FIX:
            // FileList requires showFeedback. This prop must remain
            // here because FileList uses the shared feedback handler.
            showFeedback={showFileFeedback}
          />
        );

      default:
        return (
          <LinkList
            items={visibleItems}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            selectionMode={selectionMode}
            selectedItems={selectedItems}
            onEnterSelectionMode={enterSelectionMode}
            onToggleSelection={toggleSelection}
          />
        );
    }
  }, [
    selectedTab,
    visibleItems,
    refreshing,
    handleRefresh,
    selectionMode,
    selectedItems,
    enterSelectionMode,
    toggleSelection,

    // STEP UI CHANGE / TYPE FIX:
    // showFileFeedback is passed to FileList and therefore belongs
    // in this memo's dependency list.
    showFileFeedback,
  ]);

  const currentSortLabel = useMemo(() => {
    switch (sortOption) {
      case "NEWEST":
        return "Newest";

      case "OLDEST":
        return "Oldest";

      case "LARGEST":
        return "Largest";

      case "SMALLEST":
        return "Smallest";

      default:
        return "Newest";
    }
  }, [sortOption]);

  const selectedCount = selectedItems.size;

  useEffect(() => {
    if (!selectionMode) {
      return;
    }

    Animated.parallel([
      Animated.sequence([
        Animated.timing(selectionCounterScale, {
          toValue: 1.12,
          duration: 90,
          useNativeDriver: true,
        }),

        Animated.spring(selectionCounterScale, {
          toValue: 1,
          friction: 6,
          tension: 100,
          useNativeDriver: true,
        }),
      ]),

      Animated.sequence([
        Animated.timing(selectionCounterOpacity, {
          toValue: 0.55,
          duration: 70,
          useNativeDriver: true,
        }),

        Animated.timing(selectionCounterOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    selectedCount,
    selectionMode,
    selectionCounterScale,
    selectionCounterOpacity,
  ]);

  useEffect(() => {
    Animated.timing(selectionActionsAnim, {
      toValue: selectionMode && !isReadOnlyGroup ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [selectionMode, isReadOnlyGroup, selectionActionsAnim]);

  const allVisibleSelected = useMemo(() => {
    if (visibleItems.length === 0) {
      return false;
    }

    return visibleItems.every((item) => selectedItems.has(item.id));
  }, [visibleItems, selectedItems]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View pointerEvents="none" style={styles.blobTopLeft} />

      <View pointerEvents="none" style={styles.blobTopRight} />

      <View pointerEvents="none" style={styles.blobBottomLeft} />

      <View pointerEvents="none" style={styles.blobBottomRight} />

      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View
        style={[
          styles.headerShell,

          {
            paddingTop: Math.max(insets.top, 0),
          },
        ]}
      >
        <Animated.View
          pointerEvents={selectionMode && !isReadOnlyGroup ? "none" : "auto"}
          style={[
            styles.header,
            styles.headerLayer,

            {
              opacity: selectionTransition.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),

              transform: [
                {
                  translateY: selectionTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -8],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color="#0B1545" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>Shared Media</Text>

            <Text style={styles.subtitle}>
              {mediaContext === "group"
                ? groupName
                  ? `${groupName}'s shared files`
                  : "Group shared files"
                : username
                  ? `${username}'s shared files`
                  : "Photos, videos, audio, files & links"}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.headerButton}
            onPress={() => setSortVisible(true)}
          >
            <Ionicons name="swap-vertical-outline" size={22} color="#0B1545" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          pointerEvents={selectionMode && !isReadOnlyGroup ? "auto" : "none"}
          style={[
            styles.selectionHeader,
            styles.headerLayer,

            {
              opacity: isReadOnlyGroup ? 0 : selectionTransition,

              transform: [
                {
                  translateY: selectionTransition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.85}
            onPress={exitSelectionMode}
          >
            <Ionicons name="close" size={24} color="#0B1545" />
          </TouchableOpacity>

          <View style={styles.selectionTitleContainer}>
            <Animated.Text
              style={[
                styles.selectionTitle,

                {
                  opacity: selectionCounterOpacity,

                  transform: [
                    {
                      scale: selectionCounterScale,
                    },
                  ],
                },
              ]}
            >
              {selectedCount} selected
            </Animated.Text>
          </View>

          <TouchableOpacity
            style={styles.headerButton}
            activeOpacity={0.85}
            onPress={selectAll}
            disabled={allVisibleSelected}
          >
            <Ionicons
              name="checkmark-done"
              size={22}
              color={allVisibleSelected ? "#CBD5E1" : "#2563EB"}
            />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents={selectionMode && !isReadOnlyGroup ? "auto" : "none"}
        style={[
          styles.selectionActions,

          {
            opacity: isReadOnlyGroup ? 0 : selectionActionsAnim,

            transform: [
              {
                translateY: selectionActionsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },

              {
                scale: selectionActionsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleForward}
          activeOpacity={0.85}
          style={[
            styles.selectionAction,

            selectedCount === 0 && styles.disabledAction,
          ]}
          disabled={selectedCount === 0}
        >
          <Ionicons
            name="arrow-redo-outline"
            size={22}
            color={selectedCount ? "#2563EB" : "#CBD5E1"}
          />

          <Text
            style={[
              styles.selectionActionText,

              selectedCount === 0 && styles.disabledActionText,
            ]}
          >
            Forward
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.selectionAction,

            selectedCount === 0 && styles.disabledAction,
          ]}
          disabled={selectedCount === 0}
          activeOpacity={0.85}
          onPress={handleDelete}
        >
          <Ionicons
            name="trash-outline"
            size={22}
            color={selectedCount ? "#DC2626" : "#CBD5E1"}
          />

          <Text
            style={[
              styles.selectionActionText,

              selectedCount === 0 && styles.disabledActionText,
            ]}
          >
            Delete
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          <MediaTab
            title="Photos"
            icon="image-outline"
            active={selectedTab === "IMAGE"}
            onPress={() => setSelectedTab("IMAGE")}
          />

          <MediaTab
            title="Videos"
            icon="videocam-outline"
            active={selectedTab === "VIDEO"}
            onPress={() => setSelectedTab("VIDEO")}
          />

          <MediaTab
            title="Audio"
            icon="musical-notes-outline"
            active={selectedTab === "AUDIO"}
            onPress={() => setSelectedTab("AUDIO")}
          />

          <MediaTab
            title="Files"
            icon="file-document-outline"
            active={selectedTab === "FILE"}
            onPress={() => setSelectedTab("FILE")}
          />

          <MediaTab
            title="Links"
            icon="link-variant"
            active={selectedTab === "LINK"}
            onPress={() => setSelectedTab("LINK")}
          />
        </ScrollView>
      </View>

      <View style={styles.searchWrapper}>
        <Animated.View
          style={[
            styles.searchContainer,

            {
              borderColor: searchBorderColor,

              shadowOpacity: searchShadowOpacity,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color="#6B7280"
            style={styles.searchIcon}
          />

          <TextInput
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search shared media..."
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                Animated.sequence([
                  Animated.timing(focusAnim, {
                    toValue: 0.6,
                    duration: 80,
                    useNativeDriver: false,
                  }),

                  Animated.timing(focusAnim, {
                    toValue: searchFocused ? 1 : 0,
                    duration: 120,
                    useNativeDriver: false,
                  }),
                ]).start();

                setSearchQuery("");
              }}
              activeOpacity={0.8}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={22} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterChips.map((chip) => {
            const active = chip === selectedFilter;

            return (
              <TouchableOpacity
                key={chip}
                activeOpacity={0.9}
                onPress={() => handleFilterPress(chip)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterChipText,

                    active && styles.filterChipTextActive,
                  ]}
                >
                  {chip}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.resultsHeader}>
        <View>
          <Text style={styles.resultsText}>
            {visibleItems.length} result
            {visibleItems.length === 1 ? "" : "s"}
          </Text>

          <Text style={styles.sortLabel}>Sorted by {currentSortLabel}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.inlineSortButton}
          onPress={() => setSortVisible(true)}
        >
          <Ionicons name="swap-vertical-outline" size={18} color="#2563EB" />

          <Text style={styles.inlineSortText}>Change</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.content,

          {
            opacity: listOpacity,
          },
        ]}
      >
        {loading ? (
          <SharedMediaSkeleton type={selectedTab} />
        ) : error && items.length === 0 ? (
          <View style={styles.errorState}>
            <Ionicons name="alert-circle-outline" size={46} color="#94A3B8" />

            <Text style={styles.errorStateText}>{error}</Text>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.errorRetryButton}
              onPress={() => void loadSharedMedia()}
            >
              <Text style={styles.errorRetryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : visibleItems.length === 0 ? (
          searchQuery.trim().length > 0 ? (
            <View style={styles.searchEmpty}>
              <Ionicons name="search-outline" size={54} color="#CBD5E1" />

              <Text style={styles.searchEmptyTitle}>
                No matching media found
              </Text>

              <Text style={styles.searchEmptySubtitle}>
                Try a different filename, link, or keyword.
              </Text>
            </View>
          ) : (
            <EmptySharedMedia type={selectedTab} />
          )
        ) : (
          mediaContent
        )}
      </Animated.View>

      <SharedMediaSortSheet
        visible={sortVisible}
        selected={sortOption}
        onClose={() => setSortVisible(false)}
        onSelect={(option) => {
          setSortOption(option);

          setSortVisible(false);
        }}
      />

      <AppFeedbackModal
        visible={feedbackVisible}
        type={feedbackType}
        title={feedbackTitle}
        message={feedbackMessage}
        buttonText={feedbackButtonText}
        secondaryButtonText={feedbackSecondaryButtonText}
        loading={feedbackLoading}
        onClose={handleFeedbackClose}
        onSecondaryPress={handleFeedbackSecondaryPress}
      />
    </SafeAreaView>
  );
}

type MediaTabProps = {
  title: string;
  icon: string;
  active: boolean;
  onPress: () => void;
};

const MediaTab = React.memo(function MediaTab({
  title,
  icon,
  active,
  onPress,
}: MediaTabProps) {
  const isMaterial =
    icon === "file-document-outline" || icon === "link-variant";

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.tab, active && styles.activeTab]}
    >
      {isMaterial ? (
        <MaterialCommunityIcons
          name={icon as any}
          size={22}
          color={active ? "#2563EB" : "#6B7280"}
        />
      ) : (
        <Ionicons
          name={icon as any}
          size={22}
          color={active ? "#2563EB" : "#6B7280"}
        />
      )}

      <Text style={[styles.tabText, active && styles.activeTabText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  tabsContainer: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },

  tab: {
    width: 76,
    height: 62,
    marginHorizontal: 3,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  activeTab: {
    backgroundColor: "#EDF4FF",
  },

  tabText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },

  activeTabText: {
    color: "#2563EB",
  },

  tabsWrapper: {
    marginTop: 8,
    marginHorizontal: 18,
    marginBottom: 7,

    borderRadius: 22,

    backgroundColor: "#FFFFFF",

    shadowColor: "#2563EB",
    shadowOpacity: 0.05,
    shadowRadius: 10,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 3,
  },

  headerShell: {
    height: 86,
    position: "relative",
  },

  headerLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  header: {
    height: 86,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
  },

  headerButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
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

  titleContainer: {
    flex: 1,
    alignItems: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0B1545",
  },

  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#69708A",
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

  searchWrapper: {
    marginHorizontal: 18,
    marginBottom: 8,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",

    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    backgroundColor: "#FFFFFF",

    shadowColor: "#2563EB",
    shadowRadius: 12,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 4,
  },

  searchIcon: {
    marginLeft: 18,
  },

  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: "#0B1545",
  },

  clearButton: {
    paddingHorizontal: 16,
    height: "100%",
    justifyContent: "center",
  },

  filterWrapper: {
    marginBottom: 10,
  },

  filterScroll: {
    paddingHorizontal: 18,
  },

  filterChip: {
    height: 38,
    paddingHorizontal: 18,
    marginRight: 10,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF2FF",

    shadowColor: "#2563EB",
    shadowOpacity: 0.04,
    shadowRadius: 8,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
  },

  filterChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },

  filterChipText: {
    color: "#69708A",
    fontSize: 14,
    fontWeight: "600",
  },

  filterChipTextActive: {
    color: "#FFFFFF",
  },

  resultsText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },

  resultsHeader: {
    paddingHorizontal: 20,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sortLabel: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B",
  },

  inlineSortButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },

  inlineSortText: {
    marginLeft: 6,
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 13,
  },

  content: {
    flex: 1,
    paddingTop: 8,
  },

  searchEmpty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },

  searchEmptyTitle: {
    marginTop: 18,
    fontSize: 19,
    fontWeight: "700",
    color: "#0B1545",
  },

  searchEmptySubtitle: {
    marginTop: 8,
    textAlign: "center",
    color: "#64748B",
    lineHeight: 22,
  },

  errorState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 38,
  },

  errorStateText: {
    marginTop: 14,
    textAlign: "center",
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
  },

  errorRetryButton: {
    marginTop: 18,
    minWidth: 120,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "#EFF6FF",
  },

  errorRetryText: {
    color: "#2563EB",
    fontSize: 14,
    fontWeight: "700",
  },

  selectionHeader: {
    height: 86,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
  },

  selectionTitleContainer: {
    flex: 1,
    alignItems: "center",
  },

  selectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0B1545",
  },

  selectionActions: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 2,
    paddingBottom: 12,
    zIndex: 10,
  },

  selectionAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 130,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",

    shadowColor: "#2563EB",
    shadowOpacity: 0.06,
    shadowRadius: 8,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
  },

  selectionActionText: {
    marginLeft: 8,
    fontWeight: "600",
    color: "#111827",
  },

  disabledAction: {
    backgroundColor: "#F8FAFC",
  },

  disabledActionText: {
    color: "#CBD5E1",
  },
});
