import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

export const createGroup = async (name: string) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/groups/create-group`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Create group error:", error);
    throw new Error("Failed to create group");
  }

  return response.json();
};

export const getMyGroups = async () => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/groups/my-groups`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("My groups fetch error:", error);
    throw new Error("Failed to fetch my groups");
  }

  return response.json();
};

export const deleteMyGroupChats = async (groupIds: number[]) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/groups/my-groups/chats`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ groupIds }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Failed to delete selected group chats");
  }

  return data;
};

export const addMember = async (groupId: number, userId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/add-member/${groupId}/${userId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to add member to group");
  }

  return response.json();
};

export const removeMember = async (groupId: number, userId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/remove-member/${groupId}/${userId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to remove member from group");
  }

  return response.json();
};

export const leaveGroup = async (groupId: number) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/groups/leave/${groupId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to leave group");
  }

  return response.json();
};

export const getMyGroupMembers = async (groupId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/my-group-members/${groupId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Group fetch error:", error);
    throw new Error("Failed to fetch groups");
  }

  return response.json();
};

export const getGroupDetails = async (groupId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/group-details/${groupId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Group fetch error:", error);
    throw new Error("Failed to fetch groups");
  }

  return response.json();
};

export const uploadGroupAvatar = async (groupId: number, uri: string) => {
  const token = await getToken();
  const form = new FormData();

  form.append("avatar", {
    uri,
    type: "image/jpeg",
    name: "avatar.jpg",
  } as any);

  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/avatar`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Upload group avatar error:", error);
    throw new Error("Failed to upload group avatar");
  }

  return response.json();
};

export const deleteGroupAvatar = async (groupId: number) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/avatar`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log(error);
    throw new Error("Failed to delete avatar");
  }

  return response.json();
};
export const renameGroup = async (groupId: number, name: string) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/rename`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Rename group error:", error);
    throw new Error("Failed to rename group");
  }

  return response.json();
};

export const updateGroupDescription = async (
  groupId: number,
  description: string,
) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/${groupId}/update-description`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description }),
    },
  );

  if (!response) {
    throw new Error("Failed to update group description");
  }

  return response.json();
};

export type AdminInvitationStatus =
  | "NONE"
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED";

export const inviteAdminToGroup = async (groupId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/${groupId}/invite-admin`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to invite Admin");
  }

  return data;
};

export const getAdminInvitationStatus = async (
  groupId: number,
): Promise<{
  status: AdminInvitationStatus;
}> => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/${groupId}/admin-invitation-status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch Admin invitation status");
  }

  return data;
};

export const warnMember = async (
  groupId: number,
  userId: number,
  reason?: string,
) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/admin/warn-member/${groupId}/${userId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reason,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log(error);
    throw new Error("Failed to warn member");
  }

  return response.json();
};

export const muteMember = async (
  groupId: number,
  userId: number,
  reason?: string,
) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/admin/mute-member/${groupId}/${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reason,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log(error);
    throw new Error("Failed to mute member");
  }

  return response.json();
};

export const unmuteMember = async (groupId: number, userId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/admin/unmute-member/${groupId}/${userId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log(error);
    throw new Error("Failed to unmute member");
  }

  return response.json();
};

export const removeMemberByModerator = async (
  groupId: number,
  userId: number,
) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/admin/remove-member/${groupId}/${userId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log(error);
    throw new Error("Failed to remove member");
  }

  return response.json();
};

export const getGroupModerationHistory = async (
  groupId: number,
  page = 1,
  limit = 20,
) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/admin/${groupId}/moderation-history?page=${page}&limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log(error);
    throw new Error("Failed to fetch moderation history");
  }

  return response.json();
};

export type AddUserGroup = {
  id: number;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  isAlreadyMember: boolean;
};

export const getGroupsForAddingUser = async (
  userId: number,
): Promise<AddUserGroup[]> => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/groups/groups-for-adding-user/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Groups for adding user error:", error);

    throw new Error("Failed to fetch available groups");
  }

  return response.json();
};

export const addUserToGroups = async (userId: number, groupIds: number[]) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/groups/add-user-to-groups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId,
      groupIds,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to add user to groups");
  }

  return data;
};
