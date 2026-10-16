import {
  SharedMediaItem,
  SharedMediaType,
} from "@/src/services/chat/sharedMediaService";

export type SharedMediaFilterOptions = {
  query?: string;
  mediaType?: SharedMediaType;
  fromDate?: Date | null;
  toDate?: Date | null;
};

export default function filterSharedMedia(
  media: SharedMediaItem[],
  options: SharedMediaFilterOptions,
): SharedMediaItem[] {
  const { query = "", mediaType, fromDate, toDate } = options;

  const normalizedQuery = query.trim().toLowerCase();

  return media.filter((item) => {
    // --------------------------
    // Search (filename / URL / message text)
    // --------------------------

    const filename = (item.fileName ?? "").toLowerCase();

    const mediaUrl = (item.mediaUrl ?? "").toLowerCase();

    const messageText = (item.messageContent ?? "").toLowerCase();

    const matchesQuery =
      normalizedQuery.length === 0 ||
      filename.includes(normalizedQuery) ||
      mediaUrl.includes(normalizedQuery) ||
      messageText.includes(normalizedQuery);

    if (!matchesQuery) {
      return false;
    }

    // Media type
    if (mediaType && item.contentType !== mediaType) {
      return false;
    }

    // Date range
    if (fromDate || toDate) {
      const createdAt = new Date(item.createdAt);

      if (fromDate && createdAt < fromDate) {
        return false;
      }

      if (toDate && createdAt > toDate) {
        return false;
      }
    }

    return true;
  });
}
