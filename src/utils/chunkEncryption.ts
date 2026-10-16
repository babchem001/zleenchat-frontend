import "react-native-get-random-values";
import Aes from "react-native-aes-crypto";
import * as Crypto from "expo-crypto";

const generateRandomHex = async (length: number) => {
  const bytes = await Crypto.getRandomBytesAsync(length);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const base64ToHex = (base64: string) => {
  const binary = global.atob(base64);

  let hex = "";

  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, "0");
  }

  return hex;
};

export const encryptChunk = async ({
  chunkBase64,
  aesKey,
}: {
  chunkBase64: string;
  aesKey: string;
}) => {
  const iv = await generateRandomHex(16);
  const chunkHex = base64ToHex(chunkBase64);
  const encryptedChunk = await Aes.encrypt(chunkHex, aesKey, iv, "aes-256-cbc");

  return {
    encryptedChunk,
    iv,
  };
};
