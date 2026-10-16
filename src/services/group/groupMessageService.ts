import { API_BASE_URL } from "../api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

export type GroupMessagePayload = {
  messageContent: string;
  contentType?: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE";
  mediaUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  duration?: number | null;
  waveform?: number[] | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  orientation?: "portrait" | "landscape" | "square" | null;
  bitrate?: number | null;
  thumbnailUrl?: string | null;
  thumbnailSize?: number | null;
  encryptedThumbnailKey?: string | null;
  thumbnailIV?: string | null;
  thumbnailAuthTag?: string | null;
  encryptedMediaKey?: string | null;
  mediaIV?: string | null;
  isMediaEncrypted?: boolean;
  mediaKeyIV?: string | null;
  replyToId?: number | null;
};

export const getGroupMessages = async (groupId: number) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/messages/group/${groupId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch group messages");
  }

  return response.json();
};

export const sendGroupMessage = async (
  groupId: number,
  payload: string | GroupMessagePayload,
) => {
  const token = await getToken();

  const body =
    typeof payload === "string" ? { messageContent: payload } : payload;

  const response = await fetch(
    `${API_BASE_URL}/messages/group-message/${groupId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.log("SEND GROUP MESSAGE ERROR:", {
      status: response.status,
      body: errorText,
    });

    throw new Error(
      `Failed to send group message: ${response.status} ${errorText}`,
    );
  }

  return response.json();
};

export const forwardGroupMessages = async (
  receiverIds: number[],
  groupIds: number[],
  messageIds: number[],
) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/messages/group-forward`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      receiverIds,
      groupIds, // CHANGED: send selected groups to backend
      messageIds,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.log("FORWARD GROUP MESSAGE ERROR:", {
      status: response.status,
      body: errorText,
    });

    throw new Error(
      `Failed to forward group message: ${response.status} ${errorText}`,
    );
  }

  return response.json();
};

export const uploadGroupMessageFile = async (file: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
}) => {
  const token = await getToken();
  const form = new FormData();

  form.append("file", {
    uri: file.uri,
    name: file.name || "message-file",
    type: file.mimeType || "application/octet-stream",
  } as any);

  const response = await fetch(`${API_BASE_URL}/messages/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Upload group message file error:", error);
    throw new Error("Failed to upload group message file");
  }

  return response.json();
};

export const editGroupMessage = async (
  messageId: number,
  messageContent: string,
) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/messages/group-message/${messageId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messageContent,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Edit group message error:", error);
    throw new Error("Failed to edit group message");
  }

  return response.json();
};

export const deleteGroupMessageForMe = async (messageId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/messages/group-message/${messageId}/me`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Delete group message for me error:", error);
    throw new Error("Failed to delete group message for me");
  }

  return response.json();
};

export const deleteGroupMessageForEveryone = async (messageId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/messages/group-message/${messageId}/everyone`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Delete group message for everyone error:", error);
    throw new Error("Failed to delete group message for everyone");
  }

  return response.json();
};
