import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { io, Socket } from "socket.io-client";

import { AppTheme } from "../components/mobile/app-theme";
import { useAuth } from "../components/mobile/auth-context";
import { Card, HelperText, PrimaryButton } from "../components/mobile/primitives";
import { usePlayer } from "../components/mobile/player-context";
import { MobileShell } from "../components/mobile/shell";
import { DEFAULT_API_URL, DEFAULT_SOCKET_URL } from "../constants/config";

type SoundCloudTrack = {
  id: number;
  title: string;
  user?: { username?: string; avatar_url?: string | null };
  artwork_url?: string | null;
  duration?: number;
  isLiked?: boolean;
  [key: string]: unknown;
};

type DiscoverItem = {
  id?: number | string;
  urn?: string;
  kind?: string;
  title?: string;
  username?: string;
  artwork_url?: string | null;
  avatar_url?: string | null;
  user?: { username?: string; avatar_url?: string | null };
  tracks?: SoundCloudTrack[];
  track_count?: number;
  duration?: number;
  [key: string]: unknown;
};

type DiscoverSection = {
  title: string;
  items: DiscoverItem[];
};

type PlaybackSnapshot = {
  deviceId?: string;
  playing?: boolean;
  track?: string;
  artist?: string;
  artwork?: string;
  position?: number;
  duration?: number;
  trackData?: SoundCloudTrack;
};

type DesktopDevice = {
  deviceId: string;
  kind?: string;
  platform?: string;
  label?: string | null;
};

const DEVICE_STORAGE_KEY = "soundcloudy_mobile_device_id";
const API_BASE_URL = DEFAULT_API_URL.replace(/\/$/, "");

function artworkFor(item?: DiscoverItem | SoundCloudTrack | null) {
  const artwork = item?.artwork_url || item?.user?.avatar_url;
  return typeof artwork === "string"
    ? artwork.replace("-large", "-t500x500")
    : null;
}

function unwrapDiscoverItem(item: unknown): DiscoverItem | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, unknown>;

  for (const key of ["track", "origin", "item", "playlist", "system_playlist", "album", "station"]) {
    const wrapped = value[key];
    if (wrapped && typeof wrapped === "object") {
      const normalized = unwrapDiscoverItem(wrapped);
      if (normalized && key !== "track" && !normalized.kind) {
        normalized.kind = key === "system_playlist" || key === "station"
          ? "system-playlist"
          : key === "playlist" || key === "album"
            ? "playlist"
            : normalized.kind;
      }
      return normalized;
    }
  }

  if (Array.isArray(value.collection) && value.collection.length > 0) {
    return unwrapDiscoverItem(value.collection[0]);
  }

  const kind =
    typeof value.kind === "string"
      ? value.kind
      : Array.isArray(value.tracks) || typeof value.track_count === "number"
        ? "playlist"
        : typeof value.duration === "number"
          ? "track"
          : undefined;
  if (!kind || !(value.title || value.username || value.user)) return null;
  return { ...value, kind } as DiscoverItem;
}

function normalizeSections(data: unknown): DiscoverSection[] {
  if (!data || typeof data !== "object") return [];
  const rawSections = (data as { sections?: unknown }).sections;
  if (!Array.isArray(rawSections)) return [];

  return rawSections
    .map((rawSection): DiscoverSection | null => {
      if (!rawSection || typeof rawSection !== "object") return null;
      const section = rawSection as Record<string, unknown>;
      const rawItems = Array.isArray(section.items)
        ? section.items
        : section.items &&
            typeof section.items === "object" &&
            Array.isArray((section.items as { collection?: unknown }).collection)
          ? (section.items as { collection: unknown[] }).collection
          : [];
      const items = rawItems
        .map(unwrapDiscoverItem)
        .filter((item): item is DiscoverItem => Boolean(item && item.title));
      if (!items.length) return null;
      return {
        title:
          typeof section.title === "string"
            ? section.title
            : typeof section.name === "string"
              ? section.name
              : "For You",
        items,
      };
    })
    .filter((section): section is DiscoverSection => Boolean(section));
}

function asTrack(item: DiscoverItem): SoundCloudTrack | null {
  if (item.kind !== "track" || typeof item.id !== "number") return null;
  return item as SoundCloudTrack;
}

function getPlaylistId(item: DiscoverItem) {
  return typeof item.urn === "string" ? item.urn : item.id;
}

export function PhonePlayerScreen() {
  const auth = useAuth();
  const { registerControls, syncPlayback } = usePlayer();
  const socketRef = useRef<Socket | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
  const pendingStartAtRef = useRef<number | null>(null);
  const queueRef = useRef<SoundCloudTrack[]>([]);
  const currentIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const activeDeviceIdRef = useRef<string | null>(null);
  const audioPlayer = useAudioPlayer(null, { updateInterval: 500 });
  const playbackStatus = useAudioPlayerStatus(audioPlayer);
  const [roomId, setRoomId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [connectionState, setConnectionState] = useState<
    "disconnected" | "connecting" | "connected" | "error"
  >("disconnected");
  const [remotePlayback, setRemotePlayback] = useState<PlaybackSnapshot>({});
  const [devices, setDevices] = useState<DesktopDevice[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [sections, setSections] = useState<DiscoverSection[]>([]);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [discoverError, setDiscoverError] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DiscoverItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SoundCloudTrack | null>(null);
  const [queueTracks, setQueueTracks] = useState<SoundCloudTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [error, setError] = useState("");

  const isPlaying = playbackStatus.playing;
  const position = playbackStatus.currentTime;
  const duration = playbackStatus.duration;
  const positionRef = useRef(0);
  const durationRef = useRef(0);

  const loadPhoneTrack = useCallback(
    async (
      track: SoundCloudTrack,
      startAt = 0,
      shouldPlay = true,
    ): Promise<boolean> => {
      const requestId = ++loadRequestRef.current;
      setLoadingTrack(true);
      setError("");

      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: true,
          interruptionMode: "doNotMix",
        });

        const response = await fetch(
          `${API_BASE_URL}/api/stream?trackId=${encodeURIComponent(String(track.id))}`,
          { headers: auth.authHeaders },
        );
        const streamData = await response.json();
        if (!response.ok || typeof streamData.streamUrl !== "string") {
          throw new Error(streamData.error || "SoundCloud did not return a stream URL.");
        }
        if (requestId !== loadRequestRef.current) return false;

        const streamUrl = new URL(streamData.streamUrl, `${API_BASE_URL}/`).toString();
        pendingStartAtRef.current = shouldPlay ? Math.max(0, startAt) : null;
        setCurrentTrack(track);
        audioPlayer.replace({
          uri: streamUrl,
          headers: auth.authHeaders,
          name: track.title,
        });
        audioPlayer.setActiveForLockScreen(true, {
          title: track.title,
          artist: track.user?.username || "Unknown artist",
          artworkUrl: artworkFor(track) || undefined,
        });
        if (!shouldPlay) audioPlayer.pause();
        return true;
      } catch (playbackError: unknown) {
        if (requestId === loadRequestRef.current) {
          pendingStartAtRef.current = null;
          setError(
            playbackError instanceof Error
              ? playbackError.message
              : "Unable to play this track on your phone.",
          );
        }
        return false;
      } finally {
        if (requestId === loadRequestRef.current) setLoadingTrack(false);
      }
    },
    [audioPlayer, auth.authHeaders],
  );

  const playQueueTrack = useCallback(
    async (index: number) => {
      const tracks = queueRef.current;
      if (!tracks.length) return;
      const nextIndex = (index + tracks.length) % tracks.length;
      const track = tracks[nextIndex];
      currentIndexRef.current = nextIndex;
      setQueueIndex(nextIndex);
      await loadPhoneTrack(track);
    },
    [loadPhoneTrack],
  );

  useEffect(() => {
    isPlayingRef.current = Boolean(isPlaying);
    positionRef.current = position || 0;
    durationRef.current = duration || 0;
  }, [duration, isPlaying, position]);

  useEffect(() => {
    let cancelled = false;
    if (!auth.authenticated) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setRoomId("");
        setSections([]);
        setRemotePlayback({});
        setConnectionState("disconnected");
      });
      return;
    }

    void fetch(`${API_BASE_URL}/api/auth/session`, {
      headers: auth.authHeaders,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || typeof data.roomId !== "string") {
          throw new Error(data.error || "Could not find your desktop sync room.");
        }
        if (!cancelled) setRoomId(data.roomId);
      })
      .catch((sessionError: unknown) => {
        if (!cancelled) {
          setConnectionState("error");
          console.warn(
            "Could not resolve the desktop sync room:",
            sessionError instanceof Error ? sessionError.message : sessionError,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.authHeaders, auth.authenticated]);

  useEffect(() => {
    if (!auth.authenticated || !roomId) return;
    let cancelled = false;
    let socket: Socket | null = null;

    const connect = async () => {
      let id = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
      if (!id) {
        id = `mobile-${Math.random().toString(36).slice(2)}`;
        await AsyncStorage.setItem(DEVICE_STORAGE_KEY, id);
      }
      if (cancelled) return;

      deviceIdRef.current = id;
      setDeviceId(id);
      setConnectionState("connecting");

      socket = io(DEFAULT_SOCKET_URL, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: 8,
        reconnectionDelay: 800,
        timeout: 6000,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket?.emit(
          "join",
          {
            roomId,
            deviceId: id,
            deviceMeta: { kind: "mobile", platform: Platform.OS, label: "Phone" },
          },
          (response?: {
            ok?: boolean;
            error?: string;
            playbackState?: PlaybackSnapshot | null;
            devices?: DesktopDevice[];
          }) => {
            if (!response?.ok) {
              setConnectionState("error");
              console.warn("Could not join desktop sync room:", response?.error);
              return;
            }
            setConnectionState("connected");
            if (response.playbackState) {
              setRemotePlayback(response.playbackState);
              activeDeviceIdRef.current = response.playbackState.deviceId || null;
              setActiveDeviceId(response.playbackState.deviceId || null);
            }
            if (Array.isArray(response.devices)) setDevices(response.devices);
          },
        );
      });

      socket.on("playback-update", (state: PlaybackSnapshot) => {
        setRemotePlayback(state || {});
        activeDeviceIdRef.current = state?.deviceId || null;
        setActiveDeviceId(state?.deviceId || null);
        if (state?.deviceId !== id && isPlayingRef.current) {
          audioPlayer.pause();
        }
      });

      socket.on(
        "devices-update",
        (update: { devices?: DesktopDevice[]; activeDeviceId?: string | null }) => {
          setDevices(Array.isArray(update?.devices) ? update.devices : []);
          activeDeviceIdRef.current = update?.activeDeviceId || null;
          setActiveDeviceId(update?.activeDeviceId || null);
        },
      );

      socket.on("remote-command", (command: string | Record<string, unknown>) => {
        if (activeDeviceIdRef.current === id && command === "play") audioPlayer.play();
        else if (activeDeviceIdRef.current === id && command === "pause") audioPlayer.pause();
        else if (activeDeviceIdRef.current === id && command === "next") {
          void playQueueTrack(currentIndexRef.current + 1);
        } else if (activeDeviceIdRef.current === id && command === "prev") {
          void playQueueTrack(currentIndexRef.current - 1);
        } else if (
          command &&
          typeof command === "object" &&
          "deviceId" in command &&
          command.deviceId === id
        ) {
          const track = command.track;
          if (track && typeof track === "object" && "id" in track) {
            void loadPhoneTrack(
              track as SoundCloudTrack,
              typeof command.position === "number" ? command.position : 0,
              command.shouldPlay !== false,
            );
          }
        }
      });

      socket.on("disconnect", () => {
        setConnectionState("disconnected");
      });
      socket.on("connect_error", (socketError: Error) => {
        setConnectionState("error");
        console.warn("Desktop sync connection failed:", socketError.message);
      });
    };

    void connect().catch((connectionError: unknown) => {
      if (!cancelled) {
        setConnectionState("error");
        console.error("Unable to initialize desktop sync:", connectionError);
      }
    });

    return () => {
      cancelled = true;
      socket?.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [auth.authenticated, audioPlayer, loadPhoneTrack, playQueueTrack, roomId]);

  useEffect(() => {
    if (!auth.authenticated) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoadingDiscover(true);
      setDiscoverError("");
    });

    void fetch(`${API_BASE_URL}/api/discover`, { headers: auth.authHeaders })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Your SoundCloud session expired. Sign in again."
              : data.error || `Discover failed (${response.status}).`,
          );
        }
        if (!cancelled) {
          setSections(normalizeSections(data));
          setDiscoverError("");
        }
      })
      .catch((discoverFetchError: unknown) => {
        if (cancelled) return;
        setDiscoverError(
          discoverFetchError instanceof Error
            ? discoverFetchError.message
            : "Unable to load Discover right now.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingDiscover(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.authHeaders, auth.authenticated]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    let cancelled = false;
    const timeout = setTimeout(() => {
      setSearching(true);
      setError("");
      void fetch(
        `${API_BASE_URL}/api/search?q=${encodeURIComponent(trimmedQuery)}&limit=20`,
        { headers: auth.authHeaders },
      )
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || `Search failed (${response.status}).`);
          }
          if (!cancelled) {
            const rawResults: unknown[] = Array.isArray(data.collection)
              ? data.collection
              : [];
            const results = rawResults
                  .map(unwrapDiscoverItem)
                  .filter((item): item is DiscoverItem => Boolean(item))
            setSearchResults(results);
          }
        })
        .catch((searchError: unknown) => {
          if (!cancelled) {
            setError(
              searchError instanceof Error
                ? searchError.message
                : "Unable to search right now.",
            );
            setSearchResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [auth.authHeaders, query]);

  useEffect(() => {
    if (!playbackStatus.isLoaded) return;
    const startAt = pendingStartAtRef.current;
    if (startAt === null) return;

    pendingStartAtRef.current = null;
    void audioPlayer
      .seekTo(startAt)
      .then(() => audioPlayer.play())
      .catch((playbackError: unknown) => {
        setError(
          playbackError instanceof Error
            ? playbackError.message
            : "Unable to start this track.",
        );
      });
  }, [audioPlayer, playbackStatus.isLoaded]);

  useEffect(() => {
    if (!currentTrack || !deviceId || !socketRef.current?.connected) return;
    const emitPlaybackState = () => {
      socketRef.current?.emit("playback-update", {
        userId: roomId,
        deviceId,
        state: {
          trackId: currentTrack.id,
          track: currentTrack.title,
          artist: currentTrack.user?.username || "Unknown",
          artwork: artworkFor(currentTrack),
          trackData: currentTrack,
          position: positionRef.current,
          duration: durationRef.current || currentTrack.duration || 0,
          playing: isPlayingRef.current,
          queueData: queueRef.current,
          currentQueueIndex: currentIndexRef.current,
        },
      });
      activeDeviceIdRef.current = deviceId;
      setActiveDeviceId(deviceId);
    };

    emitPlaybackState();
    const interval = setInterval(emitPlaybackState, 2500);
    return () => clearInterval(interval);
  }, [
    currentTrack,
    deviceId,
    roomId,
  ]);

  const playDiscoverItem = async (item: DiscoverItem, sectionItems: DiscoverItem[]) => {
    const track = asTrack(item);
    if (track) {
      const tracks = sectionItems
        .map(asTrack)
        .filter((entry): entry is SoundCloudTrack => Boolean(entry));
      const nextQueue = tracks.length ? tracks : [track];
      const trackIndex = nextQueue.findIndex((entry) => entry.id === track.id);
      queueRef.current = nextQueue;
      currentIndexRef.current = Math.max(trackIndex, 0);
      setQueueTracks(nextQueue);
      setQueueIndex(Math.max(trackIndex, 0));
      await loadPhoneTrack(track);
      return;
    }

    if (item.kind === "playlist" || item.kind === "system-playlist") {
      const id = getPlaylistId(item);
      if (id === undefined) return;
      setLoadingTrack(true);
      setError("");
      try {
        const params = new URLSearchParams({
          id: String(id),
          kind: item.kind,
        });
        if (item.urn) params.set("urn", item.urn);
        const response = await fetch(
          `${API_BASE_URL}/api/playlist?${params.toString()}`,
          { headers: auth.authHeaders },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to open this playlist.");
        const rawTracks: unknown[] = Array.isArray(data.tracks) ? data.tracks : [];
        const tracks = rawTracks
              .map(unwrapDiscoverItem)
              .filter((entry): entry is DiscoverItem => Boolean(entry))
              .map(asTrack)
              .filter((entry): entry is SoundCloudTrack => Boolean(entry))
        if (!tracks.length) {
          throw new Error("This playlist does not contain playable tracks.");
        }
        queueRef.current = tracks;
        currentIndexRef.current = 0;
        setQueueTracks(tracks);
        setQueueIndex(0);
        await loadPhoneTrack(tracks[0]);
      } catch (playlistError: unknown) {
        setError(
          playlistError instanceof Error
            ? playlistError.message
            : "Unable to play this playlist.",
        );
      } finally {
        setLoadingTrack(false);
      }
      return;
    }

    const artist = item.user?.username || item.username || item.title;
    if (artist) setQuery(String(artist));
  };

  const takeDesktopPlayback = useCallback(async () => {
    const track = remotePlayback.trackData;
    if (!track || !deviceId) return;
    queueRef.current = [track];
    currentIndexRef.current = 0;
    setQueueTracks([track]);
    setQueueIndex(0);
    const loaded = await loadPhoneTrack(track, remotePlayback.position || 0);
    if (!loaded) return;
    socketRef.current?.emit("remote-command", {
      userId: roomId,
      command: {
        type: "claim-output",
        deviceId,
        track,
        position: remotePlayback.position || 0,
        shouldPlay: remotePlayback.playing !== false,
      },
    });
  }, [deviceId, loadPhoneTrack, remotePlayback.playing, remotePlayback.position, remotePlayback.trackData, roomId]);

  const sendDesktopCommand = useCallback((command: string) => {
    if (connectionState !== "connected") return;
    socketRef.current?.emit("remote-command", { userId: roomId, command });
  }, [connectionState, roomId]);

  const sendPhonePlaybackToDesktop = useCallback(() => {
    const desktop = devices.find(
      (candidate) =>
        candidate.deviceId !== deviceId &&
        (candidate.kind === "desktop" || candidate.kind === "web"),
    );
    if (!desktop || !currentTrack) return;
    socketRef.current?.emit("remote-command", {
      userId: roomId,
      command: {
        type: "claim-output",
        deviceId: desktop.deviceId,
        track: currentTrack,
        position,
        shouldPlay: true,
      },
    });
    audioPlayer.pause();
  }, [audioPlayer, currentTrack, deviceId, devices, position, roomId]);

  const togglePlayerPlayback = useCallback(() => {
    if (
      activeDeviceIdRef.current &&
      deviceIdRef.current &&
      activeDeviceIdRef.current !== deviceIdRef.current
    ) {
      sendDesktopCommand(remotePlayback.playing ? "pause" : "play");
      return;
    }
    if (isPlayingRef.current) audioPlayer.pause();
    else audioPlayer.play();
  }, [audioPlayer, remotePlayback.playing, sendDesktopCommand]);

  const playPlayerPrevious = useCallback(() => {
    if (
      activeDeviceIdRef.current &&
      deviceIdRef.current &&
      activeDeviceIdRef.current !== deviceIdRef.current
    ) {
      sendDesktopCommand("prev");
      return;
    }
    void playQueueTrack(currentIndexRef.current - 1);
  }, [playQueueTrack, sendDesktopCommand]);

  const playPlayerNext = useCallback(() => {
    if (
      activeDeviceIdRef.current &&
      deviceIdRef.current &&
      activeDeviceIdRef.current !== deviceIdRef.current
    ) {
      sendDesktopCommand("next");
      return;
    }
    void playQueueTrack(currentIndexRef.current + 1);
  }, [playQueueTrack, sendDesktopCommand]);

  const switchPlaybackOutput = useCallback(() => {
    if (activeDeviceIdRef.current === deviceIdRef.current) {
      sendPhonePlaybackToDesktop();
      return;
    }
    void takeDesktopPlayback();
  }, [sendPhonePlaybackToDesktop, takeDesktopPlayback]);

  const toggleCurrentLike = useCallback(async () => {
    const activeRemoteTrack =
      activeDeviceIdRef.current &&
      deviceIdRef.current &&
      activeDeviceIdRef.current !== deviceIdRef.current;
    const track = activeRemoteTrack
      ? remotePlayback.trackData || currentTrack
      : currentTrack || remotePlayback.trackData;
    if (!track) return;

    const previousLiked = Boolean(track.isLiked);
    const nextLiked = !previousLiked;
    const updateTrackLikeState = (isLiked: boolean) => {
      setCurrentTrack((current) =>
        current?.id === track.id ? { ...current, isLiked } : current,
      );
      setRemotePlayback((current) =>
        current.trackData?.id === track.id
          ? {
              ...current,
              trackData: { ...current.trackData, isLiked },
            }
          : current,
      );
      queueRef.current = queueRef.current.map((queuedTrack) =>
        queuedTrack.id === track.id ? { ...queuedTrack, isLiked } : queuedTrack,
      );
      setQueueTracks((current) =>
        current.map((queuedTrack) =>
          queuedTrack.id === track.id ? { ...queuedTrack, isLiked } : queuedTrack,
        ),
      );
    };

    updateTrackLikeState(nextLiked);
    try {
      const response = await fetch(`${API_BASE_URL}/api/like`, {
        method: "POST",
        headers: {
          ...auth.authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackId: track.id, like: nextLiked }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to update this like.");
      }
    } catch (likeError: unknown) {
      updateTrackLikeState(previousLiked);
      setError(
        likeError instanceof Error
          ? likeError.message
          : "Unable to update this like.",
      );
    }
  }, [auth.authHeaders, currentTrack, remotePlayback.trackData]);

  const remoteTrack = remotePlayback.trackData;
  const isRemoteOutputActive =
    Boolean(activeDeviceId && deviceId && activeDeviceId !== deviceId);
  const displayedTrack =
    (isRemoteOutputActive ? remoteTrack : currentTrack) ||
    remoteTrack ||
    currentTrack;
  const playerQueue = useMemo(() => {
    const tracks =
      isRemoteOutputActive && remoteTrack
        ? [remoteTrack]
        : queueTracks.length
          ? queueTracks
          : displayedTrack
            ? [displayedTrack]
            : [];
    return tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.user?.username || "Unknown artist",
      artworkUrl: artworkFor(track),
      isLiked: Boolean(track.isLiked),
    }));
  }, [displayedTrack, isRemoteOutputActive, queueTracks, remoteTrack]);
  const playerTrack = useMemo(
    () =>
      displayedTrack
        ? {
            id: displayedTrack.id,
            title: displayedTrack.title,
            artist: displayedTrack.user?.username || "Unknown artist",
            artworkUrl: artworkFor(displayedTrack),
            isLiked: Boolean(displayedTrack.isLiked),
            context: isRemoteOutputActive
              ? "Playing on desktop"
              : "Playing on this phone",
          }
        : null,
    [displayedTrack, isRemoteOutputActive],
  );
  const displayedTrackId = displayedTrack?.id;

  useEffect(() => {
    if (!displayedTrackId) return;

    let cancelled = false;
    void fetch(
      `${API_BASE_URL}/api/check-like?trackId=${encodeURIComponent(String(displayedTrackId))}`,
      { headers: auth.authHeaders },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to check this track's like status.");
        }
        if (cancelled || typeof data.isLiked !== "boolean") return;
        setCurrentTrack((current) =>
          current?.id === displayedTrackId
            ? { ...current, isLiked: data.isLiked }
            : current,
        );
        setRemotePlayback((current) =>
          current.trackData?.id === displayedTrackId
            ? {
                ...current,
                trackData: { ...current.trackData, isLiked: data.isLiked },
              }
            : current,
        );
      })
      .catch((likeStatusError: unknown) => {
        if (!cancelled) {
          console.warn(
            "Could not load track like status:",
            likeStatusError instanceof Error
              ? likeStatusError.message
              : likeStatusError,
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.authHeaders, displayedTrackId]);

  useEffect(() => {
    syncPlayback(
      playerTrack,
      isRemoteOutputActive ? Boolean(remotePlayback.playing) : Boolean(isPlaying),
      playerQueue,
      isRemoteOutputActive ? 0 : queueIndex,
    );
  }, [
    isPlaying,
    isRemoteOutputActive,
    queueIndex,
    playerQueue,
    playerTrack,
    remotePlayback.playing,
    syncPlayback,
  ]);

  useEffect(() => {
    registerControls({
      togglePlayback: togglePlayerPlayback,
      playNext: playPlayerNext,
      playPrevious: playPlayerPrevious,
      switchOutput: switchPlaybackOutput,
      toggleLike: () => void toggleCurrentLike(),
    });
    return () => registerControls(null);
  }, [
    playPlayerNext,
    playPlayerPrevious,
    registerControls,
    switchPlaybackOutput,
    toggleCurrentLike,
    togglePlayerPlayback,
  ]);

  if (!auth.authenticated) {
    return (
      <MobileShell title="Soundcloudy" subtitle="Your music, on the go">
        <ScrollView contentContainerStyle={styles.loginContent}>
          <Card>
            <Text style={styles.sectionTitle}>Connect SoundCloud</Text>
            <HelperText>{auth.label}</HelperText>
            <PrimaryButton
              label={auth.loading ? "Checking..." : "Sign in"}
              onPress={() => void auth.login()}
            />
          </Card>
        </ScrollView>
      </MobileShell>
    );
  }

  const isSearchMode = Boolean(query.trim());
  const desktopDevice = devices.find(
    (candidate) =>
      candidate.deviceId !== deviceId &&
      (candidate.kind === "desktop" || candidate.kind === "web"),
  );

  return (
    <MobileShell title="Discover" showHeader={false}>
      <View style={styles.discoverScreen}>
        <View style={styles.discoverHeader}>
          <View>
            <Text style={styles.discoverTitle}>Discover</Text>
            <Text style={styles.discoverSubtitle}>Music for you</Text>
          </View>
          <View style={styles.connectionBadge}>
            <View
              style={[
                styles.statusDot,
                connectionState === "connected" && styles.statusConnected,
                connectionState === "error" && styles.statusError,
              ]}
            />
            <Text style={styles.syncText}>
              {connectionState === "connected"
                ? "Desktop"
                : connectionState === "connecting"
                  ? "Connecting"
                  : "Offline"}
            </Text>
          </View>
        </View>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              if (!text.trim()) {
                setSearchResults([]);
                setSearching(false);
                setError("");
              }
            }}
            placeholder="Search tracks, artists, playlists"
            placeholderTextColor={AppTheme.textSoft}
            returnKeyType="search"
            accessibilityLabel="Search SoundCloud"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Text style={styles.clearSearch}>×</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          style={styles.discoverScroll}
          contentContainerStyle={styles.discoverContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {remoteTrack &&
        connectionState === "connected" &&
        activeDeviceId !== deviceId ? (
          <View style={styles.remoteCard}>
            {artworkFor(remoteTrack) ? (
              <Image
                source={{ uri: artworkFor(remoteTrack) || "" }}
                style={styles.remoteArtwork}
                contentFit="cover"
              />
            ) : null}
            <View style={styles.remoteInfo}>
              <Text style={styles.remoteEyebrow}>PLAYING ON YOUR DESKTOP</Text>
              <Text style={styles.remoteTitle} numberOfLines={1}>
                {remoteTrack.title}
              </Text>
              <Text style={styles.remoteArtist} numberOfLines={1}>
                {remoteTrack.user?.username || remotePlayback.artist || "Unknown artist"}
              </Text>
            </View>
            <Pressable
              style={styles.remoteActionButton}
              onPress={() => void takeDesktopPlayback()}
            >
              <Text style={styles.remoteAction}>Play here</Text>
            </Pressable>
          </View>
        ) : null}
        {remoteTrack &&
        connectionState === "connected" &&
        activeDeviceId !== deviceId ? (
          <View style={styles.remoteControls}>
            <Pressable onPress={() => sendDesktopCommand("prev")}>
              <Text style={styles.remoteControlText}>Previous</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                sendDesktopCommand(remotePlayback.playing ? "pause" : "play")
              }
            >
              <Text style={styles.remoteControlText}>
                {remotePlayback.playing ? "Pause desktop" : "Play desktop"}
              </Text>
            </Pressable>
            <Pressable onPress={() => sendDesktopCommand("next")}>
              <Text style={styles.remoteControlText}>Next</Text>
            </Pressable>
          </View>
        ) : null}

        {loadingTrack || playbackStatus.isBuffering ? (
          <ActivityIndicator color={AppTheme.accent} style={styles.loadingIndicator} />
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {currentTrack && desktopDevice ? (
          <Pressable style={styles.handoffButton} onPress={sendPhonePlaybackToDesktop}>
            <Text style={styles.handoffText}>Play on desktop</Text>
          </Pressable>
        ) : null}

        {isSearchMode ? (
          <View style={styles.searchResults}>
            <Text style={styles.sectionTitle}>Search results</Text>
            {searching ? <ActivityIndicator color={AppTheme.accent} /> : null}
            {searchResults.map((item, index) => (
              <DiscoverRow
                key={`${item.kind}-${item.urn || item.id || item.title}-${index}`}
                item={item}
                onPress={() => void playDiscoverItem(item, searchResults)}
              />
            ))}
            {!searching && searchResults.length === 0 && !error ? (
              <HelperText>No results found.</HelperText>
            ) : null}
          </View>
        ) : (
          <>
            {loadingDiscover && sections.length === 0 ? (
              <ActivityIndicator color={AppTheme.accent} style={styles.loadingDiscover} />
            ) : null}
            {discoverError ? <Text style={styles.errorText}>{discoverError}</Text> : null}
            {sections.map((section, sectionIndex) => (
              <View key={`${section.title}-${sectionIndex}`} style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Text style={styles.sectionTitle} numberOfLines={1}>
                    {section.title}
                  </Text>
                  <Text style={styles.sectionCount}>{section.items.length}</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardsRow}
                >
                  {section.items.map((item, itemIndex) => (
                    <DiscoverCard
                      key={`${item.kind}-${item.urn || item.id || item.title}-${itemIndex}`}
                      item={item}
                      onPress={() => void playDiscoverItem(item, section.items)}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
            {!loadingDiscover && !discoverError && sections.length === 0 ? (
              <Card>
                <Text style={styles.sectionTitle}>Nothing to show yet</Text>
                <HelperText>Try searching for a track or artist.</HelperText>
              </Card>
            ) : null}
          </>
        )}
        </ScrollView>
      </View>
    </MobileShell>
  );
}

function DiscoverCard({
  item,
  onPress,
}: {
  item: DiscoverItem;
  onPress: () => void;
}) {
  const image = artworkFor(item) || item.avatar_url || null;
  const subtitle =
    item.kind === "user" || item.kind === "artist"
      ? "Artist"
      : item.kind === "playlist" || item.kind === "system-playlist"
        ? `${item.track_count || item.tracks?.length || 0} tracks`
        : item.user?.username || "SoundCloud";

  return (
    <Pressable style={styles.discoverCard} onPress={onPress}>
      {image ? (
        <Image source={{ uri: image }} style={styles.discoverArtwork} contentFit="cover" />
      ) : (
        <View style={[styles.discoverArtwork, styles.artworkFallback]}>
          <Text style={styles.artworkFallbackText}>♪</Text>
        </View>
      )}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title || item.username || "Untitled"}
      </Text>
      <Text style={styles.cardSubtitle} numberOfLines={1}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

function DiscoverRow({
  item,
  onPress,
}: {
  item: DiscoverItem;
  onPress: () => void;
}) {
  const image = artworkFor(item) || item.avatar_url || null;
  const subtitle =
    item.user?.username ||
    item.username ||
    (item.kind === "playlist" || item.kind === "system-playlist" ? "Playlist" : "SoundCloud");

  return (
    <Pressable style={styles.resultRow} onPress={onPress}>
      {image ? (
        <Image source={{ uri: image }} style={styles.resultArtwork} contentFit="cover" />
      ) : (
        <View style={[styles.resultArtwork, styles.artworkFallback]}>
          <Text style={styles.resultFallbackText}>♪</Text>
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title || item.username || "Untitled"}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text style={styles.resultPlay}>▶</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loginContent: {
    padding: 18,
  },
  discoverScreen: {
    flex: 1,
  },
  discoverHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  discoverTitle: {
    color: AppTheme.text,
    fontSize: 28,
    fontWeight: "800",
  },
  discoverSubtitle: {
    color: AppTheme.textSoft,
    fontSize: 12,
    marginTop: 2,
  },
  connectionBadge: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  discoverContent: {
    paddingTop: 10,
    paddingBottom: 140,
    gap: 18,
  },
  discoverScroll: {
    flex: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#e5bd63",
  },
  statusConnected: {
    backgroundColor: "#64d99b",
  },
  statusError: {
    backgroundColor: "#f07878",
  },
  syncText: {
    color: AppTheme.textSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  searchBox: {
    marginHorizontal: 18,
    height: 50,
    marginBottom: 4,
    borderRadius: 16,
    backgroundColor: AppTheme.input,
    borderWidth: 1,
    borderColor: AppTheme.line,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  searchIcon: {
    color: AppTheme.textSoft,
    fontSize: 22,
  },
  searchInput: {
    flex: 1,
    color: AppTheme.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearch: {
    color: AppTheme.textMuted,
    fontSize: 22,
    paddingHorizontal: 4,
  },
  remoteCard: {
    marginHorizontal: 18,
    borderRadius: 18,
    backgroundColor: AppTheme.panel,
    borderWidth: 1,
    borderColor: AppTheme.line,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
  },
  remoteArtwork: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: AppTheme.panelAlt,
  },
  remoteInfo: {
    flex: 1,
    gap: 2,
  },
  remoteEyebrow: {
    color: AppTheme.textSoft,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  remoteTitle: {
    color: AppTheme.text,
    fontSize: 13,
    fontWeight: "700",
  },
  remoteArtist: {
    color: AppTheme.textMuted,
    fontSize: 11,
  },
  remoteAction: {
    color: AppTheme.accentSoft,
    fontSize: 11,
    fontWeight: "800",
  },
  remoteActionButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  remoteControls: {
    marginTop: -12,
    marginHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  remoteControlText: {
    color: AppTheme.textSoft,
    fontSize: 10,
    fontWeight: "700",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  artworkFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  artworkFallbackText: {
    color: AppTheme.text,
    fontSize: 22,
  },
  handoffButton: {
    alignSelf: "flex-end",
    marginTop: -12,
    marginRight: 22,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  handoffText: {
    color: AppTheme.accentSoft,
    fontSize: 11,
    fontWeight: "700",
  },
  loadingIndicator: {
    marginVertical: 4,
  },
  loadingDiscover: {
    marginTop: 36,
  },
  errorText: {
    color: "#ff9f9f",
    fontSize: 12,
    paddingHorizontal: 20,
  },
  section: {
    gap: 10,
  },
  sectionHeading: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: AppTheme.text,
    fontSize: 18,
    fontWeight: "800",
  },
  sectionCount: {
    color: AppTheme.textSoft,
    fontSize: 11,
  },
  cardsRow: {
    paddingHorizontal: 18,
    gap: 12,
  },
  discoverCard: {
    width: 142,
  },
  discoverArtwork: {
    width: 142,
    height: 142,
    borderRadius: 18,
    backgroundColor: AppTheme.panelAlt,
    marginBottom: 8,
  },
  cardTitle: {
    color: AppTheme.text,
    fontSize: 13,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: AppTheme.textSoft,
    fontSize: 11,
    marginTop: 3,
  },
  searchResults: {
    paddingHorizontal: 18,
    gap: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingVertical: 4,
  },
  resultArtwork: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: AppTheme.panelAlt,
  },
  resultFallbackText: {
    color: AppTheme.text,
    fontSize: 19,
  },
  resultInfo: {
    flex: 1,
  },
  resultPlay: {
    color: AppTheme.accentSoft,
    fontSize: 13,
    paddingHorizontal: 5,
  },
});
