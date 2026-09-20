import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppTheme } from "../components/mobile/app-theme";
import { useAuth } from "../components/mobile/auth-context";
import {
  MobilePlayerTrack,
  usePlayer,
} from "../components/mobile/player-context";
import { LoginGate } from "../components/mobile/login-gate";
import {
  Card,
  HelperText,
  ScreenScroll,
  SectionTitle,
  SecondaryButton,
} from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

const FEATURE_CARDS = [
  {
    title: "Liked Songs",
    subtitle: "Native version of the mobile liked-songs lane.",
  },
  {
    title: "Playlists",
    subtitle: "Personal and shared playlists mirrored from the main app.",
  },
  {
    title: "Friends",
    subtitle: "Live listening activity and the social sidebar rebuilt natively.",
  },
];

const FEATURED_TRACKS: MobilePlayerTrack[] = [
  {
    id: 501,
    title: "Night Corridor",
    artist: "Soundcloudy",
    context: "Featured Home Mix",
  },
  {
    id: 502,
    title: "Static Hearts",
    artist: "Soundcloudy",
    context: "Featured Home Mix",
  },
  {
    id: 503,
    title: "Late Reply",
    artist: "Soundcloudy",
    context: "Featured Home Mix",
  },
];

export function HomeScreen() {
  const auth = useAuth();
  const player = usePlayer();

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
      title="Soundcloudy"
      subtitle="Native mobile home based on the web app"
    >
      <ScreenScroll>
        <Card alt>
          <Text style={styles.eyebrow}>Native Blueprint</Text>
          <Text style={styles.heroTitle}>
            The mobile app should mirror the main app, just built natively.
          </Text>
          <Text style={styles.heroSubtitle}>
            This home screen is the native starting point for the same product
            flow you already designed on the mobile web app.
          </Text>
        </Card>

        <Card>
          <View style={styles.rowHeader}>
            <SectionTitle>Account</SectionTitle>
            <SecondaryButton label="Refresh" onPress={() => void auth.refresh()} />
          </View>
          <HelperText>
            Signed in as {auth.label}
          </HelperText>
          <View style={styles.accountPill}>
            <Text style={styles.accountPillLabel}>SoundCloud</Text>
            <Text style={styles.accountPillValue}>
              {auth.loading ? "Checking..." : auth.label}
            </Text>
          </View>
        </Card>

        <Card>
          <SectionTitle>Now Playing</SectionTitle>
          <HelperText>
            This becomes the native collapsed player and full player sheet from
            the mobile web app.
          </HelperText>
          {player.currentTrack ? (
            <Pressable
              style={styles.previewRow}
              onPress={() => player.openSheet()}
            >
              <View style={styles.artwork}>
                <Text style={styles.artworkLabel}>
                  {player.currentTrack.title.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.previewMeta}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {player.currentTrack.title}
                </Text>
                <Text style={styles.previewArtist} numberOfLines={1}>
                  {player.currentTrack.artist}
                </Text>
              </View>
              <SecondaryButton
                label={player.isPlaying ? "Pause" : "Play"}
                onPress={() => player.togglePlayback()}
              />
            </Pressable>
          ) : (
            <View style={styles.previewRow}>
              <View style={styles.artwork} />
              <View style={styles.previewMeta}>
                <Text style={styles.previewTitle}>No track loaded yet</Text>
                <Text style={styles.previewArtist}>
                  Tap a featured track below to start the native player.
                </Text>
              </View>
            </View>
          )}
        </Card>

        <Card>
          <View style={styles.rowHeader}>
            <SectionTitle>Featured Tracks</SectionTitle>
            <SecondaryButton
              label="Open Player"
              onPress={() => {
                if (player.currentTrack) {
                  player.openSheet();
                } else {
                  player.playTrack(FEATURED_TRACKS[0], FEATURED_TRACKS);
                }
              }}
            />
          </View>
          {FEATURED_TRACKS.map((track) => (
            <Pressable
              key={track.id}
              style={styles.trackRow}
              onPress={() => player.playTrack(track, FEATURED_TRACKS)}
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
        </Card>

        {FEATURE_CARDS.map((card) => (
          <Pressable key={card.title} style={styles.featureCard}>
            <Text style={styles.featureTitle}>{card.title}</Text>
            <Text style={styles.featureSubtitle}>{card.subtitle}</Text>
          </Pressable>
        ))}
      </ScreenScroll>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    color: AppTheme.accentSoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    color: AppTheme.text,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  heroSubtitle: {
    color: "#a9a3b0",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  accountPill: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#0c0c10",
  },
  accountPillLabel: {
    color: AppTheme.textSoft,
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  accountPillValue: {
    color: AppTheme.text,
    fontSize: 14,
    fontWeight: "700",
  },
  previewRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  artwork: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#1f1d25",
    alignItems: "center",
    justifyContent: "center",
  },
  artworkLabel: {
    color: AppTheme.text,
    fontSize: 24,
    fontWeight: "800",
  },
  previewMeta: {
    flex: 1,
    gap: 4,
  },
  previewTitle: {
    color: AppTheme.text,
    fontSize: 18,
    fontWeight: "800",
  },
  previewArtist: {
    color: "#bbb5c1",
    fontSize: 14,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 12,
    backgroundColor: "#0c0c10",
  },
  trackArtwork: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#1c1c24",
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
  featureCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: AppTheme.panelAlt,
    borderWidth: 1,
    borderColor: AppTheme.line,
    gap: 8,
  },
  featureTitle: {
    color: AppTheme.text,
    fontSize: 17,
    fontWeight: "700",
  },
  featureSubtitle: {
    color: AppTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
