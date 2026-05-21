import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Matches web: linear-gradient(135deg, #0f172a 0%, #172554 52%, #134e4a 100%)
const GRADIENT_COLORS: [string, string, string] = ["#0f172a", "#172554", "#134e4a"];
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END   = { x: 1, y: 1 };

export interface GradientHeroProps {
  readonly children?: React.ReactNode;
  readonly title?: string;
  readonly subtitle?: string;
  readonly style?: ViewStyle;
  readonly borderRadius?: number;
  readonly padding?: number;
}

function normalizeChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (child == null || typeof child === "boolean") {
      return child;
    }
    if (typeof child === "string" || typeof child === "number") {
      return <Text>{String(child)}</Text>;
    }
    return child;
  });
}

export function GradientHero({
  children,
  title,
  subtitle,
  style,
  borderRadius = 20,
  padding = 20,
}: GradientHeroProps) {
  return (
    <LinearGradient
      colors={GRADIENT_COLORS}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={[styles.base, { borderRadius, padding }, style]}
      >
      {(title || subtitle) && (
        <View style={styles.copyBlock}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      )}
      {normalizeChildren(children)}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    marginBottom: 16,
    overflow: "hidden",
  },
  copyBlock: {
    gap: 6,
    marginBottom: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  subtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 19,
  },
});
