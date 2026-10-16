import * as FileSystem from "expo-file-system/legacy";

export const secureDeleteFile = async (uri: string | null) => {
  if (!uri) return;

  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return;
    }
    await FileSystem.writeAsStringAsync(uri, "");
    await FileSystem.deleteAsync(uri, {
      idempotent: true,
    });
  } catch (error) {
    console.error("Secure delete error:", error);
  }
};
