import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppTheme } from "./app-theme";

const PRIMARY_LABELS: Record<string, string> = {
  index: "Discover",
  profile: "Profile",
  likes: "Likes",
  library: "Library",
  new: "New",
};

const PRIMARY_ICONS: Record<string, string> = {
  index: "compass-outline",
  profile: "person-outline",
  likes: "heart-outline",
  library: "albums-outline",
  new: "add-circle-outline",
};

export function BottomSidebarBar({
  state,
  descriptors,
  navigateToTab,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const primaryRoutes = state.routes.filter((route) =>
    Object.prototype.hasOwnProperty.call(PRIMARY_LABELS, route.name),
  );

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.navRow}>
        {primaryRoutes.map((route) => {
          const routeIndex = state.routes.findIndex(
            (candidate) => candidate.key === route.key,
          );
          const isFocused = state.index === routeIndex;
          const label =
            PRIMARY_LABELS[route.name] ||
            descriptors[route.key]?.options.title ||
            route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              style={styles.navButton}
              onPress={() => navigateToTab(route.key)}
            >
              <Ionicons
                name={
                  (PRIMARY_ICONS[route.name] || "ellipse-outline") as React.ComponentProps<
                    typeof Ionicons
                  >["name"]
                }
                size={21}
                color={isFocused ? AppTheme.text : AppTheme.textSoft}
              />
              <Text
                style={[styles.navLabel, isFocused && styles.navLabelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#08080a",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 4,
    paddingBottom: 8,
  },
  navRow: {
    minHeight: 48,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  navButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  navLabel: {
    color: AppTheme.textSoft,
    fontSize: 9,
    fontWeight: "600",
  },
  navLabelActive: {
    color: AppTheme.text,
  },
});
