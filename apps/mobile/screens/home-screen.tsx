import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

import { DEFAULT_API_URL } from "../constants/config";
import { AppTheme } from "../components/mobile/app-theme";
import {
  Card,
  HelperText,
  PrimaryButton,
  ScreenScroll,
  SectionTitle,
  SecondaryButton,
} from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

type SessionState = {
  authenticated: boolean;
  loading: boolean;
  label: string;
};

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

export function HomeScreen() {
  const [sessionState, setSessionState] = useState<SessionState>({
    authenticated: false,
    loading: true,
    label: "Checking session...",
  });

  useEffect(() => {
    void refreshSession();
  }, []);

  const refreshSession = async () => {
    setSessionState((previous) => ({ ...previous, loading: true }));
    try {
      const response = await fetch(`${DEFAULT_API_URL}/api/auth/check`);
      if (!response.ok) {
        setSessionState({
          authenticated: false,
          loading: false,
          label: "Sign in with SoundCloud to unlock the native app.",
        });
        return;
      }

      let username = "Connected";
      try {
        const sessionResponse = await fetch(`${DEFAULT_API_URL}/api/auth/session`);
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          username =
            session?.user?.username ||
            session?.username ||
            session?.user?.permalink ||
            "Connected";
        }
      } catch {
        // keep generic connected label
      }

      setSessionState({
        authenticated: true,
        loading: false,
        label: username,
      });
    } catch {
      setSessionState({
        authenticated: false,
        loading: false,
        label: "Unable to reach the backend right now.",
      });
    }
  };

  const connectSoundCloud = async () => {
    await WebBrowser.openBrowserAsync(`${DEFAULT_API_URL}/api/auth/login`);
    setTimeout(() => {
      void refreshSession();
    }, 1500);
  };

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
            <SecondaryButton label="Refresh" onPress={() => void refreshSession()} />
          </View>
          <HelperText>
            Backend: {DEFAULT_API_URL.replace(/^https?:\/\//, "")}
          </HelperText>
          <View style={styles.accountPill}>
            <Text style={styles.accountPillLabel}>SoundCloud</Text>
            <Text style={styles.accountPillValue}>
              {sessionState.loading ? "Checking..." : sessionState.label}
            </Text>
          </View>
          {!sessionState.authenticated ? (
            <PrimaryButton
              label="Log In With SoundCloud"
              onPress={() => void connectSoundCloud()}
            />
          ) : null}
        </Card>

        <Card>
          <SectionTitle>Now Playing</SectionTitle>
          <HelperText>
            This becomes the native collapsed player and full player sheet from
            the mobile web app.
          </HelperText>
          <View style={styles.previewRow}>
            <View style={styles.artwork} />
            <View style={styles.previewMeta}>
              <Text style={styles.previewTitle}>No track loaded yet</Text>
              <Text style={styles.previewArtist}>
                Native player UI is the next slice to port
              </Text>
            </View>
          </View>
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
