import "react-native-get-random-values";
import Aes from "react-native-aes-crypto";

// ================= MASTER KEY =================
// TEMPORARY APP MASTER KEY
// Later replaced with recipient public-key encryption

const MASTER_KEY = "7f3a5b2c9d4e8f1a6b7c3d5e9f2a1b4c";

export const generateMediaKey = async () => {
  return Aes.randomKey(32);
};

export const encryptMediaKey = async (mediaKey: string) => {
  // ================= RANDOM IV =================

  const iv = await Aes.randomKey(16);

  // ================= AES-GCM =================

  const encryptedKey = await Aes.encrypt(
    mediaKey,
    MASTER_KEY,
    iv,
    "aes-256-cbc",
  );

  // const [ciphertext, authTag] = encryptedKey.split(":");

  return {
    encryptedKey,
    keyIV: iv,
    // keyAuthTag: authTag,
  };
};

// ================= DECRYPT MEDIA AES KEY =================

export const decryptMediaKey = async ({
  encryptedKey,
  keyIV,
  keyAuthTag,
}: {
  encryptedKey: string;
  keyIV: string;
  keyAuthTag: string | null;
}) => {
  // console.log("encryptedKey", encryptedKey);
  // console.log("keyIV", keyIV);
  // console.log("keyAuthTag", keyAuthTag);

  const payload = keyAuthTag ? `${encryptedKey}:${keyAuthTag}` : encryptedKey;
  const result = await Aes.decrypt(payload, MASTER_KEY, keyIV, "aes-256-cbc");


  // console.log("DECRYPTED MEDIA KEY:", result);
  // console.log("DECRYPTED MEDIA KEY LENGTH:", result?.length);

  return result;
};
