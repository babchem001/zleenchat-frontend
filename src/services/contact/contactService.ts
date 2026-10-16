import apiClient from "../api/apiClient";

export const getMessageableContacts = async () => {
  const { data } = await apiClient.get("/contacts/messageable");
  return data;
};
