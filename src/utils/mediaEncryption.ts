import "react-native-get-random-values";
import * as Crypto from "expo-crypto";
// Random hex
const generateRandomHex = async (length: number) => {
  const bytes = await Crypto.getRandomBytesAsync(length);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};
//Generate file aes key
export const generateMediaKey = async () => {
  // const key = await Aes.randomKey(32);

  // console.log(
  //   "GENERATED MEDIA KEY",
  //   key,
  //   key.length
  // )
  // 32 bytes = 256-bit AES key
  return generateRandomHex(32);
};
