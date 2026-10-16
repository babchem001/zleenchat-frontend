import { create } from "zustand";

type TypingState = {
  typingUsers: Record<number, boolean>;

  setTyping: (userId: number, value: boolean) => void;
};

export const useTypingStore = create<TypingState>((set) => ({
  typingUsers: {},

  setTyping: (userId, value) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [userId]: value,
      },
    })),
}));
