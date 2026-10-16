import { create } from "zustand";
type ProcessingItem = {
  clientId: string;
  file: any;
};

type MediaProcessingState = {
  queue: ProcessingItem[];

  addToQueue: (clientId: string, file: any) => void;

  removeFromQueue: (clientId: string) => void;

  getNextItem: () => ProcessingItem | null;
};

export const useMediaProcessingStore = create<MediaProcessingState>(
  (set, get) => ({
    queue: [],

    addToQueue: (clientId, file) =>
      set((state) => ({
        queue: [
          ...state.queue,
          {
            clientId,
            file,
          },
        ],
      })),

    removeFromQueue: (clientId) =>
      set((state) => ({
        queue: state.queue.filter((item) => item.clientId !== clientId),
      })),

    getNextItem: () => {
      const queue = get().queue;
      return queue.length ? queue[0] : null;
    },
  }),
);
