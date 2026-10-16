import Aes from "react-native-aes-crypto";
import { secureDeleteFile } from "../services/chat/secureDelete";
const base64ToHex = (base64: string) => {
  const binary = global.atob(base64);
  let hex = "";
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return hex;
};

//Hex -> BASE64
const hexToBase64 = (hex: string) => {
  let binary = "";
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }

  return global.btoa(binary);
};

// Decrypt media
export const decryptMediaFile = async ({
  encryptedBase64,
  aesKey,
  iv,
  // authTag,
}: {
  encryptedBase64: string;
  aesKey: string;
  iv: string;
  // authTag: string;
}) => {
  //  BASE64 -> Hex
  const cipherHex = base64ToHex(encryptedBase64);

  // RESTORE FORMAT
  // const encryptedPayload = `${cipherHex}:${authTag}`;
  // Aes DECRYPT
  let decryptedHex = await Aes.decrypt(
    // encryptedPayload,
    cipherHex,
    aesKey,
    iv,
    "aes-256-cbc",
  );
  const result = hexToBase64(decryptedHex);
  decryptedHex = ""; // Clear from memory
  return result;
};
