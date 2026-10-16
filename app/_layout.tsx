import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { useEffect, useRef } from "react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { useAuthStore } from "@/src/store/auth/authStorage";
import NetInfo from "@react-native-community/netinfo";
import { useNetworkStore } from "@/src/store/network/networkStore";
import { runStartupCleanup } from "@/src/services/chat/tempCleanupService";
import { startWorker } from "@/src/workers/workerManager";
import { processPendingJobs } from "@/src/workers/mediaWorker";
import SplashScreen from "@/components/splash/SplashScreen";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const { loadUser, isAuthenticated, isHydrated, user } = useAuthStore();

  const router = useRouter();
  const segments = useSegments();
  const hasLoaded = useRef(false);

  const setOnlineStatus = useNetworkStore((state) => state.setOnlineStatus);

  useEffect(() => {
    if (hasLoaded.current) {
      return;
    }

    hasLoaded.current = true;

    const initializeApp = async () => {
      try {
        await loadUser();
      } catch (error) {
        console.error("STARTUP AUTHENTICATION ERROR:", error);
      }

      // Startup cleanup must never block the splash/auth flow.
      void runStartupCleanup().catch((error) => {
        console.error("BACKGROUND STARTUP CLEANUP ERROR:", error);
      });

      // Worker startup must never block the splash/auth flow.
      try {
        startWorker();
      } catch (error) {
        console.error("BACKGROUND WORKER START ERROR:", error);
      }
    };

    void initializeApp().catch((error) => {
      console.error("APP STARTUP INITIALIZATION ERROR:", error);
    });
  }, [loadUser]);

  useEffect(() => {
    if (!isHydrated || !segments[0]) {
      return;
    }

    const inAuthGroup = segments[0] === "auth";
    const inAdminGroup = segments[0] === "admin";

    const isAdmin = user?.isAdmin === true || user?.isSuperAdmin === true;
    if (!isAuthenticated) {
      if (!inAuthGroup) {
        router.replace("/auth/login");
      }
      return;
    }
    if (isAdmin) {
      if (inAuthGroup) {
        router.replace("/admin");
      }
      return;
    }
    if (inAuthGroup) {
      router.replace("/(tabs)");
      return;
    }

    if (inAdminGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isHydrated, user, segments, router]);

  useEffect(() => {
    let mounted = true;
    try {
      const unsubscribe = NetInfo.addEventListener((state) => {
        if (!mounted) {
          return;
        }

        const connected = !!state.isConnected && !!state.isInternetReachable;

        setOnlineStatus(connected);

        console.log(connected ? "Internet connected" : "Internet Offline");

        if (connected) {
          void processPendingJobs().catch((error) => {
            console.error("BACKGROUND PENDING JOB PROCESSING ERROR:", error);
          });
        }
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } catch (error) {
      console.error("NETWORK LISTENER STARTUP ERROR:", error);

      return () => {
        mounted = false;
      };
    }
  }, [setOnlineStatus]);

  if (!isHydrated) {
    return <SplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <ThemeProvider
            value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
          >
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="auth" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="admin" />
              <Stack.Screen name="modal" />
            </Stack>

            <StatusBar style="auto" />
          </ThemeProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
