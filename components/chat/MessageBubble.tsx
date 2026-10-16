import { API_BASE_URL } from "@/src/services/api/apiClient";
import React, { useState, useEffect } from "react";
import { Audio } from "expo-av";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";

import { Image } from "expo-image";

import { Message } from "@/src/types/chat.types";
import { decryptRemoteMedia } from "@/src/utils/mediaPipeline";
import { useMediaCacheStore } from "@/src/store/chat/mediaCacheStore";
import ImageViewerModal from "../media/ImageViewerModal";
import VideoViewerModal from "../media/VideoViewerModal";
import { openDocuments } from "@/src/utils/openDocuments";
import { FeedbackType } from "@/src/components/AppFeedbackModal";

type Props = {
  message: Message;
  isMe: boolean;

  onRetry?: (message: Message) => void;

  searchQuery?: string;
  isActiveSearchMatch?: boolean;
  onReplyPress?: (message: Message) => void;
  showFeedback?: (type: FeedbackType, title: string, message: string) => void;
};

const MEDIA_WIDTH = 238;
const MEDIA_HEIGHT = 190;

const AUDIO_WIDTH = 248;
const DOCUMENT_WIDTH = 270;

const TEXT_PREVIEW_LINES = 15;
const TEXT_LOAD_MORE_LINES = 15;

const MessageBubbleComponent: React.FC<Props> = ({
  message,
  isMe,
  onRetry,
  searchQuery = "",
  isActiveSearchMatch = false,
  onReplyPress,
  showFeedback,
}) => {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [decryptedUri, setDecryptedUri] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [showVideoViewer, setShowVideoViewer] = useState(false);
  const [showAudioViewer, setShowAudioViewer] = useState(false);
  const [thumbnailLoading, setThumbnailLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);

  const [textLayoutLines, setTextLayoutLines] = useState<
    Array<{ text: string }>
  >([]);

  const [hasMeasuredText, setHasMeasuredText] = useState(false);
  const [visibleTextLines, setVisibleTextLines] = useState(TEXT_PREVIEW_LINES);

  const textContent =
    typeof message.messageContent === "string" ? message.messageContent : "";

  useEffect(() => {
    setTextLayoutLines([]);
    setHasMeasuredText(false);
    setVisibleTextLines(TEXT_PREVIEW_LINES);
  }, [message.id, textContent, searchQuery, isActiveSearchMatch]);

  const handleTextLayout = (event: {
    nativeEvent: {
      lines: Array<{ text: string }>;
    };
  }) => {
    if (hasMeasuredText) {
      return;
    }

    setTextLayoutLines(event.nativeEvent.lines);
    setHasMeasuredText(true);
  };

  const formattedTime = new Date(message.createdAt).toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
  );

  const MEDIA_WIDTH = 238;
  const MEDIA_HEIGHT = 190;

  const DOCUMENT_WIDTH = 270;
  const AUDIO_WIDTH = 248;

  const COLORS = {
    primary: "#2563EB",
    primaryDark: "#1D4ED8",

    myBubble: "#EAF2FF",
    theirBubble: "#FFFFFF",

    text: "#18181B",
    secondaryText: "#71717A",
    mutedText: "#A1A1AA",

    border: "#EAECEF",
    surface: "#F4F4F5",
    surfaceBlue: "#EFF6FF",

    success: "#2563EB",
    warning: "#F59E0B",
    danger: "#EF4444",

    mediaBackground: "#F4F7FD",
  };

  const bubbleRadius = 20;
  const bubbleBackground = isMe ? COLORS.myBubble : COLORS.theirBubble;
  const secondaryTextColor = COLORS.secondaryText;
  const replyTo = message.replyTo;

  const getReplyPreviewText = (repliedMessage?: Message | null) => {
    if (!repliedMessage) {
      return "Message";
    }

    if (repliedMessage.deletedForAll) {
      return "This message was deleted";
    }

    const contentType = String(
      repliedMessage.contentType || "TEXT",
    ).toUpperCase();

    const content =
      typeof repliedMessage.messageContent === "string"
        ? repliedMessage.messageContent.trim()
        : "";

    if (contentType === "TEXT" || contentType === "LINK") {
      return content || "Message";
    }

    if (contentType === "IMAGE") {
      return content ? `Photo: ${content}` : "Photo";
    }

    if (contentType === "VIDEO") {
      return content ? `Video: ${content}` : "Video";
    }

    if (contentType === "AUDIO") {
      return content ? `Audio: ${content}` : "Voice message";
    }

    if (contentType === "FILE") {
      return repliedMessage.fileName
        ? `File: ${repliedMessage.fileName}`
        : "Document";
    }

    return content || "Message";
  };

  const getReplyPreviewIcon = (
    repliedMessage?: Message | null,
  ): keyof typeof Ionicons.glyphMap => {
    if (!repliedMessage) {
      return "chatbubble-outline";
    }

    if (repliedMessage.deletedForAll) {
      return "trash-outline";
    }

    switch (String(repliedMessage.contentType || "TEXT").toUpperCase()) {
      case "IMAGE":
        return "image-outline";

      case "VIDEO":
        return "videocam-outline";

      case "AUDIO":
        return "mic-outline";

      case "FILE":
        return "document-outline";

      case "LINK":
        return "link-outline";

      default:
        return "chatbubble-outline";
    }
  };

  const getReplySenderLabel = (repliedMessage?: Message | null) => {
    if (!repliedMessage) {
      return "Replied message";
    }

    if (Number(repliedMessage.senderId) === Number(message.senderId)) {
      return isMe ? "You" : "Them";
    }

    return "Message";
  };

  const getStatusColor = () => {
    if (message.uploadStatus === "QUEUED") {
      return COLORS.warning;
    }

    if (message.uploadStatus === "UPLOADING") {
      return COLORS.primary;
    }

    if (message.status === "READ") {
      return "#60A5FA";
    }

    return secondaryTextColor;
  };

  const getStatusIcon = () => {
    if (message.uploadStatus === "QUEUED") {
      return "time-outline";
    }

    if (message.uploadStatus === "UPLOADING") {
      return "cloud-upload-outline";
    }

    if (message.status === "READ") {
      return "checkmark-done";
    }

    if (message.status === "DELIVERED") {
      return "checkmark-done";
    }

    return "checkmark";
  };

  const getFileExtension = () => {
    return message.fileName?.split(".").pop()?.toUpperCase() || "FILE";
  };

  const getDocumentIcon = () => {
    const ext = getFileExtension().toLowerCase();

    switch (ext) {
      case "pdf":
        return "document-text";

      case "doc":
      case "docx":
        return "document";

      case "xls":
      case "xlsx":
      case "csv":
        return "grid";

      case "ppt":
      case "pptx":
        return "easel";

      case "zip":
      case "rar":
      case "7z":
        return "archive";

      default:
        return "document-outline";
    }
  };

  const getFileBadgeColor = () => {
    const ext = getFileExtension().toLowerCase();

    switch (ext) {
      case "pdf":
        return "#EF4444";

      case "doc":
      case "docx":
        return "#2563EB";

      case "xls":
      case "xlsx":
      case "csv":
        return "#16A34A";

      case "ppt":
      case "pptx":
        return "#F97316";

      case "zip":
      case "rar":
      case "7z":
        return "#71717A";

      default:
        return "#2563EB";
    }
  };

  const formatDuration = (duration?: number | null) => {
    if (!duration) {
      return "0:00";
    }

    const totalSeconds = Math.floor(duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatPlaybackTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getCachedMedia = useMediaCacheStore((state) => state.getCachedMedia);

  const mediaUrl = message.mediaUrl
    ? `${API_BASE_URL}${message.mediaUrl}`
    : null;

  const displayMedia =
    message.uploadStatus === "UPLOADING" || message.uploadStatus === "FAILED"
      ? message.localUri || message.mediaUrl || null
      : decryptedUri || mediaUrl;

  const fileMeta = message.fileSize
    ? `${getFileExtension()} • ${Math.max(
        1,
        Math.round(Number(message.fileSize) / 1024),
      )} KB`
    : getFileExtension();

  useEffect(() => {
    let mounted = true;

    const decryptMedia = async () => {
      if (message.deletedForAll) {
        setDecryptedUri(null);
        return;
      }
      if (
        !message.mediaUrl ||
        !message.isMediaEncrypted ||
        !message.encryptedMediaKey ||
        !message.mediaKeyIV
      ) {
        return;
      }

      if (
        message.contentType !== "IMAGE" &&
        message.contentType !== "VIDEO" &&
        message.contentType !== "AUDIO" &&
        message.contentType !== "FILE"
      ) {
        return;
      }

      try {
        const cached = getCachedMedia(String(message.id));

        if (cached) {
          if (mounted) {
            setDecryptedUri(cached);
          }
          return;
        }

        setIsDecrypting(true);

        const decrypted = await decryptRemoteMedia({
          mediaUrl: message.mediaUrl!,
          encryptedMediaKey: message.encryptedMediaKey!,
          mediaKeyIV: message.mediaKeyIV!,
          mediaKeyAuthTag: message.mediaKeyAuthTag,
          mimeType: message.mimeType,
          fileName: message.fileName,
        });

        if (mounted) {
          setDecryptedUri(decrypted);
        }
      } catch (error) {
        console.error("Error decrypting media:", error);
      } finally {
        if (mounted) {
          setIsDecrypting(false);
        }
      }
    };

    decryptMedia();

    return () => {
      mounted = false;
    };
  }, [
    message.id,
    message.mediaUrl,
    message.encryptedMediaKey,
    message.mediaKeyIV,
    message.deletedForAll,
    message.contentType,
    getCachedMedia,
    showVideoViewer,
  ]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const openLink = async (value: string) => {
    try {
      let url = value.trim();

      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }

      await Linking.openURL(url);
    } catch (error) {
      console.log("OPEN LINK ERROR:", error);
    }
  };

  const playPauseAudio = async () => {
    try {
      let playableUri = displayMedia;

      if (message.isMediaEncrypted) {
        const fileInfo = playableUri
          ? await FileSystem.getInfoAsync(playableUri)
          : { exists: false };

        if (!fileInfo.exists) {
          if (
            !message.mediaUrl ||
            !message.encryptedMediaKey ||
            !message.mediaKeyIV
          ) {
            return;
          }

          const decrypted = await decryptRemoteMedia({
            mediaUrl: message.mediaUrl!,
            encryptedMediaKey: message.encryptedMediaKey!,
            mediaKeyIV: message.mediaKeyIV!,
            mediaKeyAuthTag: message.mediaKeyAuthTag,
            mimeType: message.mimeType,
            fileName: message.fileName,
          });

          setDecryptedUri(decrypted);

          playableUri = decrypted;
        }
      }

      if (!playableUri) {
        return;
      }

      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: playableUri },
          { shouldPlay: true },
        );

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            return;
          }

          setPosition(status.positionMillis);

          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
          }
        });

        setSound(newSound);
        setIsPlaying(true);

        return;
      }

      const status = await sound.getStatusAsync();

      if (!status.isLoaded) {
        return;
      }

      if (status.isPlaying) {
        await sound.pauseAsync();
        setIsPlaying(false);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      console.log("AUDIO PLAYBACK ERROR:", error);
    }
  };

  const renderHighlightedText = (text: string) => {
    const query = searchQuery.trim();

    if (!query) {
      return <Text style={styles.messageText}>{text}</Text>;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(`(${escapedQuery})`, "gi");
    const parts = text.split(regex);

    return (
      <Text style={styles.messageText}>
        {parts.map((part, index) => {
          const isMatch = part.toLowerCase() === query.toLowerCase();

          if (!isMatch) {
            return <React.Fragment key={index}>{part}</React.Fragment>;
          }

          return (
            <Text
              key={index}
              style={[
                styles.searchHighlight,
                isActiveSearchMatch && styles.activeSearchHighlight,
              ]}
            >
              {part}
            </Text>
          );
        })}
      </Text>
    );
  };

  const renderHighlightedTextParts = (text: string) => {
    const query = searchQuery.trim();
    if (!query) {
      return <>{text}</>;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const regex = new RegExp(`(${escapedQuery})`, "gi");
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) => {
          const isMatch = part.toLowerCase() === query.toLowerCase();

          if (!isMatch) {
            return <React.Fragment key={index}>{part}</React.Fragment>;
          }

          return (
            <Text
              key={index}
              style={[
                styles.searchHighlight,
                isActiveSearchMatch && styles.activeSearchHighlight,
              ]}
            >
              {part}
            </Text>
          );
        })}
      </>
    );
  };

  const renderInlineTextMeta = () => (
    <Text style={styles.inlineMetaText}>
      {message.editedAt ? "  Edited  " : "  "}
      {formattedTime}

      {message.uploadStatus === "FAILED" && (
        <Text style={styles.inlineRetryText} onPress={() => onRetry?.(message)}>
          {"  Retry"}
        </Text>
      )}

      {isMe && (
        <Ionicons
          name={getStatusIcon() as any}
          size={13}
          color={getStatusColor()}
        />
      )}
    </Text>
  );

  const renderReplyPreview = () => {
    if (!replyTo) {
      return null;
    }

    const replyPreviewText = getReplyPreviewText(replyTo);
    const replyIcon = getReplyPreviewIcon(replyTo);
    const replySenderLabel = getReplySenderLabel(replyTo);

    return (
      <TouchableOpacity
        activeOpacity={0.72}
        onPress={() => {
          onReplyPress?.(replyTo);
        }}
        disabled={!onReplyPress}
        style={[
          styles.replyPreview,
          isMe ? styles.myReplyPreview : styles.theirReplyPreview,
        ]}
      >
        <View
          style={[
            styles.replyAccent,
            isMe ? styles.myReplyAccent : styles.theirReplyAccent,
          ]}
        />

        <View style={styles.replyPreviewContent}>
          <View style={styles.replyPreviewHeader}>
            <Ionicons name={replyIcon} size={13} color="#2563EB" />

            <Text style={styles.replySender} numberOfLines={1}>
              {replySenderLabel}
            </Text>
          </View>

          <Text style={styles.replyPreviewText} numberOfLines={2}>
            {replyPreviewText}
          </Text>
        </View>

        {onReplyPress && (
          <Ionicons
            name="chevron-forward"
            size={15}
            color="#94A3B8"
            style={styles.replyChevron}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderDeletedMessage = () => (
    <View style={styles.deletedMessageRow}>
      <View style={styles.deletedMessageContent}>
        <Ionicons
          name="ban-outline"
          size={16}
          color="#71717A"
          style={styles.deletedMessageIcon}
        />

        <Text style={styles.deletedMessageText}>
          {isMe ? "You deleted this message" : "This message was deleted"}
        </Text>
      </View>

      <Text style={styles.deletedMessageTimestamp}>{formattedTime}</Text>
    </View>
  );

  const renderMessageMeta = (compact = false) => (
    <View style={[styles.metaRow, compact && styles.compactMetaRow]}>
      {message.editedAt && <Text style={styles.editedText}>Edited</Text>}

      <Text style={styles.timestampText}>{formattedTime}</Text>

      {message.uploadStatus === "FAILED" && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => onRetry?.(message)}
        >
          <Ionicons name="refresh-outline" size={12} color="#FFFFFF" />

          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}

      {isMe && (
        <Ionicons
          name={getStatusIcon() as any}
          size={15}
          color={getStatusColor()}
          style={styles.statusIcon}
        />
      )}
    </View>
  );

  // ============================================================
  // PHASE 7 — STEP 2: DIRECT MEDIA CAPTION RENDERING
  // Captions for IMAGE/VIDEO/AUDIO/FILE messages are stored in
  // message.messageContent. Render them directly beneath the
  // associated media instead of treating them as a separate
  // text message.
  // ============================================================
  const renderMediaCaption = () => {
    const caption = textContent.trim();

    if (!caption) {
      return null;
    }

    return (
      <View style={styles.mediaCaptionContainer}>
        <Text style={styles.mediaCaptionText}>
          {renderHighlightedTextParts(textContent)}
        </Text>
      </View>
    );
  };

  const renderCompactTextContent = () => {
    if (message.contentType === "LINK") {
      return (
        <View style={styles.compactMessageRow}>
          <View style={styles.compactMessageContent}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => openLink(message.messageContent || "")}
              style={styles.compactLinkTouchable}
            >
              {searchQuery.trim() ? (
                <Text style={styles.linkText}>
                  {renderHighlightedText(message.messageContent || "")}
                </Text>
              ) : (
                <Text style={styles.linkText}>{message.messageContent}</Text>
              )}
            </TouchableOpacity>
          </View>

          {renderMessageMeta(true)}
        </View>
      );
    }

    const hasMoreText =
      hasMeasuredText && textLayoutLines.length > visibleTextLines;

    let displayText = textContent;

    if (hasMoreText) {
      const contentLineCount = Math.max(1, visibleTextLines - 1);
      const characterCount = textLayoutLines
        .slice(0, contentLineCount)
        .reduce((total, line) => total + line.text.length, 0);

      displayText = textContent.slice(0, characterCount).trimEnd();
    }

    return (
      <Text
        style={styles.messageText}
        onTextLayout={hasMeasuredText ? undefined : handleTextLayout}
      >
        {renderHighlightedTextParts(displayText)}

        {hasMoreText && (
          <Text
            style={styles.readMoreText}
            onPress={() => {
              setVisibleTextLines((current) => current + TEXT_LOAD_MORE_LINES);
            }}
            accessibilityRole="button"
          >
            {"... Read more"}
          </Text>
        )}

        {renderInlineTextMeta()}
      </Text>
    );
  };

  const bubbleStyle = isMe ? styles.myBubble : styles.theirBubble;

  return (
    <View
      style={[
        styles.container,
        isMe ? styles.myContainer : styles.theirContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          bubbleStyle,
          {
            backgroundColor: bubbleBackground,
            borderRadius: bubbleRadius,
          },
        ]}
      >
        {message.deletedForAll ? (
          renderDeletedMessage()
        ) : (
          <>
            {message.isForwarded && (
              <View style={styles.forwardedRow}>
                <Ionicons name="arrow-redo-outline" size={14} color="#71717A" />

                <Text style={styles.forwardedText}>Forwarded</Text>
              </View>
            )}

            {renderReplyPreview()}

            {(message.contentType === "TEXT" ||
              message.contentType === "LINK") &&
              renderCompactTextContent()}

            {isDecrypting && (
              <View style={styles.uploadOverlay}>
                <View style={styles.overlayStatus}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={16}
                    color="#FFFFFF"
                  />

                  <Text style={styles.uploadText}>Decrypting...</Text>
                </View>
              </View>
            )}

            {message.contentType === "IMAGE" && displayMedia && (
              <>
                <View style={styles.mediaWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setShowImageViewer(true)}
                  >
                    <Image
                      source={displayMedia}
                      style={[
                        styles.image,
                        {
                          width: MEDIA_WIDTH,
                          height: MEDIA_HEIGHT,
                        },
                      ]}
                      contentFit="cover"
                      transition={200}
                      cachePolicy="memory-disk"
                    />

                    <View
                      pointerEvents="none"
                      style={styles.mediaViewIndicator}
                    >
                      <Ionicons
                        name="expand-outline"
                        size={15}
                        color="#FFFFFF"
                      />
                    </View>
                  </TouchableOpacity>

                  {message.uploadStatus === "UPLOADING" && (
                    <View style={styles.uploadOverlay}>
                      <View style={styles.overlayStatus}>
                        <Ionicons
                          name="cloud-upload-outline"
                          size={17}
                          color="#FFFFFF"
                        />

                        <Text style={styles.uploadText}>
                          {message.uploadProgress || 0}%
                        </Text>
                      </View>
                    </View>
                  )}

                  {message.uploadStatus === "FAILED" && (
                    <View style={styles.failedOverlay}>
                      <View style={styles.overlayStatus}>
                        <Ionicons
                          name="alert-circle-outline"
                          size={18}
                          color="#FFFFFF"
                        />

                        <Text style={styles.failedText}>Upload Failed</Text>
                      </View>
                    </View>
                  )}
                </View>
                {renderMediaCaption()}
              </>
            )}

            {message.contentType === "VIDEO" && (
              <>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setShowVideoViewer(true)}
                >
                  <View
                    style={[
                      styles.mediaWrapper,
                      {
                        width: MEDIA_WIDTH,
                        height: MEDIA_HEIGHT,
                      },
                    ]}
                  >
                    {(() => {
                      const thumbnailSource = message.thumbnailUrl
                        ? `${API_BASE_URL}${message.thumbnailUrl}`
                        : message.thumbnailUri || message.localUri;

                      return (
                        <Image
                          source={thumbnailSource}
                          style={[
                            styles.video,
                            {
                              width: MEDIA_WIDTH,
                              height: MEDIA_HEIGHT,
                            },
                          ]}
                          contentFit="cover"
                          onLoad={() => setThumbnailLoading(false)}
                          onError={() => setThumbnailLoading(false)}
                        />
                      );
                    })()}

                    {thumbnailLoading && (
                      <View style={styles.loadingOverlay}>
                        <View style={styles.overlayStatus}>
                          <Ionicons
                            name="image-outline"
                            size={17}
                            color="#FFFFFF"
                          />

                          <Text style={styles.loadingText}>Loading...</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.playOverlay}>
                      <Ionicons name="play" size={27} color="#FFFFFF" />
                    </View>

                    <View style={styles.durationBadge}>
                      <Ionicons
                        name="videocam-outline"
                        size={12}
                        color="#FFFFFF"
                      />

                      <Text style={styles.durationText}>
                        {formatDuration(message.duration)}
                      </Text>
                    </View>

                    <View
                      pointerEvents="none"
                      style={styles.mediaViewIndicator}
                    >
                      <Ionicons
                        name="expand-outline"
                        size={15}
                        color="#FFFFFF"
                      />
                    </View>

                    {message.uploadStatus === "UPLOADING" && (
                      <View style={styles.uploadOverlay}>
                        <View style={styles.overlayStatus}>
                          <Ionicons
                            name="cloud-upload-outline"
                            size={17}
                            color="#FFFFFF"
                          />

                          <Text style={styles.uploadText}>
                            {message.uploadProgress || 0}%
                          </Text>
                        </View>
                      </View>
                    )}

                    {message.uploadStatus === "FAILED" && (
                      <View style={styles.failedOverlay}>
                        <View style={styles.overlayStatus}>
                          <Ionicons
                            name="alert-circle-outline"
                            size={18}
                            color="#FFFFFF"
                          />

                          <Text style={styles.failedText}>Upload Failed</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                {renderMediaCaption()}
              </>
            )}

            {message.contentType === "AUDIO" && displayMedia && (
              <>
                <TouchableOpacity
                  style={styles.audioBubble}
                  activeOpacity={0.8}
                  onPress={playPauseAudio}
                >
                  <View style={styles.audioPlayButton}>
                    <Ionicons
                      name={isPlaying ? "pause" : "play"}
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>

                  <View style={styles.audioContent}>
                    <View style={styles.waveformContainer}>
                      {(message.waveform || []).map((value, index) => {
                        const progress =
                          message.duration && message.duration > 0
                            ? position / message.duration
                            : 0;

                        const playedBars = Math.floor(
                          progress * (message.waveform?.length || 1),
                        );

                        return (
                          <View
                            key={index}
                            style={[
                              styles.waveBar,
                              {
                                height: Math.max(4, value / 2),
                                backgroundColor:
                                  index <= playedBars ? "#2563EB" : "#CBD5E1",
                              },
                            ]}
                          />
                        );
                      })}
                    </View>

                    <View style={styles.audioMetaRow}>
                      <Text style={styles.audioDuration}>
                        {formatPlaybackTime(position)} /{" "}
                        {formatDuration(message.duration)}
                      </Text>

                      <Ionicons
                        name="volume-medium-outline"
                        size={13}
                        color="#71717A"
                      />
                    </View>
                  </View>
                </TouchableOpacity>
                {renderMediaCaption()}
              </>
            )}

            {message.contentType === "FILE" && (
              <>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[
                    styles.documentBubble,
                    {
                      width: DOCUMENT_WIDTH,
                    },
                  ]}
                  onPress={async () => {
                    try {
                      let documentPath = displayMedia;

                      if (message.isMediaEncrypted) {
                        const fileInfo = documentPath
                          ? await FileSystem.getInfoAsync(documentPath)
                          : { exists: false };

                        if (!fileInfo.exists) {
                          const decrypted = await decryptRemoteMedia({
                            mediaUrl: message.mediaUrl!,
                            encryptedMediaKey: message.encryptedMediaKey!,
                            mediaKeyIV: message.mediaKeyIV!,
                            mediaKeyAuthTag: message.mediaKeyAuthTag,
                            mimeType: message.mimeType,
                            fileName: message.fileName,
                          });

                          setDecryptedUri(decrypted);

                          documentPath = decrypted;
                        }
                      }

                      if (!documentPath) {
                        return;
                      }

                      await openDocuments(
                        documentPath,
                        showFeedback ?? (() => {}),
                      );
                    } catch (error) {
                      // console.log("OPEN DOCUMENT ERROR", error);
                    }
                  }}
                >
                  <View style={styles.documentRow}>
                    <View
                      style={[
                        styles.fileBadge,
                        {
                          backgroundColor: getFileBadgeColor(),
                        },
                      ]}
                    >
                      <Ionicons
                        name={getDocumentIcon() as any}
                        size={21}
                        color="#FFFFFF"
                      />
                    </View>

                    <View style={styles.fileInfo}>
                      <Text style={styles.documentName} numberOfLines={1}>
                        {message.fileName}
                      </Text>

                      <Text style={styles.documentType}>{fileMeta}</Text>
                    </View>

                    <TouchableOpacity activeOpacity={0.7}>
                      <View style={styles.downloadButton}>
                        <Ionicons
                          name="download-outline"
                          size={17}
                          color="#2563EB"
                        />
                      </View>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
                {renderMediaCaption()}
              </>
            )}

            {message.contentType !== "TEXT" &&
              message.contentType !== "LINK" &&
              renderMessageMeta()}
          </>
        )}
      </View>

      <ImageViewerModal
        visible={showImageViewer}
        imageUri={displayMedia || ""}
        onClose={() => setShowImageViewer(false)}
      />

      <VideoViewerModal
        visible={showVideoViewer}
        videoUri={displayMedia || ""}
        onClose={() => setShowVideoViewer(false)}
      />
    </View>
  );
};

export default React.memo(MessageBubbleComponent, (prev, next) => {
  return (
    prev.isMe === next.isMe &&
    prev.message.id === next.message.id &&
    prev.message.status === next.message.status &&
    prev.message.uploadProgress === next.message.uploadProgress &&
    prev.message.uploadStatus === next.message.uploadStatus &&
    prev.message.messageContent === next.message.messageContent &&
    prev.message.editedAt === next.message.editedAt &&
    prev.message.deletedForAll === next.message.deletedForAll &&
    prev.message.deletedById === next.message.deletedById &&
    prev.message.deletedAt === next.message.deletedAt &&
    prev.message.contentType === next.message.contentType &&
    prev.message.isForwarded === next.message.isForwarded &&
    prev.message.forwardedFromMessageId ===
      next.message.forwardedFromMessageId &&
    prev.message.mediaUrl === next.message.mediaUrl &&
    prev.searchQuery === next.searchQuery &&
    prev.isActiveSearchMatch === next.isActiveSearchMatch &&
    prev.message.replyToId === next.message.replyToId &&
    prev.message.replyTo?.id === next.message.replyTo?.id &&
    prev.message.replyTo?.messageContent ===
      next.message.replyTo?.messageContent &&
    prev.message.replyTo?.contentType === next.message.replyTo?.contentType &&
    prev.message.replyTo?.deletedForAll ===
      next.message.replyTo?.deletedForAll &&
    prev.onReplyPress === next.onReplyPress
  );
});

const styles = StyleSheet.create({
  /*
   * The outer row is only responsible for positioning.
   * It must NOT determine the bubble width.
   */
  container: {
    width: "100%",
    marginVertical: 2,
    paddingHorizontal: 0,
  },

  myContainer: {
    alignItems: "flex-end",
  },

  theirContainer: {
    alignItems: "flex-start",
  },

  /*
   * Content-driven bubble:
   *
   * - no width
   * - no flex
   * - only maxWidth
   *
   * Therefore short content determines the width.
   */
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "86%",
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
  },

  myBubble: {
    alignSelf: "flex-end",

    backgroundColor: "#EAF2FF",

    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 7,
  },

  theirBubble: {
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

  replyPreview: {
    width: "100%",

    flexDirection: "row",
    alignItems: "stretch",

    minHeight: 48,
    marginBottom: 7,

    borderRadius: 12,

    overflow: "hidden",

    backgroundColor: "#F4F7FD",
  },

  myReplyPreview: {
    backgroundColor: "#DCEAFF",
  },

  theirReplyPreview: {
    backgroundColor: "#F4F4F5",
  },

  replyAccent: {
    width: 4,
  },

  myReplyAccent: {
    backgroundColor: "#2563EB",
  },

  theirReplyAccent: {
    backgroundColor: "#64748B",
  },

  replyPreviewContent: {
    flex: 1,
    minWidth: 0,

    justifyContent: "center",

    paddingHorizontal: 10,
    paddingVertical: 7,
  },

  replyPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },

  replySender: {
    flex: 1,
    marginLeft: 5,

    color: "#2563EB",

    fontSize: 11.5,
    fontWeight: "700",
  },

  replyPreviewText: {
    color: "#52525B",

    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },

  replyChevron: {
    alignSelf: "center",
    marginRight: 8,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 19,
    color: "#18181B",
    fontWeight: "400",
    includeFontPadding: false,
  },

  mediaCaptionContainer: {
    width: "100%",
    paddingHorizontal: 3,
    paddingTop: 7,
    paddingBottom: 1,
  },

  mediaCaptionText: {
    fontSize: 15,
    lineHeight: 19,
    color: "#18181B",
    fontWeight: "400",
    includeFontPadding: false,
  },

  readMoreText: {
    fontSize: 15,
    lineHeight: 19,
    color: "#2563EB",
    fontWeight: "700",
    includeFontPadding: false,
  },

  inlineMetaText: {
    fontSize: 10,
    lineHeight: 15,
    color: "#71717A",
    fontWeight: "500",
    includeFontPadding: false,
  },

  inlineRetryText: {
    color: "#EF4444",
    fontWeight: "700",
  },

  linkText: {
    fontSize: 15,
    lineHeight: 19,
    color: "#2563EB",
    textDecorationLine: "underline",
    fontWeight: "500",
    includeFontPadding: false,
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

  forwardedRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },

  forwardedText: {
    marginLeft: 5,

    fontSize: 11,
    fontStyle: "italic",
    color: "#71717A",
    fontWeight: "500",
  },

  mediaWrapper: {
    position: "relative",

    overflow: "hidden",

    width: 238,
    height: 190,

    borderRadius: 16,

    backgroundColor: "#F4F7FD",
  },

  image: {
    width: 238,
    height: 190,

    borderRadius: 16,

    backgroundColor: "#F4F7FD",
  },

  video: {
    width: 238,
    height: 190,

    borderRadius: 16,

    backgroundColor: "#F4F7FD",
  },

  mediaViewIndicator: {
    position: "absolute",

    top: 9,
    right: 9,

    width: 29,
    height: 29,

    borderRadius: 15,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(24,24,27,0.48)",
  },

  playOverlay: {
    position: "absolute",

    top: "50%",
    left: "50%",

    width: 56,
    height: 56,

    marginLeft: -28,
    marginTop: -28,

    borderRadius: 28,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(24,24,27,0.55)",

    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  durationBadge: {
    position: "absolute",

    bottom: 8,
    left: 8,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 8,
    paddingVertical: 5,

    borderRadius: 10,

    backgroundColor: "rgba(24,24,27,0.72)",
  },

  durationText: {
    marginLeft: 4,

    color: "#FFFFFF",

    fontSize: 11,
    fontWeight: "700",

    letterSpacing: 0.15,
  },

  audioBubble: {
    width: AUDIO_WIDTH,

    flexDirection: "row",
    alignItems: "center",

    paddingVertical: 3,
  },

  audioPlayButton: {
    width: 44,
    height: 44,

    borderRadius: 22,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "#2563EB",

    shadowColor: "#2563EB",
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 2,
  },

  audioContent: {
    flex: 1,

    marginLeft: 12,

    overflow: "hidden",
  },

  waveformContainer: {
    height: 29,

    flexDirection: "row",
    alignItems: "flex-end",

    overflow: "hidden",
  },

  waveBar: {
    width: 3,

    borderRadius: 2,

    marginRight: 2,

    opacity: 0.9,
  },

  audioMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    marginTop: 5,

    paddingRight: 3,
  },

  audioDuration: {
    fontSize: 11,

    color: "#71717A",

    fontWeight: "500",
  },

  documentBubble: {
    width: DOCUMENT_WIDTH,
  },

  documentRow: {
    width: "100%",

    flexDirection: "row",
    alignItems: "center",
  },

  fileBadge: {
    width: 46,
    height: 46,

    borderRadius: 13,

    justifyContent: "center",
    alignItems: "center",
  },

  fileInfo: {
    flex: 1,

    marginLeft: 12,
    marginRight: 8,
  },

  documentName: {
    fontSize: 14.5,

    color: "#18181B",

    fontWeight: "700",
  },

  documentType: {
    marginTop: 3,

    fontSize: 11.5,

    color: "#71717A",

    fontWeight: "500",
  },

  downloadButton: {
    width: 34,
    height: 34,

    borderRadius: 17,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "#EFF6FF",

    marginRight: 1,
  },

  metaRow: {
    marginTop: 3,

    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },

  editedText: {
    marginRight: 5,
    fontSize: 10.5,
    color: "#71717A",
    fontWeight: "600",
    includeFontPadding: false,
  },

  timestampText: {
    fontSize: 10,

    color: "#71717A",

    fontWeight: "500",
    includeFontPadding: false,
  },

  statusIcon: {
    marginLeft: 4,
  },

  retryBtn: {
    marginLeft: 7,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 8,
    paddingVertical: 4,

    borderRadius: 10,

    backgroundColor: "#EF4444",
  },

  retryText: {
    marginLeft: 3,

    color: "#FFFFFF",

    fontSize: 10.5,

    fontWeight: "700",
  },

  uploadOverlay: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(24,24,27,0.38)",

    borderRadius: 16,
  },

  overlayStatus: {
    flexDirection: "row",
    alignItems: "center",
  },

  uploadText: {
    marginLeft: 6,

    color: "#FFFFFF",

    fontWeight: "700",

    fontSize: 14,
  },

  failedOverlay: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(239,68,68,0.35)",

    borderRadius: 16,
  },

  failedText: {
    marginLeft: 6,

    color: "#FFFFFF",

    fontWeight: "700",

    fontSize: 13,
  },

  loadingOverlay: {
    position: "absolute",

    top: 0,
    left: 0,
    right: 0,
    bottom: 0,

    justifyContent: "center",
    alignItems: "center",

    backgroundColor: "rgba(24,24,27,0.22)",

    borderRadius: 16,
  },

  loadingText: {
    marginLeft: 6,

    color: "#FFFFFF",

    fontSize: 13,

    fontWeight: "600",
  },

  searchHighlight: {
    color: "#2563EB",
    backgroundColor: "#DBEAFE",
    fontWeight: "700",
  },

  activeSearchHighlight: {
    color: "#1D4ED8",
    backgroundColor: "#BFDBFE",
    fontWeight: "800",
  },

  deletedMessageRow: {
    alignSelf: "flex-start",

    flexDirection: "row",
    alignItems: "flex-end",

    maxWidth: "100%",
  },

  deletedMessageContent: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  deletedMessageIcon: {
    marginRight: 6,
    color: "red",
  },

  deletedMessageText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 19,
    color: "#71717A",
    fontFamily: "sans-serif",
    fontStyle: "italic",
    fontWeight: "400",
    includeFontPadding: false,
  },

  deletedMessageTimestamp: {
    flexShrink: 0,
    marginLeft: 8,
    paddingBottom: 0,
    fontSize: 10.5,
    color: "#71717A",
    fontWeight: "500",
    includeFontPadding: false,
  },
});
