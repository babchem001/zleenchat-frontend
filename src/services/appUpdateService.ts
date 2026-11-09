import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

import { isVersionNewer } from "@/src/utils/versionUtils";

const RELEASE_URL =
  "https://api.github.com/repos/babchem001/zleenchat-frontend/releases/latest";
const CACHE_KEY = "@zleenchat/app-update-cache-v1";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const APK_MIME_TYPE = "application/vnd.android.package-archive";
const REQUIRED_MARKER = /<!--\s*zleenchat-update:\s*required\s*-->/i;

export const DISMISSED_UPDATE_KEY = "@zleenchat/dismissed-update-version";

type GitHubAsset = {
  name?: unknown;
  state?: unknown;
  size?: unknown;
  browser_download_url?: unknown;
};

type GitHubRelease = {
  tag_name?: unknown;
  name?: unknown;
  body?: unknown;
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
};

type CachedRelease = {
  checkedAt: number;
  release: GitHubRelease | null;
};

export type AppUpdate = {
  version: string;
  releaseTitle: string;
  releaseNotes: string;
  apkName: string;
  apkUrl: string;
  apkSizeBytes: number;
  required: boolean;
};

async function readCache(): Promise<CachedRelease | null> {
  try {
    const stored = await AsyncStorage.getItem(CACHE_KEY);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as Partial<CachedRelease>;

    if (typeof parsed.checkedAt !== "number" || !("release" in parsed)) {
      return null;
    }

    return {
      checkedAt: parsed.checkedAt,
      release: (parsed.release as GitHubRelease | null) ?? null,
    };
  } catch {
    return null;
  }
}

async function writeCache(value: CachedRelease): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // A cache write failure must not interrupt app startup.
  }
}

function toAppUpdate(
  release: GitHubRelease | null,
  installedVersion: string,
): AppUpdate | null {
  if (
    !release ||
    release.draft === true ||
    release.prerelease === true ||
    typeof release.tag_name !== "string" ||
    !isVersionNewer(release.tag_name, installedVersion)
  ) {
    return null;
  }

  const assets = Array.isArray(release.assets)
    ? (release.assets as GitHubAsset[])
    : [];

  const apk = assets.find(
    (asset) =>
      asset.state === "uploaded" &&
      typeof asset.name === "string" &&
      /\.apk$/i.test(asset.name),
  );

  if (
    !apk ||
    typeof apk.name !== "string" ||
    typeof apk.browser_download_url !== "string"
  ) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(apk.browser_download_url);
  } catch {
    return null;
  }

  const expectedPath = "/babchem001/zleenchat-frontend/releases/download/";

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.hostname !== "github.com" ||
    !parsedUrl.pathname.toLowerCase().startsWith(expectedPath.toLowerCase())
  ) {
    return null;
  }

  const body = typeof release.body === "string" ? release.body : "";
  const required = REQUIRED_MARKER.test(body);
  const releaseNotes = body.replace(REQUIRED_MARKER, "").trim();
  const version = release.tag_name.replace(/^v/i, "");

  return {
    version,
    releaseTitle:
      typeof release.name === "string" && release.name.trim()
        ? release.name.trim()
        : `Zleenchat ${version}`,
    releaseNotes: releaseNotes.slice(0, 900),
    apkName: apk.name,
    apkUrl: parsedUrl.toString(),
    apkSizeBytes:
      typeof apk.size === "number" && Number.isFinite(apk.size) ? apk.size : 0,
    required,
  };
}

export async function checkForAppUpdate(): Promise<AppUpdate | null> {
  if (Platform.OS !== "android") {
    return null;
  }

  const installedVersion = Constants.expoConfig?.version;

  if (!installedVersion) {
    return null;
  }

  const cached = await readCache();
  const cachedUpdate = cached
    ? toAppUpdate(cached.release, installedVersion)
    : null;

  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cachedUpdate;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(RELEASE_URL, {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      await writeCache({
        checkedAt: Date.now(),
        release: null,
      });
      return cachedUpdate;
    }

    if (!response.ok) {
      return cachedUpdate;
    }

    const release = (await response.json()) as GitHubRelease;

    await writeCache({
      checkedAt: Date.now(),
      release,
    });

    return toAppUpdate(release, installedVersion);
  } catch {
    // Network and API failures must not prevent Zleenchat from opening.
    return cachedUpdate;
  } finally {
    clearTimeout(timeout);
  }
}

export async function downloadAndOpenAppUpdate(
  update: AppUpdate,
  onProgress: (progress: number) => void,
): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error("APK installation is available on Android only.");
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error("The app cache directory is unavailable.");
  }

  const safeVersion = update.version.replace(/[^0-9A-Za-z.-]/g, "_");
  const destinationUri = `${FileSystem.cacheDirectory}zleenchat-update-${safeVersion}.apk`;

  await FileSystem.deleteAsync(destinationUri, { idempotent: true });

  try {
    const download = FileSystem.createDownloadResumable(
      update.apkUrl,
      destinationUri,
      {},
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (totalBytesExpectedToWrite > 0) {
          onProgress(
            Math.min(totalBytesWritten / totalBytesExpectedToWrite, 1),
          );
        }
      },
    );

    const result = await download.downloadAsync();

    if (!result || result.status < 200 || result.status >= 300) {
      throw new Error("The APK download did not complete.");
    }

    // Expo SDK 54 legacy getInfoAsync returns size in FileInfo;
    // its options argument does not accept { size: true }.
    const fileInfo = await FileSystem.getInfoAsync(result.uri);

    if (
      !fileInfo.exists ||
      (typeof fileInfo.size === "number" && fileInfo.size <= 0) ||
      (update.apkSizeBytes > 0 &&
        typeof fileInfo.size === "number" &&
        fileInfo.size !== update.apkSizeBytes)
    ) {
      throw new Error("The downloaded APK is incomplete.");
    }

    const contentUri = await FileSystem.getContentUriAsync(result.uri);

    await IntentLauncher.startActivityAsync(
      "android.intent.action.INSTALL_PACKAGE",
      {
        data: contentUri,
        type: APK_MIME_TYPE,
        flags: 1,
      },
    );
  } catch (error) {
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    throw error;
  }
}
