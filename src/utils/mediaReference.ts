import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

const isLocalMediaUri = (value: string) =>
  value.startsWith("file://") || value.startsWith("content://");

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const isRawR2MessageKey = (value: string) =>
  /^messages\/(?:images|videos|audio|files|thumbnails)\/message-/i.test(value);

const isPrivateMessageReference = (reference: string) => {
  const value = reference.trim();

  if (isRawR2MessageKey(value)) {
    return true;
  }

  if (
    value.startsWith("/messages/media?") ||
    value.startsWith("messages/media?") ||
    value.startsWith("/uploads/messages/")
  ) {
    return true;
  }

  if (isHttpUrl(value)) {
    try {
      const url = new URL(value);
      const apiBase = new URL(API_BASE_URL);

      return (
        url.origin === apiBase.origin &&
        (url.pathname === "/messages/media" ||
          url.pathname.startsWith("/uploads/messages/"))
      );
    } catch {
      return false;
    }
  }

  return false;
};

const getCanonicalR2MessageKey = (reference: string): string | null => {
  let value = reference.trim();

  // Convert only URLs from this API host.
  if (isHttpUrl(value)) {
    try {
      const url = new URL(value);
      const apiOrigin = new URL(API_BASE_URL).origin;

      if (url.origin !== apiOrigin) {
        return null;
      }

      value = url.pathname;
    } catch {
      return null;
    }
  }

  // Accept both "messages/images/..." and "/messages/images/...".
  const key = value.replace(/^\/+/, "");

  return /^messages\/(?:images|videos|audio|files|thumbnails)\/message-[^/?#]+$/i.test(
    key,
  )
    ? key
    : null;
};

// Convert a backend media reference into an absolute URL.
export const getMediaUrl = (reference?: string | null): string | null => {
  if (!reference) {
    return null;
  }

  const value = reference.trim();

  if (!value) {
    return null;
  }

  if (isLocalMediaUri(value)) {
    return value;
  }

  const r2Key = getCanonicalR2MessageKey(value);
  if (r2Key) {
    return `${API_BASE_URL}/messages/media?key=${encodeURIComponent(r2Key)}`;
  }
  // Already an absolute URL.
  if (isHttpUrl(value)) {
    return value;
  }

  // Backend-relative media endpoint.
  if (
    value.startsWith("/messages/media?") ||
    value.startsWith("messages/media?")
  ) {
    return `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
  }

  return `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
};

// Build an authenticated source object for React Native media components.
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

  // Local files do not require authentication.
  if (isLocalMediaUri(value)) {
    return {
      uri: value,
    };
  }

  const r2Key = getCanonicalR2MessageKey(value);

  if (r2Key) {
    const token = await getToken();

    if (!token) {
      throw new Error(
        "Authentication token not found for private media request",
      );
    }

    return {
      uri: `${API_BASE_URL}/messages/media?key=${encodeURIComponent(r2Key)}`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }

  // Public external URLs do not require backend authentication.
  if (isHttpUrl(value) && !isPrivateMessageReference(value)) {
    return {
      uri: value,
    };
  }

  let uri: string;

  if (isRawR2MessageKey(value)) {
    uri = `${API_BASE_URL}/messages/media?key=${encodeURIComponent(value)}`;
  } else if (isPrivateMessageReference(value)) {
    uri = isHttpUrl(value)
      ? value
      : `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
  } else {
    uri = getMediaUrl(value)!;
  }

  if (!uri) {
    return null;
  }

  // Attach authentication to private media requests.
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
