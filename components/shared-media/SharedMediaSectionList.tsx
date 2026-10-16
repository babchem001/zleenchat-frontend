import React, { forwardRef, useCallback, useMemo } from "react";
import { View, Text, StyleSheet, Keyboard } from "react-native";
import { FlashList, FlashListRef } from "@shopify/flash-list";

import { SharedMediaItem } from "@/src/services/chat/sharedMediaService";
import { SharedMediaSection } from "@/src/utils/groupingSharedMedia";

type Props = {
  sections: SharedMediaSection[];
  renderItem: (item: SharedMediaItem) => React.ReactElement | null;
  estimatedItemSize?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  numColumns?: number;
};

type ListItem =
  | {
      type: "header";
      title: string;
    }
  | {
      type: "item";
      item: SharedMediaItem;
    };

const SharedMediaSectionList = forwardRef<FlashListRef<ListItem>, Props>(
  function SharedMediaSectionList(
    {
      sections,
      renderItem,
      estimatedItemSize = 100,
      refreshing,
      onRefresh,
      numColumns = 1,
    },
    ref,
  ) {
    const flattened = useMemo<ListItem[]>(() => {
      const result: ListItem[] = [];

      for (const section of sections) {
        result.push({
          type: "header",
          title: section.title,
        });

        for (const item of section.data) {
          result.push({
            type: "item",
            item,
          });
        }
      }

      return result;
    }, [sections]);

    /**
     * Calculate sticky section headers only when the flattened
     * list changes.
     */
    const stickyHeaderIndices = useMemo(() => {
      const indices: number[] = [];

      flattened.forEach((item, index) => {
        if (item.type === "header") {
          indices.push(index);
        }
      });

      return indices;
    }, [flattened]);

    /**
     * Stable key extractor.
     *
     * Item IDs are unique and provide stable keys even when the
     * selection state changes.
     */
    const keyExtractor = useCallback((item: ListItem) => {
      if (item.type === "header") {
        return `header-${item.title}`;
      }

      return `item-${item.item.id}`;
    }, []);

    /**
     * Allows FlashList to recycle headers and media rows
     * independently.
     */
    const getItemType = useCallback((item: ListItem) => item.type, []);

    /**
     * Stable keyboard dismissal callback.
     */
    const handleScrollBeginDrag = useCallback(() => {
      Keyboard.dismiss();
    }, []);

    /**
     * FlashList's renderItem must return ReactElement | null.
     *
     * Header rendering stays inside this component while the
     * individual media row rendering is delegated to the parent.
     */
    const handleRenderItem = useCallback(
      ({ item }: { item: ListItem }): React.ReactElement | null => {
        if (item.type === "header") {
          return (
            <View style={styles.headerWrapper}>
              <View style={styles.headerContainer}>
                <Text style={styles.headerText}>{item.title}</Text>
              </View>
            </View>
          );
        }

        return renderItem(item.item);
      },
      [renderItem],
    );

    return (
      <FlashList<ListItem>
        ref={ref}
        data={flattened}
        refreshing={refreshing}
        onRefresh={onRefresh}
        stickyHeaderIndices={stickyHeaderIndices}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={handleScrollBeginDrag}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        numColumns={numColumns}
        overrideItemLayout={(layout, item) => {
          if (numColumns > 1 && item.type === "header") {
            layout.span = numColumns;
          }
        }}
        renderItem={handleRenderItem}
      />
    );
  },
);

SharedMediaSectionList.displayName = "SharedMediaSectionList";

export default SharedMediaSectionList;

const styles = StyleSheet.create({
  headerWrapper: {
    paddingTop: 18,
    paddingBottom: 8,
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF",
  },

  headerContainer: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#EEF2F7",
  },

  headerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
