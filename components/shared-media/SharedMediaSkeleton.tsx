import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { SharedMediaType } from "@/src/services/chat/sharedMediaService";

type Props = {
  type: SharedMediaType;
};

export default function SharedMediaSkeleton({ type }: Props) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),

        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  if (type === "IMAGE") {
    return (
      <View style={styles.grid}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Animated.View key={i} style={[styles.photo, { opacity }]} />
        ))}
      </View>
    );
  }

  if (type === "VIDEO") {
    return (
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Animated.View key={i} style={[styles.video, { opacity }]} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Animated.View key={i} style={[styles.row, { opacity }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 10,
  },

  photo: {
    width: "30.5%",
    aspectRatio: 1,

    margin: "1.5%",

    borderRadius: 14,

    backgroundColor: "#E8EDF9",
  },

  video: {
    width: "47%",
    aspectRatio: 0.85,

    margin: "1.5%",

    borderRadius: 18,

    backgroundColor: "#E8EDF9",
  },

  list: {
    padding: 16,
  },

  row: {
    height: 78,

    marginBottom: 14,

    borderRadius: 16,

    backgroundColor: "#E8EDF9",
  },
});
