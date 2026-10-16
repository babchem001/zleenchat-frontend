import { API_BASE_URL } from "@/src/services/api/apiClient";

type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

const apiFetch = async <T = any>(
  endpoint: string,
  options: ApiOptions = {},
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
};

export default apiFetch;
