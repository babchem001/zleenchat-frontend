import { create } from "zustand";
import { jwtDecode } from "jwt-decode";
import NetInfo from "@react-native-community/netinfo";

import {
  saveToken,
  getToken,
  removeToken,
} from "@/src/services/storage/tokenService";
import {
  loginUser,
  logoutUser,
  validateSession,
} from "@/src/services/auth/authService";

type User = {
  sub: number;
  email: string;
  firstName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  username: string;
  exp?: number;
  iat?: number;
};

type AuthState = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
};

const STORAGE_TIMEOUT_MS = 3000;
const SESSION_VALIDATION_TIMEOUT_MS = 3000;
const RETRY_DELAY_MS = 250;
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Startup operation timed out"));
      }, timeoutMs);
    }),
  ]);
};

const getStoredTokenWithRetry = async (): Promise<string | null> => {
  try {
    return await withTimeout(getToken(), STORAGE_TIMEOUT_MS);
  } catch (error) {
    console.warn("AUTH STORAGE FIRST READ FAILED:", error);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return await withTimeout(getToken(), STORAGE_TIMEOUT_MS);
  }
};

const isJwtExpired = (decoded: User): boolean => {
  if (typeof decoded.exp !== "number") {
    return true;
  }

  return decoded.exp * 1000 <= Date.now();
};

type SessionValidationResult =
  | { status: "valid"; user?: User }
  | { status: "invalid" }
  | { status: "unavailable" };

const validateStoredSession = async (
  token: string,
): Promise<SessionValidationResult> => {
  const attempt = async (): Promise<SessionValidationResult> => {
    try {
      const response = await withTimeout(
        validateSession(token),
        SESSION_VALIDATION_TIMEOUT_MS,
      );

      return {
        status: "valid",
        user: response.user,
      };
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        return {
          status: "invalid",
        };
      }

      console.warn("STARTUP SESSION VALIDATION UNAVAILABLE:", error);

      return {
        status: "unavailable",
      };
    }
  };

  const firstAttempt = await attempt();

  if (firstAttempt.status !== "unavailable") {
    return firstAttempt;
  }
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

  return await attempt();
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,

  // LOGIN
  login: async (email, password) => {
    const response = await loginUser(email, password);
    const token = response.access_token;
    await saveToken(token);
    const decoded: User = jwtDecode<User>(token);

    set({
      token,
      user: decoded,
      isAuthenticated: true,
      isHydrated: true,
    });
  },

  // LOGOUT
  logout: async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("LOGOUT REQUEST ERROR:", error);
    } finally {
      await removeToken();

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isHydrated: true,
      });
    }
  },

  // LOAD USER (AUTO LOGIN)
  loadUser: async () => {
    if (get().isHydrated) {
      return;
    }

    try {
      const token = await getStoredTokenWithRetry();

      if (!token) {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isHydrated: true,
        });

        return;
      }

      let decoded: User;

      try {
        decoded = jwtDecode<User>(token);
      } catch (error) {
        console.warn("INVALID STORED JWT:", error);

        await removeToken();

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isHydrated: true,
        });

        return;
      }
      if (isJwtExpired(decoded)) {
        console.warn("STORED JWT HAS EXPIRED");

        await removeToken();

        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isHydrated: true,
        });

        return;
      }

      let networkState;

      try {
        networkState = await withTimeout(
          NetInfo.fetch(),
          SESSION_VALIDATION_TIMEOUT_MS,
        );
      } catch (error) {
        console.warn("STARTUP NETWORK CHECK FAILED:", error);
        networkState = null;
      }

      const canValidateOnline =
        networkState?.isConnected === true &&
        networkState?.isInternetReachable !== false;

      if (canValidateOnline) {
        const validation = await validateStoredSession(token);

        if (validation.status === "invalid") {
          console.warn(
            "STORED SESSION IS NO LONGER VALID. CLEARING LOCAL SESSION.",
          );

          await removeToken();

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isHydrated: true,
          });

          return;
        }

        if (validation.status === "valid" && validation.user) {
          decoded = {
            ...decoded,
            ...validation.user,
          };
        }
      }
      set({
        token,
        user: decoded,
        isAuthenticated: true,
        isHydrated: true,
      });
    } catch (error) {
      console.error("AUTH HYDRATION ERROR:", error);

      try {
        await removeToken();
      } catch (removeError) {
        console.error("FAILED TO REMOVE INVALID TOKEN:", removeError);
      }

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isHydrated: true,
      });
    } finally {
      if (!get().isHydrated) {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isHydrated: true,
        });
      }
    }
  },
}));
