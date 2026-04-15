import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";

import { useAuth } from "../components/mobile/auth-context";
import { DEFAULT_API_URL } from "../constants/config";
import { AppTheme } from "../components/mobile/app-theme";
import { LoginGate } from "../components/mobile/login-gate";
import {
  AppInput,
  Card,
  HelperText,
  ScreenScroll,
  SectionTitle,
} from "../components/mobile/primitives";
import { MobileShell } from "../components/mobile/shell";

type SearchResult = {
  id: number;
  title: string;
  user?: {
    username?: string;
  };
};

export function SearchScreen() {
  const auth = useAuth();
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  if (!auth.authenticated) {
    return (
      <LoginGate
        loading={auth.loading}
        label={auth.label}
        onLogin={() => void auth.login()}
      />
    );
  }

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

  const runSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSearching(true);
    setSearchError("");
    try {
      const response = await fetch(
        `${DEFAULT_API_URL}/api/search?q=${encodeURIComponent(trimmed)}&limit=20`,
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

  return (
    <MobileShell
      title="Search"
      subtitle="Native version of the mobile web search view"
    >
      <View style={styles.page}>
        <ScreenScroll>
          <Card>
            <SectionTitle>Search</SectionTitle>
            <HelperText>
              This screen is wired to the same backend search endpoint the web app uses.
            </HelperText>
            <AppInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search tracks on SoundCloud"
            />
          </Card>
        </ScreenScroll>

        {searching ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={AppTheme.accent} />
          </View>
        ) : null}

        {searchError ? <Text style={styles.errorText}>{searchError}</Text> : null}

        <FlatList
          data={searchResults}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.trackRow}>
              <View style={styles.trackArtworkFallback}>
                <Text style={styles.trackArtworkFallbackText}>
                  {item.title.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.trackMeta}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {item.user?.username || "Unknown"}
                </Text>
              </View>
            </View>
          )}
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
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  loadingWrap: {
    paddingTop: 8,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 10,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 12,
    backgroundColor: AppTheme.panel,
    borderWidth: 1,
    borderColor: AppTheme.line,
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
    color: AppTheme.text,
    fontWeight: "800",
  },
  trackMeta: {
    flex: 1,
    gap: 3,
  },
  trackTitle: {
    color: AppTheme.text,
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
    color: AppTheme.text,
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: AppTheme.textSoft,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#ff9a9a",
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
});
