import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../components/mobile/app-theme";
import { MobilePlayerTrack, usePlayer } from "../components/mobile/player-context";
import { Card, HelperText, ScreenScroll, SectionTitle } from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

const LIKED_TRACKS: MobilePlayerTrack[] = [
  {
    id: 601,
    title: "Glass Static",
    artist: "Soundcloudy",
    context: "Liked Songs",
  },
  {
    id: 602,
    title: "No Reply Needed",
    artist: "Soundcloudy",
    context: "Liked Songs",
  },
  {
    id: 603,
    title: "Your Favorite Ghost",
    artist: "Soundcloudy",
    context: "Liked Songs",
  },
];

export function LikesScreen() {
  const player = usePlayer();

  return (
    <MobileShell title="Liked Songs" subtitle="Native mobile liked tracks view">
      <ScreenScroll>
        <Card>
          <SectionTitle>Liked Songs</SectionTitle>
          <HelperText>
            This is the native liked tracks lane. Tap any row to send it into the
            shared player.
          </HelperText>
        </Card>

        {LIKED_TRACKS.map((track) => (
          <Pressable
            key={track.id}
            style={styles.trackRow}
            onPress={() => player.playTrack(track, LIKED_TRACKS)}
          >
            <View style={styles.trackArtwork}>
              <Text style={styles.trackArtworkText}>
                {track.title.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={styles.trackMeta}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {track.title}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {track.artist}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScreenScroll>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    padding: 14,
    backgroundColor: AppTheme.panelAlt,
    borderWidth: 1,
    borderColor: AppTheme.line,
  },
  trackArtwork: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#1b1b23",
    alignItems: "center",
    justifyContent: "center",
  },
  trackArtworkText: {
    color: AppTheme.text,
    fontSize: 18,
    fontWeight: "800",
  },
  trackMeta: {
    flex: 1,
    gap: 4,
  },
  trackTitle: {
    color: AppTheme.text,
    fontSize: 15,
    fontWeight: "700",
  },
  trackArtist: {
    color: AppTheme.textSoft,
    fontSize: 13,
  },
});
