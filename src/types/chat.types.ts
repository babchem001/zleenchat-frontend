export type UserProfile = {
  id: number;

  profile: {
    username: string;
    avatarUrl: string | null;
  };
};

export type MessageSender = {
  id: number;

  firstName?: string;
  lastName?: string;

  profile: {
    username: string;
    avatarUrl: string | null;
  };
};

export type Conversation = {
  user: UserProfile;

  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  lastMessageStatus?: "SENT" | "DELIVERED" | "READ";
  lastMessageSenderId?: number | null;
  lastMessageId?: number | null;
  lastMessageDeletedForAll?: boolean;
  lastMessageDeletedById?: number | null;
};

export type UploadStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "GENERATING_THUMBNAIL"
  | "COMPRESSING"
  | "ENCRYPTING"
  | "READY"
  | "UPLOADING"
  | "FAILED"
  | "PAUSED"
  | "SENT"
  | "DELIVERED"
  | "READ";

export type Message = {
  id: number;
  clientId?: string;
  localId?: string;
  senderId: number;
  sender?: MessageSender;
  replyTo?: Message;
  replyToId?: number | null;
  receiverId?: number;
  groupId?: number;
  messageContent: string;
  type: "DIRECT" | "GROUP" | "SYSTEM";
  contentType?: "TEXT" | "LINK" | "IMAGE" | "VIDEO" | "AUDIO" | "FILE";
  mediaUrl?: string | null;
  localUri?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadProgress?: number;
  uploadStatus?: UploadStatus;
  status?: "SENT" | "DELIVERED" | "READ";
  createdAt: string;
  compressionProgress?: number;
  chunkUploadProgress?: number;
  uploadedChunks?: number;
  totalChunks?: number;
  uploadSessionId?: string;
  compressedUri?: string | null;
  isCompressed?: boolean;
  uploadError?: string | null;
  encryptedMediaKey?: string | null;
  mediaIV?: string | null;
  // mediaAuthTag?: string | null;
  isMediaEncrypted?: boolean;
  encryptedThumbnailKey?: string | null;
  thumbnailIV?: string | null;
  mediaKeyIV?: string | null;
  mediaKeyAuthTag?: string | null;
  decryptedUri?: string | null;
  isDecrypting?: boolean;
  thumbnailUri?: string | null;
  thumbnailSize?: number | null;
  originalWidth?: number | null;
  originalHeight?: number | null;
  processedWidth?: number | null;
  processedHeight?: number | null;
  thumbnailUrl?: string | null;
  thumbnailAuthTag?: string | null;
  duration?: number | null; // For videos and audio
  videoWidth?: number | null;
  videoHeight?: number | null;
  orientation?: "portrait" | "landscape" | "square" | null;
  bitrate?: number | null;
  waveform?: number[] | null; // For audio messages
  compressionLevel?: "NONE" | "LIGHT" | "AGGRESSIVE";
  originalFileSize?: number | null;
  compressionSavedBytes?: number | null;
  cachedMediaUri?: string | null;
  cachedThumbnailUri?: string | null;
  cachedAt?: number | null;
  isCached?: boolean;
  processingProgress?: number;
  editedAt?: string | null;
  deletedForAll?: boolean;
  deletedAt?: string | null;
  deletedBy?: {
    id: number;

    profile: {
      username: string;
    };
  };
  deletedById: number | null;

  isForwarded: boolean;
  forwardedFromMessageId?: number | null;
};

export type ConversationMessagesResponse = {
  messages: Message[];
  nextCursor: number | null;
  hasMoreMessagesToLoad: boolean;

  blockStatus: {
    blocked: boolean;
    iBlockedThem: boolean;
    theyBlockedMe: boolean;
  };
};
