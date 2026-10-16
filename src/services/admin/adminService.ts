import { API_BASE_URL } from "@/src/services/api/apiClient";
import { Message } from "@/src/types/chat.types";

import { getToken } from "@/src/services/storage/tokenService";

export type InvitationCode = {
  id: number;
  code: string;
  used: boolean;
  usedById: number | null;
  createdById: number;
  recipientPhone: string | null;
  invitationSenderId: number | null;

  status:
    | "AVAILABLE"
    | "RESERVED"
    | "SENT"
    | "REDEEMED"
    | "EXPIRED"
    | "CANCELLED";

  sentAt: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;

  assignedEmail: string | null;
  emailVerified: boolean;
  verifiedAt: string | null;

  createdAt: string;
  updatedAt: string;

  createdByUser: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };

  usedBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;

  invitationSender: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

export const getInvitationCodes = async (): Promise<InvitationCode[]> => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/admin/invitations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Invitation fetch error:", error);

    throw new Error("Failed to fetch invitation codes");
  }

  return response.json();
};

export const cancelInvitationCode = async (
  invitationId: number,
): Promise<InvitationCode> => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/admin/invitations/${invitationId}/cancel`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Cancel invitation error:", error);

    throw new Error("Failed to cancel invitation code");
  }

  const data = await response.json();

  return data.invitation;
};

// Create invitation code
export const createInvitationCode = async (): Promise<InvitationCode> => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/admin/create-invitations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Create invitation error:", error);

    throw new Error("Failed to create invitation");
  }

  return response.json();
};

export type AdminGroup = {
  id: number;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;

  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;

    profile: {
      username: string;
    };
  };

  members: {
    id: number;
  }[];
};

export const getAllGroups = async (): Promise<AdminGroup[]> => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/admin/all-groups`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Group fetch error:", error);

    throw new Error("Failed to fetch groups");
  }

  return response.json();
};

// ================= GROUP DETAILS =================

export type AdminGroupDetails = {
  id: number;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;

  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;

    profile: {
      username: string;
      avatarUrl: string | null;
    } | null;
  };

  members: {
    id: number;
    role: "CREATOR" | "ADMIN" | "MEMBER";
    createdAt: string;

    user: {
      id: number;
      firstName: string;
      lastName: string;

      profile: {
        username: string;
        avatarUrl: string | null;
      } | null;
    };
  }[];

  memberCount: number;
};

export type PendingGroupInvitation = {
  id: number;

  inviterRole: "CREATOR" | "ADMIN" | "MEMBER";

  status: "PENDING";

  createdAt: string;

  group: {
    id: number;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    createdAt: string;

    members: {
      id: number;
    }[];
  };

  invitedBy: {
    id: number;
    firstName: string;
    lastName: string;

    profile: {
      username: string;
      avatarUrl: string | null;
    } | null;
  };
};

export const getAdminGroupDetails = async (
  groupId: number,
): Promise<AdminGroupDetails> => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/admin/groups/${groupId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Group details error:", error);

    throw new Error("Failed to fetch group details");
  }

  return response.json();
};

// ================= GROUP MESSAGES =================

export const getAdminGroupMessages = async (
  groupId: number,
): Promise<Message[]> => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/admin/groups/${groupId}/messages`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Group messages error:", error);

    throw new Error("Failed to fetch group messages");
  }

  return response.json();
};

// ================= PENDING GROUP INVITATIONS =================

export const getPendingGroupInvitations = async (): Promise<
  PendingGroupInvitation[]
> => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/admin/group-invitations`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();

    console.log("Pending invitation error:", error);

    throw new Error("Failed to fetch pending group invitations");
  }

  return response.json();
};

// ================= ACCEPT GROUP INVITATION =================

export const acceptGroupInvitation = async (invitationId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/admin/group-invitations/${invitationId}/accept`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to accept invitation");
  }
  return data;
};

// ================= DECLINE GROUP INVITATION =================

export const declineGroupInvitation = async (invitationId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/admin/group-invitations/${invitationId}/decline`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to decline invitation");
  }

  return data;
};

//SYSTEM STATUS
export type SystemStatusCheck = {
  status: "up" | "down";
  latencyMs?: number;
};

export type SystemStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  service: string;
  timestamp: string;
  uptime: number;

  checks: {
    api: SystemStatusCheck;
    database: SystemStatusCheck;
    redis: SystemStatusCheck;
    storage: SystemStatusCheck;
  };
};

export const getSystemStatus = async (): Promise<SystemStatus> => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/admin/system-status`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("System status fetch error:", error);
    throw new Error("Failed to fetch system status");
  }

  return response.json();
};

//ADMIN DASHBOARD STATS
export type DashboardStats = {
  totalUsers: number;
  totalGroups: number;
  usersGrowthPercent: number | null;
  groupsGrowthPercent: number | null;
};

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/admin/dashboard-stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.log("Dashboard stats fetch error:", error);
    throw new Error("Failed to fetch dashboard stats");
  }

  return response.json();
};

export type RecentActivityType =
  | "USER_REGISTERED"
  | "GROUP_CREATED"
  | "GROUP_UPDATED"
  | "GROUP_DELETED"
  | "INVITATION_CODE_GENERATED"
  | "USER_ADDED_TO_GROUP"
  | "USER_REMOVED_FROM_GROUP"
  | "MEMBER_MUTED"
  | "MEMBER_UNMUTED"
  | "MEMBER_WARNED"
  | "ADMIN_INVITED_TO_GROUP"
  | "ADMIN_JOINED_GROUP"
  | "SETTINGS_UPDATED";

export type RecentActivity = {
  id: number;
  type: RecentActivityType;
  title: string;
  subtitle: string;
  actorId: number | null;
  targetId: number | null;
  metadata: Record<string, any> | null;
  createdAt: string;
};

export type RecentActivitiesResponse = {
  activities: RecentActivity[];
};

export const getRecentActivities = async (
  limit = 5,
): Promise<RecentActivity[]> => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/recent-activity?limit=${limit}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.log("Recent activity fetch error:", error);
    throw new Error("Failed to fetch recent activities");
  }
  const data: RecentActivitiesResponse = await response.json();

  return data.activities;
};
