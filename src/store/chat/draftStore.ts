import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type Drafts = Record<string, string>;

type DraftState = {
  drafts: Drafts;

  setDraft: (key: string, value: string) => void;
  clearDraft: (key: string) => void;
  clearUserDrafts: (userId: number) => void;
};

export const getDirectDraftKey = (userId: number, otherUserId: number) => {
  return `user:${userId}:direct:${otherUserId}`;
};

export const getGroupDraftKey = (userId: number, groupId: number) => {
  return `user:${userId}:group:${groupId}`;
};

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},

      setDraft: (key, value) =>
        set((state) => {
          const nextDrafts = {
            ...state.drafts,
          };

          // Empty/whitespace-only input means there is no draft.
          if (!value.trim()) {
            delete nextDrafts[key];
          } else {
            // Preserve the user's exact text.
            nextDrafts[key] = value;
          }

          return {
            drafts: nextDrafts,
          };
        }),

      clearDraft: (key) =>
        set((state) => {
          if (!(key in state.drafts)) {
            return state;
          }

          const nextDrafts = {
            ...state.drafts,
          };

          delete nextDrafts[key];

          return {
            drafts: nextDrafts,
          };
        }),

      clearUserDrafts: (userId) =>
        set((state) => {
          const prefix = `user:${userId}:`;

          const nextDrafts = Object.fromEntries(
            Object.entries(state.drafts).filter(
              ([key]) => !key.startsWith(prefix),
            ),
          );

          return {
            drafts: nextDrafts,
          };
        }),
    }),
    {
      name: "zleenchat-chat-drafts-v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
