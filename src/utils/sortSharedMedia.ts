import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";

export type SharedMediaSortOption =
  | "NEWEST"
  | "OLDEST"
  | "LARGEST"
  | "SMALLEST";

const getTimestamp = (item: SharedMediaItem) => {
  const value = new Date(item.createdAt).getTime();

  return Number.isFinite(value) ? value : 0;
};

const getFileSize = (item: SharedMediaItem) => {
  return typeof item.fileSize === "number" && item.fileSize > 0
    ? item.fileSize
    : -1;
};

export default function sortSharedMedia(
  media: SharedMediaItem[],
  sortBy: SharedMediaSortOption = "NEWEST",
): SharedMediaItem[] {
  return media
    .map((item, index) => ({
      item,
      index,
    }))
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "NEWEST":
          comparison = getTimestamp(b.item) - getTimestamp(a.item);
          break;

        case "OLDEST":
          comparison = getTimestamp(a.item) - getTimestamp(b.item);
          break;

        case "LARGEST":
          comparison = getFileSize(b.item) - getFileSize(a.item);
          break;

        case "SMALLEST":
          comparison = getFileSize(a.item) - getFileSize(b.item);
          break;
      }

      // Stable ordering for equal values
      if (comparison === 0) {
        comparison = a.index - b.index;
      }

      return comparison;
    })
    .map(({ item }) => item);
}
