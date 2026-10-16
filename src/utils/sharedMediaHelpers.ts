import { Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";

//  Formats milliseconds into mm:ss
export const formatDuration = (duration?: number | null) => {
  if (!duration) {
    return "0:00";
  }

  const totalSeconds = Math.floor(duration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// /**
//  * Formats bytes into KB / MB

export const formatFileSize = (bytes?: number | null) => {
  if (!bytes) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

//  * Extract file extension.
export const getFileExtension = (fileName?: string | null) => {
  return fileName?.split(".").pop()?.toUpperCase() || "FILE";
};

//  * Returns Ionicons document icon.
export const getDocumentIcon = (fileName?: string | null) => {
  const ext = getFileExtension(fileName).toLowerCase();

  switch (ext) {
    case "pdf":
      return "document-text";

    case "doc":
    case "docx":
      return "document";

    case "xls":
    case "xlsx":
    case "csv":
      return "grid";

    case "ppt":
    case "pptx":
      return "easel";

    case "zip":
    case "rar":
    case "7z":
      return "archive";

    default:
      return "document-outline";
  }
};

export const getFileBadgeColor = (fileName?: string | null) => {
  const ext = getFileExtension(fileName).toLowerCase();

  switch (ext) {
    case "pdf":
      return "#E53935";

    case "doc":
    case "docx":
      return "#1976D2";

    case "xls":
    case "xlsx":
    case "csv":
      return "#2E7D32";

    case "ppt":
    case "pptx":
      return "#F57C00";

    case "zip":
    case "rar":
    case "7z":
      return "#616161";

    case "txt":
      return "#607D8B";

    case "apk":
      return "#43A047";

    default:
      return "#757575";
  }
};

export const openLink = async (url: string) => {
  let finalUrl = url.trim();

  if (!/^https?:\/\//i.test(finalUrl)) {
    finalUrl = `https://${finalUrl}`;
  }

  try {
    await Linking.openURL(finalUrl);
  } catch (error) {
    console.log("Unable to open link:", error);
  }
};

export const getDomainName = (url: string) => {
  try {
    const formatted = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    return new URL(formatted).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
