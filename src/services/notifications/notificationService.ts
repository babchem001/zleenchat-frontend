import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

export const getMyNotifications = async () => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/notifications/my-notifications`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  return response.json();
};

export const markNotificationAsRead = async (notificationId: number) => {
  const token = await getToken();
  const response = await fetch(
    `${API_BASE_URL}/notifications/${notificationId}/read`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }

  return response.json();
};

export const registerDeviceToken = async (token: string, platform: string) => {
  const authToken = await getToken();
  const response = await fetch(
    `${API_BASE_URL}/notifications/register-device-token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to register device token");
  }

  return response.json();
};
