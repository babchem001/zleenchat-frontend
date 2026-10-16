import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

export const searchUsers = async (query: string) => {
  const token = await getToken();

  const response = await fetch(`${API_BASE_URL}/users/search?search=${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
};
