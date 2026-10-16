import { useEffect, useRef } from "react";
import { Animated } from "react-native";

export function useSelectionAnimation(selected: boolean) {
  const scale = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const opacity = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    if (selected) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 0,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 90,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [selected, scale, opacity]);

  return {
    scale,
    opacity,
  };
}