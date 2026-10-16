import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { SharedMediaSortOption } from "@/src/utils/sortSharedMedia";

type Props = {
  visible: boolean;
  selected: SharedMediaSortOption;
  onClose: () => void;
  onSelect: (option: SharedMediaSortOption) => void;
};

const OPTIONS: {
  label: string;
  value: SharedMediaSortOption;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    label: "Newest",
    value: "NEWEST",
    icon: "time-outline",
  },
  {
    label: "Oldest",
    value: "OLDEST",
    icon: "hourglass-outline",
  },
  {
    label: "Largest",
    value: "LARGEST",
    icon: "arrow-up-circle-outline",
  },
  {
    label: "Smallest",
    value: "SMALLEST",
    icon: "arrow-down-circle-outline",
  },
];

export default function SharedMediaSortSheet({
  visible,
  selected,
  onClose,
  onSelect,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Sort media</Text>

          {OPTIONS.map((option) => {
            const active = option.value === selected;

            return (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.85}
                style={styles.option}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <View style={styles.optionLeft}>
                  <Ionicons
                    name={option.icon}
                    size={22}
                    color={active ? "#2563EB" : "#64748B"}
                  />

                  <Text
                    style={[
                      styles.optionText,
                      active && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </View>

                {active && (
                  <Ionicons name="checkmark-circle" size={22} color="#2563EB" />
                )}
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.32)",
  },

  sheet: {
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 22,

    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,

    backgroundColor: "#FFFFFF",
  },

  handle: {
    alignSelf: "center",

    width: 54,
    height: 5,

    borderRadius: 3,

    backgroundColor: "#CBD5E1",

    marginBottom: 18,
  },

  title: {
    fontSize: 21,
    fontWeight: "700",
    color: "#0B1545",

    marginBottom: 22,
  },

  option: {
    height: 58,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  optionText: {
    marginLeft: 16,

    fontSize: 16,

    color: "#334155",

    fontWeight: "600",
  },

  optionTextActive: {
    color: "#2563EB",
  },
});
