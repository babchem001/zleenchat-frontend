import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Linking,
  Animated,
  Image,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import SharedMediaSectionList from "./SharedMediaSectionList";
import { groupingSharedMedia } from "@/src/utils/groupingSharedMedia";
import { useSelectionAnimation } from "@/hooks/useSelectionAnimation";

// LINK PREVIEW CHANGE: Shared Media links load the same webpage metadata as chat previews.
type LinkPreviewData = {
  title: string;
  description: string;
  imageUrl: string | null;
  siteName: string;
};

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

const normalizeLinkUrl = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) return "";

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const getLinkPreview = async (rawUrl: string) => {
  const url = normalizeLinkUrl(rawUrl);

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
      const rawImageUrl = getMetaContent(html, [
        "og:image",
        "twitter:image",
        "twitter:image:src",
      ]);

      let imageUrl: string | null = null;

      if (rawImageUrl) {
        try {
          imageUrl = new URL(rawImageUrl, response.url || url).toString();
        } catch {
          imageUrl = rawImageUrl;
        }
      }

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
      };

      if (!preview.title && !preview.description && !preview.imageUrl) {
        linkPreviewCache.set(url, null);
        return null;
      }

      linkPreviewCache.set(url, preview);

      return preview;
    } catch (error) {
      console.log("Unable to load shared media link preview:", error);
      linkPreviewCache.set(url, null);
      return null;
    } finally {
      linkPreviewRequests.delete(url);
    }
  })();

  linkPreviewRequests.set(url, request);

  return request;
};

type Props = {
  items: SharedMediaItem[];
  refreshing?: boolean;
  onRefresh?: () => void;

  selectionMode: boolean;
  selectedItems: Set<number>;

  onEnterSelectionMode: (id: number) => void;
  onToggleSelection: (id: number) => void;
};

export default function LinkList({
  items,
  refreshing,
  onRefresh,
  selectionMode,
  selectedItems,
  onEnterSelectionMode,
  onToggleSelection,
}: Props) {
  const sections = useMemo(() => groupingSharedMedia(items), [items]);

  const renderItem = useCallback(
    (item: SharedMediaItem) => (
      <LinkRow
        item={item}
        selectionMode={selectionMode}
        selected={selectedItems.has(item.id)}
        onEnterSelectionMode={onEnterSelectionMode}
        onToggleSelection={onToggleSelection}
      />
    ),
    [selectionMode, selectedItems, onEnterSelectionMode, onToggleSelection],
  );

  return (
    <SharedMediaSectionList
      sections={sections}
      refreshing={refreshing}
      onRefresh={onRefresh}
      renderItem={renderItem}
    />
  );
}

type LinkRowProps = {
  item: SharedMediaItem;

  selectionMode: boolean;
  selected: boolean;

  onEnterSelectionMode: (id: number) => void;
  onToggleSelection: (id: number) => void;
};

const LinkRow = React.memo(function LinkRow({
  item,
  selectionMode,
  selected,
  onEnterSelectionMode,
  onToggleSelection,
}: LinkRowProps) {
  const url = useMemo(() => item.messageContent.trim(), [item.messageContent]);
  const finalUrl = useMemo(() => normalizeLinkUrl(url), [url]);
  const hostname = useMemo(() => {
    try {
      return new URL(finalUrl).hostname.replace(/^www\./i, "");
    } catch {
      return url;
    }
  }, [finalUrl, url]);

  // LINK PREVIEW CHANGE: Fetch and cache the webpage's Open Graph/Twitter data.
  const [preview, setPreview] = React.useState<LinkPreviewData | null>(() =>
    finalUrl ? (linkPreviewCache.get(finalUrl) ?? null) : null,
  );
  const [previewLoading, setPreviewLoading] = React.useState(
    !!finalUrl && !linkPreviewCache.has(finalUrl),
  );
  const [previewImageFailed, setPreviewImageFailed] = React.useState(false);

  useEffect(() => {
    let mounted = true;

    setPreviewImageFailed(false);

    if (!finalUrl) {
      setPreviewLoading(false);

      return () => {
        mounted = false;
      };
    }

    if (linkPreviewCache.has(finalUrl)) {
      setPreview(linkPreviewCache.get(finalUrl) ?? null);
      setPreviewLoading(false);

      return () => {
        mounted = false;
      };
    }

    setPreviewLoading(true);

    getLinkPreview(finalUrl).then((result) => {
      if (!mounted) return;

      setPreview(result);
      setPreviewLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [finalUrl]);

  const { scale, opacity } = useSelectionAnimation(selected);
  const openLink = useCallback(async () => {
    try {
      await Linking.openURL(finalUrl);
    } catch (error) {
      console.log("Open link error:", error);
    }
  }, [finalUrl]);

  const handleLongPress = useCallback(() => {
    onEnterSelectionMode(item.id);
  }, [item.id, onEnterSelectionMode]);

  const handlePress = useCallback(() => {
    if (selectionMode) {
      onToggleSelection(item.id);
      return;
    }

    openLink();
  }, [selectionMode, item.id, onToggleSelection, openLink]);

  return (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.card}
        onLongPress={handleLongPress}
        delayLongPress={250}
        onPress={handlePress}
      >
        {/* LINK PREVIEW CHANGE: Show a page thumbnail and metadata in the link row. */}
        <View style={styles.previewRow}>
          {preview?.imageUrl && !previewImageFailed ? (
            <Image
              source={{ uri: preview.imageUrl }}
              style={styles.previewImage}
              resizeMode="cover"
              onError={() => setPreviewImageFailed(true)}
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Ionicons name="globe-outline" size={22} color="#2563EB" />
            </View>
          )}

          <View style={styles.info}>
            <Text numberOfLines={2} style={styles.hostname}>
              {preview?.title || hostname}
            </Text>

            {preview?.description ? (
              <Text numberOfLines={2} style={styles.previewDescription}>
                {preview.description}
              </Text>
            ) : previewLoading ? (
              <Text numberOfLines={1} style={styles.previewLoading}>
                Loading preview…
              </Text>
            ) : null}

            <Text numberOfLines={1} style={styles.previewSiteName}>
              {preview?.siteName || hostname}
            </Text>
          </View>

          <Ionicons name="open-outline" size={20} color="#9CA3AF" />
        </View>

        <Text numberOfLines={2} style={styles.url}>
          {url}
        </Text>
      </TouchableOpacity>

      {selectionMode && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.selectionOverlay,
            {
              opacity: selected ? 1 : 0,
            },
          ]}
        />
      )}

      {selectionMode && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.checkmark,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={28} color="#2563EB" />
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: 12,
    paddingBottom: 24,
  },

  card: {
    flexDirection: "column",
    alignItems: "stretch",
    minHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 12,
    marginBottom: 7,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  icon: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },

  previewRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  previewImage: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: "#EEF2F7",
  },

  previewPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
  },

  info: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 12,
  },

  hostname: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  url: {
    marginTop: 8,
    fontSize: 13,
    color: "#2563EB",
  },

  previewDescription: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    color: "#667085",
  },

  previewSiteName: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 15,
    color: "#667085",
    fontWeight: "600",
  },

  previewLoading: {
    marginTop: 4,
    fontSize: 12,
    color: "#667085",
  },

  itemContainer: {
    position: "relative",
  },

  selectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(37,99,235,0.10)",
    opacity: 0,
    borderRadius: 14,
  },

  selectionOverlayActive: {
    opacity: 1,
  },

  checkmark: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});
