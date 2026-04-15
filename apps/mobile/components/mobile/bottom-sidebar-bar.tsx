import React, { useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

import { AppTheme } from "./app-theme";
import { useAuth } from "./auth-context";

const PLAYLISTS = [
  "Night Drive",
  "Late Hours",
  "Liked Right Now",
  "Reposts Mix",
  "New Finds",
];

const PRIMARY_LABELS: Record<string, string> = {
  index: "Home",
  profile: "Profile",
  likes: "Liked Songs",
  library: "Library",
  new: "New",
};

const PRIMARY_ICONS: Record<string, string> = {
  index: "⌂",
  profile: "◌",
  likes: "♡",
  library: "☰",
  new: "✦",
};

export function BottomSidebarBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [page, setPage] = useState(0);
  const auth = useAuth();

  const primaryRoutes = useMemo(
    () =>
      state.routes.filter((route) =>
        ["index", "profile", "likes", "library", "new"].includes(route.name),
      ),
    [state.routes],
  );

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / width);
    setPage(nextPage);
  };

  const jumpToPage = (nextPage: number) => {
    scrollRef.current?.scrollTo({ x: width * nextPage, animated: true });
    setPage(nextPage);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.page, { width }]}>
          <View style={styles.navRow}>
            {primaryRoutes.map((route) => {
              const routeIndex = state.routes.findIndex((candidate) => candidate.key === route.key);
              const isFocused = state.index === routeIndex;
              const label =
                PRIMARY_LABELS[route.name] ||
                descriptors[route.key]?.options.title ||
                route.name;

              return (
                <Pressable
                  key={route.key}
                  style={[styles.navButton, isFocused && styles.navButtonActive]}
                  onPress={() => navigation.navigate(route.name)}
                >
                  <Text style={[styles.navIcon, isFocused && styles.navIconActive]}>
                    {PRIMARY_ICONS[route.name] || "•"}
                  </Text>
                  <Text style={[styles.navLabel, isFocused && styles.navLabelActive]} numberOfLines={1}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[styles.page, { width }]}>
          <View style={styles.playlistRow}>
            {PLAYLISTS.map((playlist) => (
              <Pressable key={playlist} style={styles.playlistChip}>
                <View style={styles.playlistCover} />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.page, styles.logoutPage, { width }]}>
          <Pressable style={styles.logoutButton} onPress={() => void auth.logout()}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.dots}>
        {[0, 1, 2].map((dot) => (
          <Pressable
            key={dot}
            onPress={() => jumpToPage(dot)}
            style={[styles.dot, page === dot && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#09090b",
    borderTopWidth: 1,
    borderTopColor: AppTheme.line,
    paddingTop: 6,
    paddingBottom: 8,
  },
  scrollContent: {
    alignItems: "stretch",
  },
  page: {
    paddingHorizontal: 12,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navButton: {
    width: "20%",
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  navButtonActive: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  navIcon: {
    color: AppTheme.textSoft,
    fontSize: 16,
    lineHeight: 18,
    marginBottom: 2,
  },
  navIconActive: {
    color: AppTheme.text,
  },
  navLabel: {
    color: AppTheme.textSoft,
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 2,
  },
  navLabelActive: {
    color: AppTheme.text,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playlistChip: {
    width: "18%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
  },
  playlistCover: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#23232a",
  },
  logoutPage: {
    justifyContent: "center",
  },
  logoutButton: {
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoutText: {
    color: AppTheme.text,
    fontSize: 14,
    fontWeight: "800",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  dotActive: {
    backgroundColor: "rgba(255,255,255,0.8)",
  },
});
