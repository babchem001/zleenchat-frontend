import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";

const SPLASH_BACKGROUND = "#FFFFFF";

export default function SplashScreen() {
  const { width, height } = useWindowDimensions();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const entranceAnimation = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 45,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 500,
        delay: 350,
        useNativeDriver: true,
      }),
    ]);

    entranceAnimation.start();

    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.035,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    const pulseTimeout = setTimeout(() => {
      pulseAnimation.start();
    }, 700);

    return () => {
      clearTimeout(pulseTimeout);
      pulseAnimation.stop();
      entranceAnimation.stop();
    };
  }, [logoOpacity, logoScale, taglineOpacity]);

  const logoSize = Math.min(Math.max(width * 0.42, 150), 220);

  return (
    <View
      style={[
        styles.container,
        {
          minHeight: height,
        },
      ]}
    >
      <StatusBar style="dark" />

      <View style={styles.centerContent}>
        <Animated.View
          style={[
            styles.logoWrapper,
            {
              width: logoSize,
              height: logoSize,
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require("@/assets/images/zalvro_icon_optimized.png")}
            style={styles.logo}
            resizeMode="contain"
            accessible
            accessibilityLabel="Zalvro logo"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.branding,
            {
              opacity: taglineOpacity,
            },
          ]}
        >
          <Text style={styles.brandName}>Zleenchat</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  centerContent: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  logoWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },

  logo: {
    width: "100%",
    height: "100%",
  },

  branding: {
    marginTop: 18,
    alignItems: "center",
  },

  brandName: {
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#111827",
  },

  footer: {
    position: "absolute",
    bottom: 42,
    alignItems: "center",
  },

  loadingText: {
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.6,
    color: "#667085",
  },
});
