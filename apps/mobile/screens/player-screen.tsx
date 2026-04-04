import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../components/mobile/app-theme";
import { Card, HelperText, ScreenScroll, SectionTitle } from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

export function PlayerScreen() {
  return (
    <MobileShell
      title="Player"
      subtitle="Blueprint for the native player sheet"
    >
      <ScreenScroll>
        <Card>
          <SectionTitle>Player Sheet</SectionTitle>
          <HelperText>
            Rebuild the mobile web player sheet here: artwork, metadata, progress,
            controls, queue, details page, and device handoff.
          </HelperText>
          <View style={styles.playerMock}>
            <View style={styles.cover} />
            <Text style={styles.title}>Current Track Title</Text>
            <Text style={styles.artist}>Artist Name</Text>
          </View>
        </Card>
      </ScreenScroll>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  playerMock: {
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  cover: {
    width: 220,
    height: 220,
    borderRadius: 28,
    backgroundColor: "#1e1d23",
  },
  title: {
    color: AppTheme.text,
    fontSize: 20,
    fontWeight: "800",
  },
  artist: {
    color: AppTheme.textMuted,
    fontSize: 14,
  },
});
