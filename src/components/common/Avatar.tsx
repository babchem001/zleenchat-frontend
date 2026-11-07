import React, { useEffect, useState } from "react";
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { API_BASE_URL } from "@/src/services/api/apiClient";
import { getToken } from "@/src/services/storage/tokenService";

type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
  fallbackStyle?: StyleProp<ViewStyle>;
};

export default function Avatar({
  uri,
  name,
  size = 48,
  containerStyle,
  imageStyle,
  textStyle,
  fallbackStyle,
}: AvatarProps) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const loadToken = async () => {
      try {
        const storedToken = await getToken();

        if (active) {
          setToken(storedToken);
        }
      } catch (error) {
        console.warn("AVATAR TOKEN LOAD ERROR:", error);
      } finally {
        if (active) {
          setTokenReady(true);
        }
      }
    };

    loadToken();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setImageFailed(false);
  }, [uri]);

  const initial = name?.trim()?.charAt(0)?.toUpperCase() || "U";

  const suppliedUri = uri?.trim() || null;
  const rawR2AvatarMatch = suppliedUri?.match(/^\/?avatars\/user-(\d+)\//);

  const resolvedUri = rawR2AvatarMatch
    ? `/profile/${rawR2AvatarMatch[1]}/avatar`
    : suppliedUri;

  const imageUri = resolvedUri
    ? resolvedUri.startsWith("http")
      ? resolvedUri
      : `${API_BASE_URL}${resolvedUri.startsWith("/") ? "" : "/"}${resolvedUri}`
    : null;

  const showImage = Boolean(imageUri && tokenReady && token && !imageFailed);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        containerStyle,
      ]}
    >
      {showImage ? (
        <Image
          source={{
            uri: imageUri!,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
            imageStyle,
          ]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
            fallbackStyle,
          ]}
        >
          <Text
            style={[
              styles.initial,
              { fontSize: Math.max(14, size * 0.42) },
              textStyle,
            ]}
          >
            {initial}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#E8EEFF",
    alignItems: "center",
    justifyContent: "center",
  },

  image: {
    resizeMode: "cover",
  },

  fallback: {
    backgroundColor: "#E8EEFF",
    alignItems: "center",
    justifyContent: "center",
  },

  initial: {
    color: "#2563EB",
    fontWeight: "700",
  },
});
