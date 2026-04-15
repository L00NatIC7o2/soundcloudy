import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { AppTheme } from "../components/mobile/app-theme";
import { useAuth } from "../components/mobile/auth-context";
import { LoginGate } from "../components/mobile/login-gate";
import { Card, HelperText, ScreenScroll, SectionTitle } from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

const LIBRARY_SECTIONS = [
  {
    title: "Liked Songs",
    subtitle: "Port the mobile liked tracks list here.",
  },
  {
    title: "Playlists",
    subtitle: "Port playlist browsing, creation, and add/remove flows here.",
  },
  {
    title: "Profile",
    subtitle: "Port the mobile profile and artist views here.",
  },
  {
    title: "Friends",
    subtitle: "Port the live listening activity and social tab here.",
  },
];

export function LibraryScreen() {
  const auth = useAuth();

  if (!auth.authenticated) {
    return (
      <LoginGate
        loading={auth.loading}
        label={auth.label}
        onLogin={() => void auth.login()}
      />
    );
  }

  return (
    <MobileShell
      title="Library"
      subtitle="Native version of the mobile web library and sidebar views"
    >
      <ScreenScroll>
        <Card>
          <SectionTitle>Library</SectionTitle>
          <HelperText>
            This tab is the native home for the mobile web sidebar destinations:
            likes, playlists, profile, and friends.
          </HelperText>
        </Card>

        {LIBRARY_SECTIONS.map((section) => (
          <Pressable key={section.title} style={styles.libraryCard}>
            <Text style={styles.libraryTitle}>{section.title}</Text>
            <Text style={styles.librarySubtitle}>{section.subtitle}</Text>
          </Pressable>
        ))}
      </ScreenScroll>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  libraryCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: AppTheme.panelAlt,
    borderWidth: 1,
    borderColor: AppTheme.line,
    gap: 8,
  },
  libraryTitle: {
    color: AppTheme.text,
    fontSize: 17,
    fontWeight: "700",
  },
  librarySubtitle: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
