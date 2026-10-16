import apiClient from "../api/apiClient";
import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "../storage/tokenService";

// Types
export type Profile = {
  id: number;
  username: string;
  avatarUrl: string | null;
  bio: string | null;

  user: {
    firstName: string;
    lastName: string;
    email?: string;
  };
};

export type UserDetails = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;

  online: boolean;
  lastSeen: string | null;
  memberSince: string;

  location: {
    countryCode: string | null;
    country: string | null;
    state: string | null;
    city: string | null;
    timezone: string | null;
  };

  media: {
    photos: number;
    videos: number;
    audio: number;
    documents: number;
    links: number;
  };

  commonGroups: {
    count: number;
    groups: {
      id: number;
      name: string;
      avatarUrl: string | null;
    }[];
  };

  blockStatus: {
    iBlockedThem: boolean;
    theyBlockedMe: boolean;
  };
};

export type BlockRelationship = {
  blockerId: number;
  blockedId: number;
};
export type BlockUserResponse = {
  success: boolean;
  message: string;
  data: BlockRelationship | null;
};

// Get my Profile
export const getMyProfile = async (): Promise<Profile> => {
  const response = await apiClient.get("/profile/me");

  return response.data;
};

// Get other user's profile
export const getOtherUserProfileById = async (
  userId: number,
): Promise<Profile> => {
  const response = await apiClient.get(`/profile/${userId}`);

  return response.data;
};

// Get complete user details
export const getUserDetails = async (userId: number): Promise<UserDetails> => {
  const response = await apiClient.get(`/profile/${userId}/details`);

  return response.data;
};

// Block a user
export const blockUser = async (userId: number): Promise<BlockUserResponse> => {
  const response = await apiClient.post(`/profile/${userId}/block`);

  return response.data;
};

// Unblock a user
export const unblockUser = async (
  userId: number,
): Promise<BlockUserResponse> => {
  const response = await apiClient.delete(`/profile/${userId}/block`);

  return response.data;
};

// Update my profile

// Upload avatar
export const uploadAvatar = async (file: any) => {
  const token = await getToken();
  const formData = new FormData();

  formData.append("avatar", {
    uri: file.uri,
    name: file.fileName || "avatar.jpg",
    type: file.type || "image/jpeg",
  } as any);

  const response = await fetch(`${API_BASE_URL}/profile/upload-avatar`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  return await response.json();
};

// Update avatar
export const updateAvatar = async (file: any) => {
  const token = await getToken();
  const formData = new FormData();

  formData.append("avatar", {
    uri: file.uri,
    name: file.fileName || "avatar.jpg",
    type: file.type || "image/jpeg",
  } as any);

  const response = await fetch(`${API_BASE_URL}/profile/update-avatar`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  return await response.json();
};

//    6. Delete Avatar

export const deleteAvatar = async () => {
  const response = await apiClient.delete("/profile/delete-avatar", {});

  return response.data;
};
