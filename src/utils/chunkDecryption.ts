import Aes from "react-native-aes-crypto";

const hexToBase64 = (hex: string) => {
  let binary = "";

  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
  }

  return global.btoa(binary);
};

export const decryptChunk = async ({
  encryptedChunk,
  aesKey,
  iv,
}: {
  encryptedChunk: string;
  aesKey: string;
  iv: string;
}) => {
  const decryptedHex = await Aes.decrypt(
    encryptedChunk,
    aesKey,
    iv,
    "aes-256-cbc",
  );

  return hexToBase64(decryptedHex);
};
