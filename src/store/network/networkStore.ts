import { create } from "zustand";

type NetworkStore = {
  isOnline: boolean;

  setOnlineStatus: (status: boolean) => void;
};

export const useNetworkStore = create<NetworkStore>((set) => ({
  isOnline: true,

  setOnlineStatus: (status) =>
    set({
      isOnline: status,
    }),
}));
