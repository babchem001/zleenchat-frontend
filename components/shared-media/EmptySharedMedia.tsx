import { View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SharedMediaType } from "@/src/services/chat/sharedMediaService";

type Props = {
  type: SharedMediaType;
};

export default function EmptySharedMedia({ type }: Props) {
  const getContent = () => {
    switch (type) {
      case "IMAGE":
        return {
          icon: "image-outline",
          title: "No Photos",
          subtitle: "Photos shared in this chat will appear here.",
          material: false,
        };

      case "VIDEO":
        return {
          icon: "videocam-outline",
          title: "No Videos",
          subtitle: "Videos shared in this chat will appear here.",
          material: false,
        };

      case "AUDIO":
        return {
          icon: "musical-notes-outline",
          title: "No Audio",
          subtitle: "Voice notes and audio files will appear here.",
          material: false,
        };

      case "FILE":
        return {
          icon: "file-document-outline",
          title: "No Files",
          subtitle: "Documents shared in this chat will appear here.",
          material: true,
        };

      case "LINK":
        return {
          icon: "link-variant",
          title: "No Links",
          subtitle: "Links shared in this chat will appear here.",
          material: true,
        };
    }
  };

  const content = getContent();

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        {content.material ? (
          <MaterialCommunityIcons
            name={content.icon as any}
            size={42}
            color="#2563EB"
          />
        ) : (
          <Ionicons name={content.icon as any} size={42} color="#2563EB" />
        )}
      </View>

      <Text style={styles.title}>{content.title}</Text>

      <Text style={styles.subtitle}>{content.subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    justifyContent: "center",
    alignItems: "center",

    paddingHorizontal: 40,
  },

  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#EDF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",

    color: "#0B1545",
  },

  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: "#69708A",
  },
});
