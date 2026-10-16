import { Tabs } from "expo-router";
import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#7B859F",
        tabBarStyle: {
          position: "absolute",

          left: 14,
          right: 14,
          bottom: 10,

          height: 64 + insets.bottom,

          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),

          backgroundColor: "#FFFFFF",

          borderTopWidth: 0,

          borderRadius: 22,

          elevation: 14,

          shadowColor: "#2563EB",
          shadowOpacity: 0.08,
          shadowRadius: 20,
          shadowOffset: {
            width: 0,
            height: 8,
          },
        },

        tabBarItemStyle: {
          marginHorizontal: 6,
          marginVertical: 4,
          borderRadius: 18,
          overflow: "hidden",
        },

        tabBarActiveBackgroundColor: "#2563EB",

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginBottom: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chats",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="message.fill" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="group"
        options={{
          title: "Groups",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="person.3.fill" size={20} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Me",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="person.fill" size={20} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
