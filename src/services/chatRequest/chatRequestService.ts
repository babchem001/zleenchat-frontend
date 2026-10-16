import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

export const sendChatRequest = async (receiverId: number) => {
  const token = await getToken();

  const response = await fetch(
    `${API_BASE_URL}/chat-request/create/${receiverId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error("Request failed");
  return response.json();
};

export const getMyChatRequest = async () => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/chat-request/my-requests`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.log("❌ Request error:", errorText);
    throw new Error("Failed to fetch chat requests");
  }

  return response.json();
};

export const acceptChatRequest = async (id: number) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/chat-request/accept/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log("❌ Accept error:", errorText);
    throw new Error("Failed to accept chat request");
  }

  return response.json();
};

export const declineChatRequest = async (id: number) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/chat-request/decline/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log("❌ Decline error:", errorText);
    throw new Error("Failed to decline chat request");
  }

  return response.json();
};
