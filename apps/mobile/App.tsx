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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, Socket } from "socket.io-client";
import * as WebBrowser from "expo-web-browser";

import { DEFAULT_API_URL, DEFAULT_SOCKET_URL } from "./constants/config";

WebBrowser.maybeCompleteAuthSession();

type TabKey = "home" | "search" | "library";

type PlaybackState = {
  playing?: boolean;
  track?: string;
  artist?: string;
  artwork?: string;
  position?: number;
  duration?: number;
  trackData?: any;
};

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

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

const TAB_ITEMS: Array<{ key: TabKey; label: string }> = [
  { key: "home", label: "Home" },
  { key: "search", label: "Search" },
  { key: "library", label: "Library" },
];

function formatTime(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "0:00";
  }
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [roomId, setRoomId] = useState("");
  const [apiBase, setApiBase] = useState(DEFAULT_API_URL);
  const [savedApiBase, setSavedApiBase] = useState(DEFAULT_API_URL);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Connect to your desktop and keep the same backend/socket as the desktop app.",
  );
  const [playback, setPlayback] = useState<PlaybackState>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [soundCloudConnected, setSoundCloudConnected] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [libraryCards] = useState([
    {
      title: "Liked Songs",
      subtitle: "Mirror the mobile web likes screen here",
    },
    {
      title: "Playlists",
      subtitle: "Native playlist browsing and editing comes next",
    },
    {
      title: "Friends",
      subtitle: "Realtime friend activity will plug into this section",
    },
  ]);

  const socketUrl = DEFAULT_SOCKET_URL;

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.multiGet([
      "soundcloudy_mobile_room_id",
      "soundcloudy_mobile_api_base",
    ]).then((entries) => {
      if (cancelled) return;
      const storedRoomId = entries.find(([key]) => key === "soundcloudy_mobile_room_id")?.[1];
      const storedApiBase =
        entries.find(([key]) => key === "soundcloudy_mobile_api_base")?.[1] || DEFAULT_API_URL;

      if (storedRoomId) setRoomId(storedRoomId);
      setApiBase(storedApiBase);
      setSavedApiBase(storedApiBase);
    });

    return () => {
      cancelled = true;
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true);
      try {
        const response = await fetch(`${apiBase}/api/auth/check`);
        setSoundCloudConnected(response.ok);
      } catch {
        setSoundCloudConnected(false);
      } finally {
        setAuthLoading(false);
      }
    };

    void checkAuth();
  }, [apiBase]);

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
    }, 280);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, apiBase]);

  const persistMobileConfig = async (nextRoomId: string, nextApiBase: string) => {
    await AsyncStorage.multiSet([
      ["soundcloudy_mobile_room_id", nextRoomId],
      ["soundcloudy_mobile_api_base", nextApiBase],
    ]);
  };

  const connectDesktop = async () => {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) {
      Alert.alert("Room ID needed", "Enter the desktop room ID first.");
      return;
    }

    const trimmedApiBase = apiBase.trim() || DEFAULT_API_URL;
    setApiBase(trimmedApiBase);
    setSavedApiBase(trimmedApiBase);
    await persistMobileConfig(trimmedRoomId, trimmedApiBase);

    socketRef.current?.disconnect();
    setConnectionState("connecting");
    setStatusMessage("Connecting to your desktop...");

    const socket = io(socketUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8,
      timeout: 6000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join", trimmedRoomId, (response?: any) => {
        if (response?.ok) {
          setConnectionState("connected");
          setStatusMessage(`Connected to room ${trimmedRoomId}.`);
          if (response.playbackState) {
            setPlayback(response.playbackState);
          }
        } else {
          setConnectionState("error");
          setStatusMessage(response?.error || "Failed to join the desktop room.");
        }
      });
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
      setStatusMessage("Disconnected from the desktop socket.");
    });

    socket.on("connect_error", (error: Error) => {
      setConnectionState("error");
      setStatusMessage(error.message || "Unable to reach the socket server.");
    });

    socket.on("playback-update", (state: PlaybackState) => {
      setPlayback(state || {});
    });
  };

  const disconnectDesktop = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnectionState("disconnected");
    setStatusMessage("Disconnected.");
  };

  const sendDesktopCommand = (command: string | Record<string, unknown>) => {
    const trimmedRoomId = roomId.trim();
    if (!socketRef.current || connectionState !== "connected" || !trimmedRoomId) {
      Alert.alert("Desktop not connected", "Connect to your desktop first.");
      return;
    }

    socketRef.current.emit("remote-command", {
      userId: trimmedRoomId,
      command,
    });
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
            ? "Connect SoundCloud on the backend first."
            : `Search failed with ${response.status}`,
        );
      }

      const data = await response.json();
      setSearchResults(Array.isArray(data.collection) ? data.collection : []);
    } catch (error) {
      setSearchResults([]);
      setSearchError(
        error instanceof Error ? error.message : "Unable to search right now.",
      );
    } finally {
      setSearching(false);
    }
  };

  const connectSoundCloud = async () => {
    setAuthLoading(true);
    try {
      const bridgeResponse = await fetch(`${apiBase}/api/auth/bridge`, {
        method: "POST",
      });

      if (!bridgeResponse.ok) {
        throw new Error(`Bridge failed (${bridgeResponse.status})`);
      }

      const bridgeBody = await bridgeResponse.json();
      const connectCode = bridgeBody?.connect_code;

      if (!connectCode) {
        throw new Error("Missing connect code from backend.");
      }

      const startUrl = `${apiBase}/api/auth/start?connect_code=${encodeURIComponent(connectCode)}`;
      await WebBrowser.openBrowserAsync(startUrl);

      let completed = false;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const completeResponse = await fetch(
          `${apiBase}/api/auth/complete?connect_code=${encodeURIComponent(connectCode)}`,
        );

        if (completeResponse.status === 200) {
          completed = true;
          setSoundCloudConnected(true);
          setStatusMessage("Connected to SoundCloud.");
          break;
        }
      }

      if (!completed) {
        throw new Error("SoundCloud connection timed out.");
      }
    } catch (error) {
      Alert.alert(
        "SoundCloud connect failed",
        error instanceof Error ? error.message : "Unable to connect right now.",
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const renderHome = () => (
    <ScrollView
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Soundcloudy Native</Text>
        <Text style={styles.heroTitle}>Phone player, queue companion, and remote.</Text>
        <Text style={styles.heroSubtitle}>
          This is the native foundation that mirrors the mobile web app: playback,
          search, library, and desktop handoff.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Connection</Text>
        <Text style={styles.helperText}>{statusMessage}</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Desktop room ID</Text>
          <TextInput
            value={roomId}
            onChangeText={setRoomId}
            placeholder="Paste your desktop room id"
            placeholderTextColor="#6e6b76"
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Backend URL</Text>
          <TextInput
            value={apiBase}
            onChangeText={setApiBase}
            placeholder={DEFAULT_API_URL}
            placeholderTextColor="#6e6b76"
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={() => void connectDesktop()}>
            <Text style={styles.primaryButtonText}>Connect Desktop</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={disconnectDesktop}>
            <Text style={styles.secondaryButtonText}>Disconnect</Text>
          </Pressable>
        </View>
        <View style={styles.connectionPills}>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>Socket</Text>
            <Text style={styles.pillValue}>{connectionState}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>SoundCloud</Text>
            <Text style={styles.pillValue}>
              {authLoading ? "Checking..." : soundCloudConnected ? "Connected" : "Not connected"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.sectionTitle}>SoundCloud</Text>
          <Pressable style={styles.secondaryButtonCompact} onPress={() => void connectSoundCloud()}>
            <Text style={styles.secondaryButtonText}>
              {authLoading ? "Working..." : soundCloudConnected ? "Reconnect" : "Connect"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.helperText}>
          This uses the hosted backend auth flow so the native app can eventually share the same
          account/session model as desktop.
        </Text>
      </View>

      <View style={styles.nowPlayingCard}>
        <Text style={styles.sectionTitle}>Now Playing</Text>
        <View style={styles.nowPlayingRow}>
          <View style={styles.artworkPlaceholder} />
          <View style={styles.nowPlayingMeta}>
            <Text numberOfLines={1} style={styles.nowPlayingTrack}>
              {playback.track || "Nothing synced yet"}
            </Text>
            <Text numberOfLines={1} style={styles.nowPlayingArtist}>
              {playback.artist || "Connect to the desktop player"}
            </Text>
            <Text style={styles.progressText}>
              {formatTime(playback.position)} / {formatTime(playback.duration)}
            </Text>
          </View>
        </View>
        <View style={styles.controlsRow}>
          <Pressable style={styles.iconButton} onPress={() => sendDesktopCommand("prev")}>
            <Text style={styles.iconButtonText}>Prev</Text>
          </Pressable>
          <Pressable
            style={styles.primaryButton}
            onPress={() => sendDesktopCommand(playback.playing ? "pause" : "play")}
          >
            <Text style={styles.primaryButtonText}>
              {playback.playing ? "Pause" : "Play"}
            </Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => sendDesktopCommand("next")}>
            <Text style={styles.iconButtonText}>Next</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );

  const renderSearch = () => (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Search</Text>
        <Text style={styles.helperText}>
          This is the native version of the mobile web search lane. The results can be sent straight
          to desktop playback.
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
        renderItem={({ item }) => (
          <Pressable
            style={styles.trackRow}
            onPress={() =>
              sendDesktopCommand({
                type: "load-track",
                track: item,
                position: 0,
                shouldPlay: true,
              })
            }
          >
            <View style={styles.trackArtwork} />
            <View style={styles.trackMeta}>
              <Text style={styles.trackTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {item.user?.username || "Unknown"}
              </Text>
            </View>
            <Text style={styles.rowAction}>Play</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !searching ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Search tracks</Text>
              <Text style={styles.emptySubtitle}>
                Results will show here once you start typing.
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
          This native section is where the mobile web tabs like likes, playlists, and friends will
          land next.
        </Text>
      </View>

      {libraryCards.map((card) => (
        <View key={card.title} style={styles.libraryCard}>
          <Text style={styles.libraryTitle}>{card.title}</Text>
          <Text style={styles.librarySubtitle}>{card.subtitle}</Text>
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current Mobile Scope</Text>
        <Text style={styles.helperText}>
          Native shell, backend/socket config, SoundCloud connect flow, desktop playback sync, and
          native search are now in place. Likes, playlists, track page, and friends are the next
          slices to port over from the mobile web experience.
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Soundcloudy</Text>
          <Text style={styles.headerSubtitle}>
            {savedApiBase.replace(/^https?:\/\//, "")}
          </Text>
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
    margin: 18,
    marginBottom: 0,
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
    marginHorizontal: 18,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#121216",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 12,
  },
  nowPlayingCard: {
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#111114",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 14,
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
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    color: "#c4bfca",
    fontSize: 12,
    fontWeight: "600",
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
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
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1c1b20",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
  connectionPills: {
    flexDirection: "row",
    gap: 10,
  },
  pill: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#0c0c10",
  },
  pillLabel: {
    color: "#8f8b99",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  pillValue: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  nowPlayingRow: {
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
  nowPlayingTrack: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  nowPlayingArtist: {
    color: "#bbb5c1",
    fontSize: 14,
  },
  progressText: {
    color: "#8f8b99",
    fontSize: 12,
    marginTop: 2,
  },
  controlsRow: {
    flexDirection: "row",
    gap: 10,
  },
  iconButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1b1b20",
  },
  iconButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
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
  trackArtwork: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#1d1c22",
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
  rowAction: {
    color: "#ff8a45",
    fontSize: 13,
    fontWeight: "700",
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
    marginHorizontal: 18,
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
