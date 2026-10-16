import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import { Message } from "@/src/types/chat.types";

type Props = {
  visible: boolean;
  audioUri: string;
  message: Message;
  onClose: () => void;
};

export default function AudioPlayerModal({
  visible,
  audioUri,
  message,
  onClose,
}: Props) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAudio = async () => {
    if (sound) {
      return sound;
    }

    const { sound: loadedSound } = await Audio.Sound.createAsync({
      uri: audioUri,
    });

    setSound(loadedSound);

    return loadedSound;
  };

  const playAudio = async () => {
    const player = await loadAudio();

    await player.playAsync();

    setIsPlaying(true);
  };

  const pauseAudio = async () => {
    if (!sound) {
      return;
    }

    await sound.pauseAsync();

    setIsPlaying(false);
  };

  const stopAudio = async () => {
    if (!sound) {
      return;
    }

    await sound.stopAsync();

    setIsPlaying(false);
  };

  const closeModal = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }

    setIsPlaying(false);

    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={closeModal}
    >
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{message.fileName || "Audio Message"}</Text>

        <Text style={styles.duration}>Duration: {message.duration || 0}s</Text>

        <View style={styles.waveformContainer}>
          {(message.waveform || []).map((bar, index) => (
            <View
              key={index}
              style={[
                styles.waveBar,
                {
                  height: Math.max(6, bar),
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.button} onPress={playAudio}>
            <Text style={styles.buttonText}>Play</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={pauseAudio}>
            <Text style={styles.buttonText}>Pause</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={stopAudio}>
            <Text style={styles.buttonText}>Stop</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.status}>{isPlaying ? "Playing..." : "Paused"}</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  closeBtn: {
    position: "absolute",
    top: 60,
    right: 20,
  },

  closeText: {
    fontSize: 28,
    fontWeight: "700",
  },

  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },

  duration: {
    textAlign: "center",
    marginBottom: 24,
    color: "#666",
  },

  waveformContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 120,
    marginBottom: 30,
  },

  waveBar: {
    width: 4,
    marginHorizontal: 1,
    backgroundColor: "#25D366",
    borderRadius: 4,
  },

  controls: {
    flexDirection: "row",
    justifyContent: "space-evenly",
  },

  button: {
    backgroundColor: "#25D366",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },

  status: {
    textAlign: "center",
    marginTop: 20,
    color: "#666",
  },
});
