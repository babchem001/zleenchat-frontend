import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

import { registerDeviceToken } from "@/src/services/notifications/notificationService";
import { parseIncomingCallNotification } from "@/src/services/notifications/callNotification";
import { useCallStore } from "@/src/store/call/callStore";

const isIncomingCallData = (data: unknown) =>
  typeof data === "object" &&
  data !== null &&
  (data as Record<string, unknown>).type === "incoming_call";

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isCall = isIncomingCallData(notification.request.content.data);

    return {
      shouldShowBanner: !isCall,
      shouldShowList: !isCall,
      shouldPlaySound: true,
      shouldSetBadge: false,
    };
  },
});

export const useCallNotifications = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const showIncomingCall = (data: unknown) => {
      const call = parseIncomingCallNotification(data);
      if (!call) return;

      useCallStore.getState().setIncomingCall(call);
    };

    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        if (!active) return;

        showIncomingCall(notification.request.content.data);
      },
    );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        if (!active) return;

        showIncomingCall(response.notification.request.content.data);

        void Notifications.clearLastNotificationResponseAsync().catch(
          (error) => {
            console.warn(
              "Could not clear the handled call notification:",
              error,
            );
          },
        );
      });

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!active || !response) return;

        showIncomingCall(response.notification.request.content.data);

        void Notifications.clearLastNotificationResponseAsync().catch(
          (error) => {
            console.warn(
              "Could not clear the handled call notification:",
              error,
            );
          },
        );
      })
      .catch((error) => {
        console.warn("Could not read the last notification response:", error);
      });

    const registerPushToken = async () => {
      if (Platform.OS !== "ios" && Platform.OS !== "android") return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("incoming-calls", {
          name: "Incoming calls",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 250, 500],
          lightColor: "#2563EB",
          sound: "default",
        });
      }

      let permission = await Notifications.getPermissionsAsync();

      if (!permission.granted) {
        permission = await Notifications.requestPermissionsAsync();
      }

      if (!permission.granted) return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;

      if (!projectId) {
        throw new Error("The Expo project ID is missing.");
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      if (active) {
        await registerDeviceToken(token.data, Platform.OS);
      }
    };

    void registerPushToken().catch((error) => {
      console.warn("Could not register for call notifications:", error);
    });

    return () => {
      active = false;
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, [enabled]);
};
