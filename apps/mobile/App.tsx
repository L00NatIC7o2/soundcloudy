import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

import { DEFAULT_API_URL } from "./constants/config";

WebBrowser.maybeCompleteAuthSession();

type TabKey = "home" | "search" | "library";

type SearchResult = {
  id: number;
  title: string;
  artwork_url?: string | null;
  user?: {
    id?: number;
    username?: string;
    avatar_url?: string | null;
  };
};

type SessionState = {
  authenticated: boolean;
  loading: boolean;
  label: string;
};

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "search", label: "Search" },
  { key: "library", label: "Library" },
];

const FEATURE_CARDS = [
  {
    title: "Liked Songs",
    subtitle: "Your saved tracks, rebuilt as a native screen.",
  },
  {
    title: "Playlists",
    subtitle: "Browse and manage playlists without leaving the app.",
  },
  {
    title: "Friends",
    subtitle: "See live listening activity in the same social layer as desktop.",
  },
];

function getArtwork(track?: SearchResult) {
  return (
    track?.artwork_url?.replace?.("-large", "-t500x500") ||
    track?.user?.avatar_url?.replace?.("-large", "-t500x500") ||
    null
  );
}

export default function App() {
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [apiBase] = useState(DEFAULT_API_URL);
  const [sessionState, setSessionState] = useState<SessionState>({
    authenticated: false,
    loading: true,
    label: "Checking session...",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    void refreshSession();

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      void runSearch(searchQuery);
    }, 260);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const refreshSession = async () => {
    setSessionState((previous) => ({ ...previous, loading: true }));
    try {
      const response = await fetch(`${apiBase}/api/auth/check`);
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
        const sessionResponse = await fetch(`${apiBase}/api/auth/session`);
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          username =
            session?.user?.username ||
            session?.username ||
            session?.user?.permalink ||
            "Connected";
        }
      } catch {
        // Keep the simpler connected label if session hydration fails.
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
    try {
      const loginUrl = `${apiBase}/api/auth/login`;
      await WebBrowser.openBrowserAsync(loginUrl);
      setTimeout(() => {
        void refreshSession();
      }, 1500);
    } catch (error) {
      Alert.alert(
        "Unable to open login",
        error instanceof Error ? error.message : "Try again in a moment.",
      );
    }
  };

  const runSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError("");
    try {
      const response = await fetch(
        `${apiBase}/api/search?q=${encodeURIComponent(trimmed)}&limit=20`,
      );

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Log in first to search SoundCloud."
            : `Search failed with ${response.status}`,
        );
      }

      const payload = await response.json();
      setSearchResults(Array.isArray(payload?.collection) ? payload.collection : []);
    } catch (error) {
      setSearchResults([]);
      setSearchError(
        error instanceof Error ? error.message : "Unable to search right now.",
      );
    } finally {
      setSearching(false);
    }
  };

  const openPlaceholder = (label: string) => {
    Alert.alert(
      label,
      "This native screen is the next part to port from the mobile web app.",
    );
  };

  const renderHome = () => (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Soundcloudy Native</Text>
        <Text style={styles.heroTitle}>The mobile app should feel like the main app, not a remote.</Text>
        <Text style={styles.heroSubtitle}>
          This shell is now focused on the real mobile product: home, search,
          library, playback, and social features from the desktop/web app rebuilt
          with native UI.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable
            style={styles.secondaryButtonCompact}
            onPress={() => void refreshSession()}
          >
            <Text style={styles.secondaryButtonText}>Refresh</Text>
          </Pressable>
        </View>
        <Text style={styles.helperText}>
          Backend: {apiBase.replace(/^https?:\/\//, "")}
        </Text>
        <View style={styles.accountPill}>
          <Text style={styles.accountPillLabel}>SoundCloud</Text>
          <Text style={styles.accountPillValue}>
            {sessionState.loading ? "Checking..." : sessionState.label}
          </Text>
        </View>
        {!sessionState.authenticated ? (
          <Pressable style={styles.primaryButton} onPress={() => void connectSoundCloud()}>
            <Text style={styles.primaryButtonText}>Log In With SoundCloud</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Now Playing</Text>
        <Text style={styles.helperText}>
          This area will become the native player lane that mirrors the mobile web app’s
          collapsed player and full-sheet experience.
        </Text>
        <View style={styles.nowPlayingPreview}>
          <View style={styles.artworkPlaceholder} />
          <View style={styles.nowPlayingMeta}>
            <Text style={styles.nowPlayingTitle}>No track loaded yet</Text>
            <Text style={styles.nowPlayingArtist}>
              Native playback UI comes next
            </Text>
          </View>
        </View>
      </View>

      {FEATURE_CARDS.map((card) => (
        <Pressable
          key={card.title}
          style={styles.featureCard}
          onPress={() => openPlaceholder(card.title)}
        >
          <Text style={styles.featureTitle}>{card.title}</Text>
          <Text style={styles.featureSubtitle}>{card.subtitle}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderSearch = () => (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Search</Text>
        <Text style={styles.helperText}>
          Native search already uses your hosted backend. This becomes the same search
          experience as mobile web, just rebuilt properly for mobile.
        </Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search tracks on SoundCloud"
          placeholderTextColor="#6e6b76"
          style={styles.input}
        />
      </View>

      {searching ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#ff6a1a" />
        </View>
      ) : null}

      {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

      <FlatList
        data={searchResults}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const artwork = getArtwork(item);
          return (
            <Pressable
              style={styles.trackRow}
              onPress={() => openPlaceholder(item.title)}
            >
              <View style={styles.trackArtworkWrap}>
                {artwork ? (
                  <View style={styles.trackArtworkFallback}>
                    <Text style={styles.trackArtworkFallbackText}>
                      {item.title.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.trackArtworkFallback}>
                    <Text style={styles.trackArtworkFallbackText}>SC</Text>
                  </View>
                )}
              </View>
              <View style={styles.trackMeta}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {item.user?.username || "Unknown"}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !searching ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Search tracks</Text>
              <Text style={styles.emptySubtitle}>
                Results will appear here once you start typing.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );

  const renderLibrary = () => (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Library</Text>
        <Text style={styles.helperText}>
          This is the native home for your likes, playlists, reposts, profile, and friends.
          It replaces the old remote-only mobile concept.
        </Text>
      </View>

      {FEATURE_CARDS.map((card) => (
        <Pressable
          key={card.title}
          style={styles.libraryCard}
          onPress={() => openPlaceholder(card.title)}
        >
          <Text style={styles.libraryTitle}>{card.title}</Text>
          <Text style={styles.librarySubtitle}>{card.subtitle}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Soundcloudy</Text>
          <Text style={styles.headerSubtitle}>Native mobile app</Text>
        </View>

        <View style={styles.content}>
          {activeTab === "home" && renderHome()}
          {activeTab === "search" && renderSearch()}
          {activeTab === "library" && renderLibrary()}
        </View>

        <View style={styles.bottomBar}>
          {TAB_ITEMS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                style={[styles.bottomTab, active && styles.bottomTabActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.bottomTabText, active && styles.bottomTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070709",
  },
  container: {
    flex: 1,
    backgroundColor: "#070709",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "#8f8b99",
    fontSize: 12,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pageContent: {
    padding: 18,
    gap: 14,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#131317",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  eyebrow: {
    color: "#ff8a45",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    color: "#ffffff",
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
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#121216",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  helperText: {
    color: "#a29daa",
    fontSize: 13,
    lineHeight: 19,
  },
  cardHeaderRow: {
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
    color: "#8f8b99",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  accountPillValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff5a1f",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButtonCompact: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1c1b20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  nowPlayingPreview: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  artworkPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#1f1d25",
  },
  nowPlayingMeta: {
    flex: 1,
    gap: 4,
  },
  nowPlayingTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  nowPlayingArtist: {
    color: "#bbb5c1",
    fontSize: 14,
  },
  featureCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#111115",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  featureTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  featureSubtitle: {
    color: "#a29daa",
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    backgroundColor: "#0a0a0d",
    color: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  loadingWrap: {
    paddingTop: 20,
  },
  listContent: {
    padding: 18,
    gap: 10,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 12,
    backgroundColor: "#121216",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  trackArtworkWrap: {
    width: 56,
    height: 56,
  },
  trackArtworkFallback: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#1d1c22",
    alignItems: "center",
    justifyContent: "center",
  },
  trackArtworkFallbackText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  trackMeta: {
    flex: 1,
    gap: 3,
  },
  trackTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  trackArtist: {
    color: "#9e98a5",
    fontSize: 13,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "#8f8b99",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#ff9a9a",
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  libraryCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: "#111115",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  libraryTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  librarySubtitle: {
    color: "#a29daa",
    fontSize: 13,
    lineHeight: 19,
  },
  bottomBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#09090b",
  },
  bottomTab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomTabActive: {
    backgroundColor: "#17171b",
  },
  bottomTabText: {
    color: "#8f8b99",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomTabTextActive: {
    color: "#ffffff",
  },
});
