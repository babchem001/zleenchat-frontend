import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";

export type SharedMediaSection = {
  title: string;
  data: SharedMediaItem[];
};

export function groupingSharedMedia(
  items: SharedMediaItem[],
): SharedMediaSection[] {
  const today: SharedMediaItem[] = [];
  const yesterday: SharedMediaItem[] = [];
  const lastWeek: SharedMediaItem[] = [];
  const earlier: SharedMediaItem[] = [];

  const now = new Date();

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const startOfLastWeek = new Date(startOfToday);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  for (const item of items) {
    const createdAt = new Date(item.createdAt);

    if (createdAt >= startOfToday) {
      today.push(item);
    } else if (createdAt >= startOfYesterday) {
      yesterday.push(item);
    } else if (createdAt >= startOfLastWeek) {
      lastWeek.push(item);
    } else {
      earlier.push(item);
    }
  }

  const sections: SharedMediaSection[] = [];

  if (today.length) {
    sections.push({
      title: "Today",
      data: today,
    });
  }

  if (yesterday.length) {
    sections.push({
      title: "Yesterday",
      data: yesterday,
    });
  }

  if (lastWeek.length) {
    sections.push({
      title: "Last Week",
      data: lastWeek,
    });
  }

  if (earlier.length) {
    sections.push({
      title: "Earlier",
      data: earlier,
    });
  }

  return sections;
}
