import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Message } from "@/src/types/chat.types";
type UploadQueueState = {
  queuedMessages: Message[];
  addQueuedMessage: (message: Message) => void;
  updateQueuedMessage: (clientId: string, updates: Partial<Message>) => void;
  removeQueuedMessage: (clientId: string) => void;
};
export const useUploadQueueStore = create<UploadQueueState>()(
  persist(
    (set) => ({
      queuedMessages: [],

      addQueuedMessage: (message) =>
        set((state) => ({
          queuedMessages: [...state.queuedMessages, message],
        })),

      updateQueuedMessage: (clientId, updates) =>
        set((state) => ({
          queuedMessages: state.queuedMessages.map((msg) =>
            msg.clientId === clientId
              ? {
                  ...msg,
                  ...updates,
                }
              : msg,
          ),
        })),

      removeQueuedMessage: (clientId) =>
        set((state) => ({
          queuedMessages: state.queuedMessages.filter(
            (msg) => msg.clientId !== clientId,
          ),
        })),
    }),

    {
      name: "upload-queue-storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
