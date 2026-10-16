import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "ogarena_token";

const saveToken = async (access_token: string): Promise<void> => {
  // console.log("SAVING TOKEN:", access_token);
  await AsyncStorage.setItem(TOKEN_KEY, access_token);

  const check = await AsyncStorage.getItem(TOKEN_KEY);
  // console.log("TOKEN AFTER SAVE:", check);
};

const getToken = async (): Promise<string | null> => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  // console.log("GET TOKEN:", token);
  return await AsyncStorage.getItem(TOKEN_KEY);
};

const removeToken = async (): Promise<void> => {
  await AsyncStorage.removeItem(TOKEN_KEY);
};

export { saveToken, getToken, removeToken };
