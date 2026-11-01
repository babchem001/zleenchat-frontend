import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

const isLocalMediaUri = (value: string) =>
  value.startsWith("file://") || value.startsWith("content://");
const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const isPrivateMessageReference = (reference: string) => {
  const value = reference.trim();

  if (
    /^messages\/(?:images|videos|audio|files|thumbnails)\/message-/i.test(value)
  ) {
    return true;
  }

  if (value.startsWith("/uploads/messages/")) {
    return true;
  }

  if (isHttpUrl(value)) {
    try {
      const url = new URL(value);
      const apiBase = new URL(API_BASE_URL);
      return (
        url.origin === apiBase.origin && url.pathname === "/messages/media"
      );
    } catch {
      return false;
    }
  }
  return false;
};
// Convert a backend media reference into an absolute URL. Backend message references may be: absolute URLs, backend-relative URLs such as /messages/media?key=...
// .legacy /uploads/messages/... paths.  local file:// URIs used while a message is uploading

export const getMediaUrl = (reference?: string | null): string | null => {
  if (!reference) {
    return null;
  }

  const value = reference.trim();

  if (!value) {
    return null;
  }

  if (isLocalMediaUri(value) || isHttpUrl(value)) {
    return value;
  }

  return `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
};

// Build an authenticated source object for React Native media components. This is required because Image/video/audio components do not use the Axios API interceptor automatically.
export const getAuthenticatedMediaSource = async (
  reference?: string | null,
) => {
  if (!reference) {
    return null;
  }
  const value = reference.trim();
  if (!value) {
    return null;
  }

  if (isLocalMediaUri(value)) {
    return {
      uri: value,
    };
  }
  if (isHttpUrl(value) && !isPrivateMessageReference(value)) {
    return {
      uri: value,
    };
  }
  // Private Zleenchat message media must go through th authenticated backend media endpoint
  const uri = isPrivateMessageReference(value)
    ? isHttpUrl(value)
      ? value
      : `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`
    : getMediaUrl(value);

  if (!uri) {
    return null;
  }

  if (!isPrivateMessageReference(value)) {
    return {
      uri,
    };
  }

  const token = await getToken();

  if (!token) {
    throw new Error("Authentication token not found for private media request");
  }

  return {
    uri,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};
