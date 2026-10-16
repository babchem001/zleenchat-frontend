import apiClient from "../api/apiClient";

// Define types for profile data

export type Settings = {
  allowDMFromAnyone: boolean;
  allowUplineDM: boolean;
  allowUplineView: boolean;
  publicProfileVisible: boolean;
  hideEmail: boolean;
};

// Get Settings
export const getMySettings = async (): Promise<Settings> => {
  return await apiClient("/settings/my-settings");
};

// Update Settings
export const updateMySettings = async (
  data: Partial<Settings>,
): Promise<Settings> => {
  return await apiClient("/settings/update-my-settings", {
    method: "PUT",
    data,
  });
};
