import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  AppUpdate,
  checkForAppUpdate,
  DISMISSED_UPDATE_KEY,
  downloadAndOpenAppUpdate,
} from "@/src/services/appUpdateService";

type AppUpdateState = {
  update: AppUpdate | null;
  downloading: boolean;
  downloadProgress: number;
  downloadError: string | null;
  dismissUpdate: () => Promise<void>;
  startUpdate: () => Promise<void>;
};

export default function useAppUpdate(enabled: boolean): AppUpdateState {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const checking = useRef(false);
  const lastCheckAt = useRef(0);

  useEffect(() => {
    if (!enabled || Platform.OS !== "android") {
      return;
    }

    let mounted = true;

    const check = async () => {
      if (
        checking.current ||
        Date.now() - lastCheckAt.current < 5 * 60 * 1000
      ) {
        return;
      }

      checking.current = true;
      lastCheckAt.current = Date.now();

      try {
        const availableUpdate = await checkForAppUpdate();

        if (!mounted) {
          return;
        }

        if (!availableUpdate) {
          setUpdate(null);
          return;
        }

        const dismissedVersion = await AsyncStorage.getItem(
          DISMISSED_UPDATE_KEY,
        ).catch(() => null);

        if (!mounted) {
          return;
        }

        if (
          !availableUpdate.required &&
          dismissedVersion === availableUpdate.version
        ) {
          setUpdate(null);
          return;
        }

        setUpdate(availableUpdate);
      } catch {
        // An update check must not interrupt authentication or app startup.
      } finally {
        checking.current = false;
      }
    };

    void check();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void check();
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [enabled]);

  const dismissUpdate = async () => {
    if (!update || update.required || downloading) {
      return;
    }

    await AsyncStorage.setItem(DISMISSED_UPDATE_KEY, update.version).catch(
      () => undefined,
    );
    setUpdate(null);
  };

  const startUpdate = async () => {
    if (!update || downloading) {
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    try {
      await downloadAndOpenAppUpdate(update, setDownloadProgress);
    } catch {
      setDownloadError(
        "The update could not be downloaded or opened. Check your connection and try again.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return {
    update,
    downloading,
    downloadProgress,
    downloadError,
    dismissUpdate,
    startUpdate,
  };
}