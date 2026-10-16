import { create } from "zustand";

export type SelectedMember = {
  id: number;
  username: string;
  avatarUrl: string | null;
};

type GroupCreationState = {
  groupName: string;
  selectedMembers: SelectedMember[];

  // Temporary user passed from User Details
  targetUser: SelectedMember | null;
  setGroupName: (name: string) => void;
  toggleMember: (member: SelectedMember) => void;
  setTargetUser: (member: SelectedMember | null) => void;

  clear: () => void;
};

export const useGroupCreationStore = create<GroupCreationState>((set, get) => ({
  groupName: "",

  selectedMembers: [],

  targetUser: null,

  setGroupName: (groupName) =>
    set({
      groupName,
    }),

  toggleMember: (member) => {
    const exists = get().selectedMembers.some((m) => m.id === member.id);

    if (exists) {
      set({
        selectedMembers: get().selectedMembers.filter(
          (m) => m.id !== member.id,
        ),
      });
    } else {
      set({
        selectedMembers: [...get().selectedMembers, member],
      });
    }
  },

  setTargetUser: (member) =>
    set({
      targetUser: member,
    }),

  clear: () =>
    set({
      groupName: "",
      selectedMembers: [],
      targetUser: null,
    }),
}));
