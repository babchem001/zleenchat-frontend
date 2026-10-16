import apiClient from "../api/apiClient";

import {
  ConversationMessagesResponse,
  Conversation,
  Message,
} from "@/src/types/chat.types";

export type SendMessagePayload = {
  clientId: string;
  messageContent: string;
  contentType?: "TEXT" | "LINK" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE";

  mediaUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  duration?: number | null;
  waveform?: number[] | null;

  videoWidth?: number | null;
  videoHeight?: number | null;
  processedWidth?: number | null;
  processedHeight?: number | null;

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

  isForwarded: boolean;
  forwardedFromMessageId?: number | null;
  replyToId?: number | null;
};

export type SearchMessagesResponse = {
  messages: Message[];
  count: number;
};

// 1. Get all Conversations

export const getConversations = async (): Promise<Conversation[]> => {
  const response = await apiClient.get("/conversations");

  return response.data;
};

// 2. Get Chat Messages (Paginated)

export const getConversationMessages = async (
  userId: number,
  cursor?: number,
  date?: string,
): Promise<ConversationMessagesResponse> => {
  const params = new URLSearchParams();

  if (cursor) {
    params.append("cursor", String(cursor));
  }

  if (date) {
    params.append("date", date);
  }

  const query = params.toString();

  const response = await apiClient.get(
    `/messages/conversation/${userId}/messages${query ? `?${query}` : ""}`,
  );

  return response.data;
};

// 3. Send Message

export const sendMessage = async (
  receiverId: number,
  payload: SendMessagePayload,
) => {
  const response = await apiClient.post(
    `/messages/direct-message/${receiverId}`,
    payload,
  );

  return response.data;
};

export const forwardMessages = async (
  receiverIds: number[],
  groupIds: number[],
  messageIds: number[],
) => {
  const response = await apiClient.post("/messages/forward", {
    receiverIds,
    groupIds,
    messageIds,
  });

  return response.data;
};

export const deleteDirectMessagesForMe = async (messageIds: number[]) => {
  const response = await apiClient.delete("/messages/direct-messages/me", {
    data: {
      messageIds,
    },
  });

  return response.data;
};

export const deleteDirectMessagesForEveryone = async (messageIds: number[]) => {
  const response = await apiClient.delete(
    "/messages/direct-messages/everyone",
    {
      data: {
        messageIds,
      },
    },
  );

  return response.data;
};

export const editDirectMessage = async (
  messageId: number,
  messageContent: string,
) => {
  const response = await apiClient.put(
    `/messages/direct-message/${messageId}`,
    {
      messageContent,
    },
  );

  return response.data;
};

export const searchConversationMessages = async (
  userId: number,
  query: string,
): Promise<SearchMessagesResponse> => {
  const response = await apiClient.get(
    `/messages/conversation/${userId}/search`,
    {
      params: {
        q: query,
      },
    },
  );

  return response.data;
};

// 4. Mark As Read

export const markAsRead = async (senderId: number) => {
  const response = await apiClient.put(`/messages/read/${senderId}`);

  return response.data;
};