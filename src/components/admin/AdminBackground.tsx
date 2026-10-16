import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

interface AdminBackgroundProps {
  children: ReactNode;
}

export default function AdminBackground({ children }: AdminBackgroundProps) {
  return (
    <View style={styles.container}>
      {/* Zleenchat decorative background */}
      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },

  content: {
    flex: 1,
    zIndex: 5,
  },

  topBlob: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 140,
    backgroundColor: "#E9EEFF",
    top: -70,
    left: -120,
  },

  bottomBlob: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 130,
    backgroundColor: "#EEE8FF",
    bottom: -80,
    right: -110,
  },

  topGlow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(37,99,235,0.10)",
    top: 120,
    alignSelf: "center",
  },

  bottomGlow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(124,58,237,0.10)",
    bottom: 120,
    alignSelf: "center",
  },
});