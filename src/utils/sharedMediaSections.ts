import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";

export type SharedMediaRow =
  | {
      type: "header";
      id: string;
      title: string;
    }
  | {
      type: "item";
      id: string;
      item: SharedMediaItem;
    };

export function buildSharedMediaRows(
  items: SharedMediaItem[],
): SharedMediaRow[] {
  const groups = new Map<string, SharedMediaItem[]>();

  const now = new Date();

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (const item of items) {
    const date = new Date(item.createdAt);

    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const diffDays = Math.floor(
      (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );

    let section: string;

    if (diffDays === 0) {
      section = "Today";
    } else if (diffDays === 1) {
      section = "Yesterday";
    } else if (diffDays < 7) {
      section = "Last 7 Days";
    } else if (diffDays < 30) {
      section = "Last 30 Days";
    } else {
      section = date.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      });
    }

    if (!groups.has(section)) {
      groups.set(section, []);
    }

    groups.get(section)!.push(item);
  }

  const rows: SharedMediaRow[] = [];

  for (const [section, media] of groups.entries()) {
    rows.push({
      type: "header",
      id: `header-${section}`,
      title: section,
    });

    for (const item of media) {
      rows.push({
        type: "item",
        id: item.id.toString(),
        item,
      });
    }
  }

  return rows;
}
