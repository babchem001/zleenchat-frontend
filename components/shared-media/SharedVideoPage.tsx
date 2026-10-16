import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";

type Props = {
  uri: string;
  active: boolean;
};

const formatTime = (seconds: number) => {
  if (!seconds || Number.isNaN(seconds)) {
    return "0:00";
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function SharedVideoPage({ uri, active }: Props) {
  const [, forceUpdate] = useState(0);

  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
  });

  useEffect(() => {
    if (!active) {
      player.pause();
      player.currentTime = 0;
      return;
    }

    player.replay();
    player.play();
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const interval = setInterval(() => {
      forceUpdate((v) => v + 1);
    }, 250);

    return () => clearInterval(interval);
  }, [active]);

  return (
    <View style={styles.videoPage}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        allowsFullscreen
        allowsPictureInPicture
      />

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            if (player.playing) {
              player.pause();
            } else {
              player.play();
            }
          }}
        >
          <Ionicons
            name={player.playing ? "pause" : "play"}
            size={22}
            color="#FFF"
          />
        </TouchableOpacity>

        <Text style={styles.timeLabel}>{formatTime(player.currentTime)}</Text>

        <View style={styles.sliderPlaceholder}>
          <View
            style={[
              styles.sliderProgress,
              {
                width: `${
                  player.duration > 0
                    ? (player.currentTime / player.duration) * 100
                    : 0
                }%`,
              },
            ]}
          />
        </View>

        <Text style={styles.timeLabel}>{formatTime(player.duration)}</Text>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => player.replay()}
        >
          <Ionicons name="refresh" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  videoPage: {
    flex: 1,
  },

  video: {
    flex: 1,
  },

  bottomBar: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 26,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "rgba(11,21,69,0.55)",
  },

  controlButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },

  timeLabel: {
    width: 46,
    textAlign: "center",
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },

  sliderPlaceholder: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.20)",
  },

  sliderProgress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2563EB",
  },
});
