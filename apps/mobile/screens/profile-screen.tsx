import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../components/mobile/app-theme";
import { Card, HelperText, ScreenScroll, SectionTitle } from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

export function ProfileScreen() {
  return (
    <MobileShell
      title="Profile"
      subtitle="Blueprint for user and artist pages"
    >
      <ScreenScroll>
        <Card>
          <SectionTitle>Profile / Artist</SectionTitle>
          <HelperText>
            Rebuild the mobile web profile view here: banner, avatar, follow/friend
            actions, tabs, reposts, tracks, and playlists.
          </HelperText>
          <View style={styles.banner} />
        </Card>
      </ScreenScroll>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%",
    height: 140,
    borderRadius: 24,
    backgroundColor: "#1c1b22",
  },
});
