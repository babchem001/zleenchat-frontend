import React from "react";
import { Modal, View, TouchableOpacity, Text, StyleSheet } from "react-native";

import { VideoView, useVideoPlayer } from "expo-video";

type Props = {
  visible: boolean;
  videoUri: string;
  videoHeaders?: Record<string, string>;
  onClose: () => void;
};

function VideoPlayerContent({
  videoUri,
  videoHeaders,
}: {
  videoUri: string;
  videoHeaders?: Record<string, string>;
}) {
  const player = useVideoPlayer(
    {
      uri: videoUri,
      ...(videoHeaders ? { headers: videoHeaders } : {}),
    },
    (player) => {
      player.loop = false;
    },
  );

  return (
    <VideoView
      player={player}
      style={styles.video}
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  );
}

export default function VideoViewerModal({
  visible,
  videoUri,
  videoHeaders,
  onClose,
}: Props) {
  // Don't render anything when closed
  if (!visible || !videoUri) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <VideoPlayerContent videoUri={videoUri} videoHeaders={videoHeaders} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },

  video: {
    width: "100%",
    height: "100%",
  },

  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
  },

  closeText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
  },
});
