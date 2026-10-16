import apiClient from "../api/apiClient";

export type SharedMediaType = "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "LINK";

export interface SharedMediaItem {
  id: number;

  senderId: number;
  receiverId: number | null;
  groupId: number | null;
  contentType: SharedMediaType | "TEXT";
  messageContent: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  duration: number | null;
  waveform: number[] | null;
  createdAt: string;

  isMediaEncrypted: boolean;
  encryptedMediaKey: string | null;
  mediaKeyIV: string | null;
  mediaKeyAuthTag: string | null;

  sender: {
    id: number;

    profile: {
      username: string;
      avatarUrl: string | null;
    };
  };
}

export const getSharedMedia = async (userId: number, type: SharedMediaType) => {
  const response = await apiClient.get<SharedMediaItem[]>(
    `/messages/shared-media/${userId}`,
    {
      params: {
        type,
      },
    },
  );

  return response.data;
};

export const getGroupSharedMedia = async (
  groupId: number,
  type: SharedMediaType,
) => {
  const response = await apiClient.get<SharedMediaItem[]>(
    `/messages/group/${groupId}/shared-media`,
    {
      params: {
        type,
      },
    },
  );

  return response.data;
};
