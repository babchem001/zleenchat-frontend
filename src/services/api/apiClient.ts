import axios from "axios";
import { getToken } from "../storage/tokenService";
// export const API_BASE_URL = "http://172.20.10.12:8000";
export const API_BASE_URL = "https://api.zleenchat.com";;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// REQUEST INTERCEPTOR
apiClient.interceptors.request.use(
  async (config) => {
    const token = await getToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },

  (error) => {
    return Promise.reject(error);
  },
);

// RESPONSE INTERCEPTOR
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    console.log("AXIOS ERROR:", error?.response?.data || error.message);

    return Promise.reject(error?.response?.data || error);
  },
);

export default apiClient;
