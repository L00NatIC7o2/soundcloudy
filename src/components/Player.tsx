import { useEffect, useRef, useState, memo, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { io, Socket } from "socket.io-client";
import Hls from "hls.js";
import PlaylistMenu from "./PlaylistMenu";
import MobilePlaylistSheet from "./MobilePlaylistSheet";
import {
  fetchTrackDetails,
  getCachedTrackDetails,
  prefetchTrackDetails,
  type TrackDetails,
} from "../lib/trackDetails";
import { getClientSocketUrl } from "../lib/runtimeConfig";

interface PlayerProps {
  currentTrack: any;
  onTrackEnd?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onArtistClick?: (artist: any) => void;
  onPlaylistClick?: (
    playlistId: number | null,
    playlistTitle: string | null,
  ) => void;
  onTrackOpen?: (track: any) => void;
  queue?: any[];
  currentQueueIndex?: number;
  listeningHistory?: any[];
  historyHasMore?: boolean;
  historyLoadingMore?: boolean;
  onRequestMoreHistory?: () => void;
  queueSource?: "playlist" | "search" | "search-related";
  onQueueSelect?: (
    track: any,
    source: "playlist" | "search" | "search-related",
    trackList: any[],
  ) => void;
  isShuffle?: boolean;
  onShuffleChange?: (shuffle: boolean) => void;
  crossfadeEnabled?: boolean;
  crossfadeDuration?: number;
  onCrossfadeNext?: (trackId: string) => void;
  onCrossfadeVisualChange?: (artwork: string | null, durationSeconds?: number) => void;
  onAudioSpectrum?: (spectrum: number[]) => void;
  equalizer?: {
    enabled: boolean;
    low: number;
    lowMid: number;
    mid: number;
    highMid: number;
    high: number;
  };
}

type PlayerSidebarTab = "queue" | "friends" | "now-playing";

type FriendActivity = {
  id: string;
  userId?: number;
  name: string;
  avatarUrl?: string | null;
  permalink?: string | null;
  visibility: "online";
  online: boolean;
  updatedAt?: number | null;
  lastTrack?: {
    title: string;
    artist?: string | null;
    artwork?: string | null;
  } | null;
  currentTrack?: {
    title: string;
    artist?: string | null;
    artwork?: string | null;
  } | null;
};

type FriendRequestSummary = {
  userId: number;
  name: string;
  avatarUrl?: string | null;
  permalink?: string | null;
  createdAt?: number | null;
  status?: "incoming" | "outgoing" | null;
};

type FriendSearchResult = {
  userId: number;
  name: string;
  avatarUrl?: string | null;
  permalink?: string | null;
  friendCode?: string | null;
  status: "self" | "none" | "incoming" | "outgoing" | "friends";
};

const Player = memo(function Player({
  currentTrack,
  onTrackEnd,
  onPrevious,
  onNext,
  onArtistClick,
  onPlaylistClick,
  onTrackOpen,
  queue = [],
  currentQueueIndex = -1,
  listeningHistory = [],
  historyHasMore = false,
  historyLoadingMore = false,
  onRequestMoreHistory,
  queueSource = "playlist",
  onQueueSelect,
  isShuffle = false,
  onShuffleChange,
  crossfadeEnabled = false,
  crossfadeDuration = 5,
  onCrossfadeNext,
  onCrossfadeVisualChange,
  onAudioSpectrum,
  equalizer = { enabled: false, low: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 },
}: PlayerProps) {
  const getTrackArtwork = (track: any) =>
    track?.artwork_url?.replace?.("-large", "-t500x500") ||
    track?.user?.avatar_url?.replace?.("-large", "-t500x500") ||
    "/placeholder.png";

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const primaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const secondaryAudioRef = useRef<HTMLAudioElement | null>(null);
  const [activeAudioSlot, setActiveAudioSlot] = useState<0 | 1>(0);
  const [crossfadeArtwork, setCrossfadeArtwork] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPipelinesRef = useRef(new Map<HTMLAudioElement, {
    filters: BiquadFilterNode[];
    analyser: AnalyserNode;
    gain: GainNode;
  }>());
  const hlsRef = useRef<Hls | null>(null);
  const standbyHlsRef = useRef<Hls | null>(null);
  const preloadedTrackRef = useRef<{ id: string; track: any; hls: Hls | null; ready: boolean } | null>(null);
  const promotedTrackIdRef = useRef<string | null>(null);
  const crossfadeStartedRef = useRef(false);
  const crossfadeTimerRef = useRef<number | null>(null);
  const streamLookupRequestsRef = useRef(
    new Map<string, { promise: Promise<any>; expiresAt: number }>(),
  );
  const [syncRoomId, setSyncRoomId] = useState("");
  const deviceId =
    typeof window !== "undefined"
      ? localStorage.getItem("soundcloudy_device_id") ||
        (() => {
          const id = Math.random().toString(36).slice(2);
          localStorage.setItem("soundcloudy_device_id", id);
          return id;
        })()
      : "";
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobileDevice = /iphone|ipad|android|mobile/i.test(userAgent);
  const deviceKind = isMobileDevice ? "mobile" : "desktop";
  const devicePlatform = /iphone|ipad/i.test(userAgent)
    ? "ios"
    : /android/i.test(userAgent)
      ? "android"
      : isMobileDevice
        ? "mobile-web"
        : "desktop-web";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playbackOwnerDeviceId, setPlaybackOwnerDeviceId] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [isMobileDeviceSheetOpen, setIsMobileDeviceSheetOpen] = useState(false);
  const currentTrackRef = useRef<any>(null);
  const lastScrobbledTrackIdRef = useRef<string | null>(null);
  const playbackOwnerRef = useRef<string | null>(null);
  const syncRoomRetryRef = useRef<number | null>(null);
  const suppressRemoteEchoUntilRef = useRef(0);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack?.id) return;
    const trackId = String(currentTrack.id);
    if (lastScrobbledTrackIdRef.current === trackId) return;
    lastScrobbledTrackIdRef.current = trackId;

    void fetch("/api/scrobble", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackId }),
    })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) {
          console.warn("SoundCloud play report was not accepted:", result);
        }
      })
      .catch((error) => {
        console.warn("Could not report playback to SoundCloud:", error);
      });
  }, [currentTrack?.id]);

  useEffect(() => {
    playbackOwnerRef.current = playbackOwnerDeviceId;
  }, [playbackOwnerDeviceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const resolveSyncRoom = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) return false;
        const session = await response.json();
        if (!cancelled && session?.roomId) {
          console.log("[player-sync] resolved session room", {
            roomId: session.roomId,
            userId: session.userId,
            deviceId,
          });
          setSyncRoomId((prev) => (prev === session.roomId ? prev : session.roomId));
          return true;
        }
      } catch {
        // Ignore session fetch failures and retry later.
      }
      return false;
    };

    const retryUntilResolved = async () => {
      const resolved = await resolveSyncRoom();
      if (!resolved && !cancelled) {
        syncRoomRetryRef.current = window.setTimeout(retryUntilResolved, 2000);
      } else if (resolved && syncRoomRetryRef.current !== null) {
        window.clearTimeout(syncRoomRetryRef.current);
        syncRoomRetryRef.current = null;
      }
    };

    const handleVisibilityRefresh = () => {
      void resolveSyncRoom();
    };

    void retryUntilResolved();
    window.addEventListener("focus", handleVisibilityRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      cancelled = true;
      if (syncRoomRetryRef.current !== null) {
        window.clearTimeout(syncRoomRetryRef.current);
      }
      window.removeEventListener("focus", handleVisibilityRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, []);

  useEffect(() => {
    if (!syncRoomId) return;
    console.log("[player-sync] opening socket", {
      roomId: syncRoomId,
      deviceId,
      socketUrl: getClientSocketUrl(window.location.origin),
    });
    const s = io(getClientSocketUrl(window.location.origin), {
      withCredentials: false,
    });
    setSocket(s);

    const syncRemotePlayback = (remoteState: any) => {
      if (!remoteState) return;

      const remoteOwner =
        typeof remoteState.deviceId === "string" ? remoteState.deviceId : null;
      setPlaybackOwnerDeviceId(remoteOwner);
      suppressRemoteEchoUntilRef.current = Date.now() + 1500;

      const remoteTrack = remoteState.trackData || null;
      if (
        remoteTrack &&
        remoteState.trackId &&
        remoteState.trackId !== currentTrackRef.current?.id
      ) {
        window.dispatchEvent(
          new CustomEvent("remote-load-track", {
            detail: {
              track: remoteTrack,
              position: Number(remoteState.position) || 0,
              shouldPlay: false,
              queueData: Array.isArray(remoteState.queueData) ? remoteState.queueData : null,
              currentQueueIndex:
                typeof remoteState.currentQueueIndex === "number"
                  ? remoteState.currentQueueIndex
                  : 0,
              queueSource: remoteState.queueSource || "search-related",
            },
          }),
        );
      }

      if (typeof remoteState.position === "number") {
        setCurrentTime(remoteState.position);
        if (audioRef.current && remoteOwner === deviceId) {
          audioRef.current.currentTime = remoteState.position;
        }
      }
      if (typeof remoteState.duration === "number") {
        setDuration(remoteState.duration);
      }
      if (typeof remoteState.playing === "boolean") {
        if (audioRef.current && remoteOwner && remoteOwner !== deviceId) {
          audioRef.current.pause();
        }
        setIsPlaying(remoteState.playing);
      }
    };

    s.on("connect", () => {
      console.log("[player-sync] socket connected", {
        roomId: syncRoomId,
        deviceId,
        socketId: s.id,
      });
      s.emit(
        "join",
        {
          roomId: syncRoomId,
          deviceId,
          deviceMeta: {
            kind: deviceKind,
            platform: devicePlatform,
            label: isMobileDevice ? "This Device" : "This Computer",
          },
        },
        (ack?: { playbackState?: any; devices?: any[] }) => {
          console.log("[player-sync] join ack", {
            roomId: syncRoomId,
            deviceId,
            hasPlaybackState: Boolean(ack?.playbackState),
            playbackTrackId: ack?.playbackState?.trackId || null,
          });
          if (Array.isArray(ack?.devices)) {
            setAvailableDevices(ack.devices);
          }
          if (ack?.playbackState) {
            syncRemotePlayback(ack.playbackState);
          }
        },
      );
    });

    s.on("connect_error", (error) => {
      console.error("[player-sync] socket connect_error", {
        roomId: syncRoomId,
        deviceId,
        socketUrl: getClientSocketUrl(window.location.origin),
        message: error?.message || String(error),
      });
    });

    s.on("disconnect", (reason) => {
      console.warn("[player-sync] socket disconnected", {
        roomId: syncRoomId,
        deviceId,
        reason,
      });
    });

    s.on("devices-update", (payload) => {
      setAvailableDevices(Array.isArray(payload?.devices) ? payload.devices : []);
      if (typeof payload?.activeDeviceId === "string") {
        setPlaybackOwnerDeviceId(payload.activeDeviceId);
      }
      console.log("[player-sync] received devices-update", {
        roomId: syncRoomId,
        deviceId,
        activeDeviceId: payload?.activeDeviceId || null,
        count: Array.isArray(payload?.devices) ? payload.devices.length : 0,
      });
    });

    s.on("playback-update", (remoteState) => {
      console.log("[player-sync] received playback-update", {
        roomId: syncRoomId,
        deviceId,
        trackId: remoteState?.trackId || null,
        playing: remoteState?.playing ?? null,
      });
      syncRemotePlayback(remoteState);
    });

    s.on("remote-command", (command) => {
      console.log("[player-sync] received remote-command", {
        roomId: syncRoomId,
        deviceId,
        command,
      });
      if (command && typeof command === "object") {
        if (command.type === "claim-output" && command.deviceId) {
          setPlaybackOwnerDeviceId(command.deviceId);

          if (command.deviceId === deviceId) {
            if (command.track) {
              window.dispatchEvent(
                new CustomEvent("remote-load-track", {
                  detail: {
                    track: command.track,
                    position: Number(command.position) || 0,
                    shouldPlay: command.shouldPlay !== false,
                    queueData: Array.isArray(command.queueData) ? command.queueData : null,
                    currentQueueIndex:
                      typeof command.currentQueueIndex === "number"
                        ? command.currentQueueIndex
                        : 0,
                    queueSource: command.queueSource || "search-related",
                  },
                }),
              );
            } else if (audioRef.current) {
              audioRef.current.currentTime = Number(command.position) || 0;
              if (command.shouldPlay !== false) {
                void audioRef.current.play().catch(() => {});
                setIsPlaying(true);
              } else {
                audioRef.current.pause();
                setIsPlaying(false);
              }
            }
          } else if (audioRef.current) {
            audioRef.current.pause();
          }
          return;
        }

        if (command.type === "load-track" && command.track) {
          window.dispatchEvent(
            new CustomEvent("remote-load-track", {
              detail: {
                track: command.track,
                position: Number(command.position) || 0,
                shouldPlay: command.shouldPlay !== false,
              },
            }),
          );
          return;
        }
      }
      if (command === "play") {
        if (audioRef.current) {
          void audioRef.current.play().catch(() => {});
        }
        setIsPlaying(true);
      }
      if (command === "pause") {
        audioRef.current?.pause();
        setIsPlaying(false);
      }
      if (command === "next") handleNext();
      if (command === "prev") handlePrevious();
    });

    return () => {
      s.disconnect();
    };
  }, [syncRoomId, deviceId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    audioRef.current = activeAudioSlot === 0 ? primaryAudioRef.current : secondaryAudioRef.current;
  }, [activeAudioSlot, Boolean(currentTrack)]);

  useEffect(() => {
    const audio = audioRef.current;
    if (
      typeof window === "undefined" ||
      !window.AudioContext
    ) return;

    if (!audio) {
      if (!currentTrack && audioContextRef.current) {
        const previousContext = audioContextRef.current;
        audioContextRef.current = null;
        audioPipelinesRef.current.clear();
        preloadedTrackRef.current = null;
        promotedTrackIdRef.current = null;
        crossfadeStartedRef.current = false;
        setActiveAudioSlot(0);
        if (crossfadeTimerRef.current !== null) {
          window.clearTimeout(crossfadeTimerRef.current);
          crossfadeTimerRef.current = null;
        }
        hlsRef.current?.destroy();
        standbyHlsRef.current?.destroy();
        hlsRef.current = null;
        standbyHlsRef.current = null;
        void previousContext.close().catch(() => {});
      }
      return;
    }
    const context = audioContextRef.current || new AudioContext();
    audioContextRef.current = context;
    const ensurePipeline = (element: HTMLAudioElement | null, active: boolean) => {
      if (!element || audioPipelinesRef.current.has(element)) return;
      const source = context.createMediaElementSource(element);
      const low = context.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 60;
      const lowMid = context.createBiquadFilter();
      lowMid.type = "peaking";
      lowMid.frequency.value = 250;
      lowMid.Q.value = 0.8;
      const mid = context.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1000;
      mid.Q.value = 0.8;
      const highMid = context.createBiquadFilter();
      highMid.type = "peaking";
      highMid.frequency.value = 4000;
      highMid.Q.value = 0.8;
      const high = context.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 12000;
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      const gain = context.createGain();
      gain.gain.value = active ? 1 : 0;
      source.connect(low);
      low.connect(lowMid);
      lowMid.connect(mid);
      mid.connect(highMid);
      highMid.connect(high);
      high.connect(analyser);
      analyser.connect(gain);
      gain.connect(context.destination);
      audioPipelinesRef.current.set(element, { filters: [low, lowMid, mid, highMid, high], analyser, gain });
    };
    ensurePipeline(primaryAudioRef.current, activeAudioSlot === 0);
    ensurePipeline(secondaryAudioRef.current, activeAudioSlot === 1);
  }, [Boolean(currentTrack), activeAudioSlot]);
  useEffect(() => {
    const analyser = audioRef.current
      ? audioPipelinesRef.current.get(audioRef.current)?.analyser
      : null;
    if (!onAudioSpectrum || !analyser) {
      onAudioSpectrum?.([]);
      return;
    }

    const samples = new Uint8Array(analyser.frequencyBinCount);
    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const bucketCount = 72;
    let frame = 0;
    let lastUpdate = 0;
    const readSpectrum = (timestamp: number) => {
      frame = window.requestAnimationFrame(readSpectrum);
      if (timestamp - lastUpdate < 45) return;
      lastUpdate = timestamp;
      analyser.getByteFrequencyData(samples);
      const spectrum = Array.from({ length: bucketCount }, (_, index) => {
        const lowFrequency = 20 * 10 ** ((index / bucketCount) * 3);
        const highFrequency = 20 * 10 ** (((index + 1) / bucketCount) * 3);
        const firstBin = Math.max(1, Math.floor((lowFrequency * analyser.fftSize) / sampleRate));
        const lastBin = Math.min(samples.length - 1, Math.ceil((highFrequency * analyser.fftSize) / sampleRate));
        let peak = 0;
        for (let bin = firstBin; bin <= lastBin; bin += 1) peak = Math.max(peak, samples[bin]);
        return Math.min(1, peak / 210);
      });
      onAudioSpectrum(spectrum);
    };
    frame = window.requestAnimationFrame(readSpectrum);
    return () => window.cancelAnimationFrame(frame);
  }, [onAudioSpectrum, activeAudioSlot, Boolean(currentTrack)]);
  useEffect(() => {
    const gains = equalizer.enabled
      ? [equalizer.low, equalizer.lowMid, equalizer.mid, equalizer.highMid, equalizer.high]
      : [0, 0, 0, 0, 0];
    audioPipelinesRef.current.forEach((pipeline) => {
      pipeline.filters.forEach((filter, index) => {
        filter.gain.setTargetAtTime(gains[index], audioContextRef.current?.currentTime || 0, 0.04);
      });
    });
  }, [
    equalizer.enabled,
    equalizer.low,
    equalizer.lowMid,
    equalizer.mid,
    equalizer.highMid,
    equalizer.high,
  ]);
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [artworkContextMenu, setArtworkContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [artworkContextPlaylistMenu, setArtworkContextPlaylistMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isQueuePanelOpen, setIsQueuePanelOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] =
    useState<PlayerSidebarTab>("queue");
  const [queuePanelWidth, setQueuePanelWidth] = useState(() => {
    if (typeof window === "undefined") return 320;
    const stored = Number(window.localStorage.getItem("soundcloudy_queue_panel_width"));
    return Number.isFinite(stored) && stored >= 280 && stored <= 640 ? stored : 320;
  });
  const [isQueueResizing, setIsQueueResizing] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isMobilePlaylistSheetOpen, setIsMobilePlaylistSheetOpen] =
    useState(false);
  const [mobileSheetPage, setMobileSheetPage] = useState<"player" | "details">(
    "player",
  );
  const [shouldMarqueeMobileTitle, setShouldMarqueeMobileTitle] = useState(false);
  const [isVolumePopoverOpen, setIsVolumePopoverOpen] = useState(false);
  const [playlistsWithTrack, setPlaylistsWithTrack] = useState<number[]>([]);
  const [isInAnyPlaylist, setIsInAnyPlaylist] = useState(false);
  const [isFollowingCurrentArtist, setIsFollowingCurrentArtist] = useState(false);
  const [checkingCurrentArtistFollow, setCheckingCurrentArtistFollow] =
    useState(false);
  const [mobileTrackDetails, setMobileTrackDetails] = useState<TrackDetails | null>(
    null,
  );
  const [mobileTrackDetailsLoading, setMobileTrackDetailsLoading] =
    useState(false);
  const [mobileTrackDetailsError, setMobileTrackDetailsError] = useState<
    string | null
  >(null);
  const [mobileVisibleCommentsCount, setMobileVisibleCommentsCount] = useState(5);
  const lastBackClickRef = useRef<number>(0);
  const lastRemoteSyncRef = useRef<number>(0);
  const lastEmittedPlaybackRef = useRef<{
    trackId: number | null;
    playing: boolean;
    roundedPosition: number;
  } | null>(null);
  const pendingRemoteSeekRef = useRef<number | null>(null);
  const mobileTitleRef = useRef<HTMLDivElement>(null);
  const mobileTitleSpanRef = useRef<HTMLSpanElement>(null);
  const mobileSheetTouchStartRef = useRef<number | null>(null);
  const mobileSheetTouchCurrentRef = useRef<number | null>(null);
  const mobileTrackPageRef = useRef<HTMLDivElement | null>(null);
  const queueCurrentTrackRef = useRef<HTMLDivElement | null>(null);
  const queueNowPlayingSectionRef = useRef<HTMLElement | null>(null);
  const queueListRef = useRef<HTMLDivElement | null>(null);
  const queueResizeStartXRef = useRef<number | null>(null);
  const queueResizeStartWidthRef = useRef<number>(320);
  const queuePullTabStartXRef = useRef<number | null>(null);
  const queuePullTabDraggedRef = useRef(false);
  const artworkContextMenuRef = useRef<HTMLDivElement | null>(null);
  const playlistMembershipRequestRef = useRef(0);
  const [friendActivity, setFriendActivity] = useState<FriendActivity[]>([]);
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<
    FriendRequestSummary[]
  >([]);
  const [outgoingFriendRequests, setOutgoingFriendRequests] = useState<
    FriendRequestSummary[]
  >([]);
  const [friendPrivacy, setFriendPrivacy] = useState({
    appearOffline: false,
    shareListeningActivity: true,
  });
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<
    FriendSearchResult[]
  >([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [friendCodeCopied, setFriendCodeCopied] = useState(false);

  useEffect(() => {
    if (!isMobilePlayerOpen) {
      setShouldMarqueeMobileTitle(false);
      return;
    }

    const updateMobileTitleOverflow = () => {
      const element = mobileTitleRef.current;
      const span = mobileTitleSpanRef.current;
      if (!element || !span) return;

      const elementRect = element.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();
      setShouldMarqueeMobileTitle(spanRect.right > elementRect.right + 6);
    };

    const frame = window.requestAnimationFrame(updateMobileTitleOverflow);
    window.addEventListener("resize", updateMobileTitleOverflow);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMobileTitleOverflow);
    };
  }, [currentTrack?.title, isMobilePlayerOpen]);

  useEffect(() => {
    if (!isQueuePanelOpen) return;
    if (activeSidebarTab !== "queue") return;
    const frame = window.requestAnimationFrame(() => {
      const list = queueListRef.current;
      const nowPlayingSection = queueNowPlayingSectionRef.current;
      if (!list || !nowPlayingSection) return;

      const listTop = list.getBoundingClientRect().top;
      const sectionTop = nowPlayingSection.getBoundingClientRect().top;
      const nextScrollTop = Math.max(
        list.scrollTop + (sectionTop - listTop),
        0,
      );
      list.scrollTop = nextScrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isQueuePanelOpen, activeSidebarTab, currentTrack?.id, currentQueueIndex, queue.length]);

  useEffect(() => {
    if (!isQueuePanelOpen) return;
    if (activeSidebarTab !== "now-playing") return;
    const frame = window.requestAnimationFrame(() => {
      if (queueListRef.current) {
        queueListRef.current.scrollTop = 0;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isQueuePanelOpen, activeSidebarTab, currentTrack?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const loadFriends = async () => {
      if (!cancelled) {
        setFriendsLoading(true);
      }
      try {
        if (cancelled) return;
        await reloadFriendState();
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load friends:", error);
        setFriendActivity([]);
        setIncomingFriendRequests([]);
        setOutgoingFriendRequests([]);
        setFriendCode("");
      } finally {
        if (!cancelled) {
          setFriendsLoading(false);
        }
      }
    };

    void loadFriends();

    if (activeSidebarTab !== "friends") {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => {
      void loadFriends();
    }, 15000);

    const handleFocus = () => {
      void loadFriends();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, [activeSidebarTab]);

  useEffect(() => {
    if (activeSidebarTab !== "friends") return;

    const trimmed = friendSearchQuery.trim();
    if (!trimmed) {
      setFriendSearchResults([]);
      setFriendSearchError("");
      setFriendSearchLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshFriendSearch(trimmed);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeSidebarTab, friendSearchQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sendPresence = (online = document.visibilityState !== "hidden") => {
      void fetch("/api/friends/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          online,
          isPlaying,
          track:
            online && isPlaying && currentTrack?.id
              ? {
                  id: currentTrack.id,
                  title: currentTrack.title,
                  artist: currentTrack.user?.username || "Unknown",
                  artwork: getTrackArtwork(currentTrack),
                }
              : null,
        }),
      }).catch(() => {});
    };

    sendPresence();
    const intervalId = window.setInterval(sendPresence, 30000);
    const handleVisibilityChange = () => {
      sendPresence(document.visibilityState !== "hidden");
    };
    const handleBeforeUnload = () => {
      sendPresence(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [currentTrack?.id, isPlaying]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "soundcloudy_queue_panel_width",
      String(Math.round(queuePanelWidth)),
    );
  }, [queuePanelWidth]);

  useEffect(() => {
    if (!isQueuePanelOpen || typeof window === "undefined") return;

    const syncQueueWidthWithTrackPanel = () => {
      const panel = document.querySelector(".track-panel-shell") as HTMLElement | null;
      if (!panel) return;

      const rect = panel.getBoundingClientRect();
      const availableWidth = Math.floor(window.innerWidth - rect.right - 20);
      if (availableWidth <= 0) return;

      const snappedWidth = Math.min(640, Math.max(280, availableWidth));
      if (queuePanelWidth > snappedWidth) {
        setQueuePanelWidth(snappedWidth);
      }
    };

    const observer = new MutationObserver(() => {
      syncQueueWidthWithTrackPanel();
    });

    syncQueueWidthWithTrackPanel();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    window.addEventListener("resize", syncQueueWidthWithTrackPanel);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncQueueWidthWithTrackPanel);
    };
  }, [isQueuePanelOpen, queuePanelWidth]);

  useEffect(() => {
    if (!isQueueResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (queueResizeStartXRef.current === null) return;
      if (
        queuePullTabStartXRef.current !== null &&
        Math.abs(event.clientX - queuePullTabStartXRef.current) > 4
      ) {
        queuePullTabDraggedRef.current = true;
      }
      const delta = queueResizeStartXRef.current - event.clientX;
      const viewportWidth = window.innerWidth;
      const maxWidth = Math.min(640, Math.max(320, viewportWidth - 24));
      const nextWidth = Math.min(
        maxWidth,
        Math.max(280, queueResizeStartWidthRef.current + delta),
      );
      setQueuePanelWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsQueueResizing(false);
      queueResizeStartXRef.current = null;
      queuePullTabStartXRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isQueueResizing]);

  const handleQueueListScroll = () => {
    const element = queueListRef.current;
    if (!element || !isQueuePanelOpen) return;
    if (!historyHasMore || historyLoadingMore || !onRequestMoreHistory) return;
    if (element.scrollTop > 120) return;
    onRequestMoreHistory();
  };

  const handleQueueResizeStart = (
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (typeof window !== "undefined" && window.innerWidth <= 1000) return;
    queueResizeStartXRef.current = event.clientX;
    queueResizeStartWidthRef.current = queuePanelWidth;
    setIsQueueResizing(true);
  };

  const handleQueuePullTabPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    queuePullTabStartXRef.current = event.clientX;
    queuePullTabDraggedRef.current = false;
    if (isQueuePanelOpen) {
      handleQueueResizeStart(event);
    }
  };

  const handleQueuePullTabClick = () => {
    if (queuePullTabDraggedRef.current) {
      queuePullTabDraggedRef.current = false;
      return;
    }
    setIsQueuePanelOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!currentTrack?.id) {
      setMobileTrackDetails(null);
      setMobileTrackDetailsError(null);
      setMobileTrackDetailsLoading(false);
      return;
    }

    setMobileVisibleCommentsCount(5);
    const cached = getCachedTrackDetails(currentTrack.id);
    if (cached) {
      setMobileTrackDetails(cached);
      setMobileTrackDetailsError(null);
      setMobileTrackDetailsLoading(false);
    } else {
      setMobileTrackDetails(null);
      setMobileTrackDetailsLoading(true);
    }

    let cancelled = false;
    setMobileTrackDetailsError(null);

    fetchTrackDetails(currentTrack.id)
      .then((data) => {
        if (!cancelled) {
          setMobileTrackDetails(data);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMobileTrackDetailsError(
            error instanceof Error ? error.message : "Failed to load track",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMobileTrackDetailsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id]);

  useEffect(() => {
    const artistId = currentTrack?.user?.id;
    if (!artistId) {
      setIsFollowingCurrentArtist(false);
      setCheckingCurrentArtistFollow(false);
      return;
    }

    let cancelled = false;
    setCheckingCurrentArtistFollow(true);

    fetch(`/api/check-follow?userId=${artistId}`)
      .then(async (response) => {
        if (!response.ok) return { isFollowing: false };
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setIsFollowingCurrentArtist(Boolean(data?.isFollowing));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsFollowingCurrentArtist(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingCurrentArtistFollow(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.user?.id]);
  const volumePopoverRef = useRef<HTMLDivElement | null>(null);
  const playlistLabel =
    currentTrack?.playlistTitle ||
    currentTrack?.publisher_metadata?.album_title ||
    "";
  const playlistId = currentTrack?.playlistId || null;
  const canOpenPlaylist = Boolean(onPlaylistClick && playlistId);
  const canOpenArtist = Boolean(onArtistClick && currentTrack?.user);
  const playerArtwork = getTrackArtwork(currentTrack);
  const playerStyle = {
    "--player-artwork": `url("${playerArtwork}")`,
  } as CSSProperties;
  const mobileTrackArtist =
    mobileTrackDetails?.artist || currentTrack?.user || currentTrack?.artist || null;
  const nowPlayingArtist = mobileTrackArtist;
  const mobileTrackStats = [
    {
      label: "Plays",
      value:
        mobileTrackDetails?.play_count ??
        currentTrack?.play_count ??
        currentTrack?.playback_count ??
        0,
    },
    {
      label: "Likes",
      value:
        mobileTrackDetails?.likes_count ??
        currentTrack?.likes_count ??
        currentTrack?.favoritings_count ??
        0,
    },
    {
      label: "Reposts",
      value: mobileTrackDetails?.reposts_count ?? currentTrack?.reposts_count ?? 0,
    },
  ];
  const mobileTrackBio = mobileTrackDetails?.bio || currentTrack?.description || "";
  const mobileComments = mobileTrackDetails?.comments || [];
  const mobileVisibleComments = mobileComments.slice(0, mobileVisibleCommentsCount);
  const mobileCanShowMoreComments =
    mobileVisibleCommentsCount < mobileComments.length;
  const mobileRelatedTracks = mobileTrackDetails?.related_tracks || [];
  const queueItems = queue.length
    ? queue
    : currentTrack
      ? [currentTrack]
      : [];
  const resolvedCurrentQueueIndex =
    currentQueueIndex >= 0
      ? currentQueueIndex
      : queueItems.findIndex((item) => item?.id === currentTrack?.id);
  const currentQueueTrack =
    resolvedCurrentQueueIndex >= 0
      ? queueItems[resolvedCurrentQueueIndex]
      : currentTrack;
  const upcomingQueueTracks =
    resolvedCurrentQueueIndex >= 0
      ? queueItems.slice(resolvedCurrentQueueIndex + 1)
      : queueItems.filter((item) => item?.id !== currentTrack?.id);
  const historyItems = listeningHistory
    .filter((item) => item?.id && item.id !== currentTrack?.id)
    .slice()
    .reverse();
  const reloadFriendState = async () => {
    const response = await fetch("/api/friends");
    if (!response.ok) {
      throw new Error(`Failed to load friends: ${response.status}`);
    }

    const data = await response.json();
    setFriendActivity(Array.isArray(data?.friends) ? data.friends : []);
    setIncomingFriendRequests(
      Array.isArray(data?.incomingRequests) ? data.incomingRequests : [],
    );
    setOutgoingFriendRequests(
      Array.isArray(data?.outgoingRequests) ? data.outgoingRequests : [],
    );
    setFriendPrivacy({
      appearOffline: Boolean(data?.privacy?.appearOffline),
      shareListeningActivity: data?.privacy?.shareListeningActivity !== false,
    });
    setFriendCode(typeof data?.friendCode === "string" ? data.friendCode : "");
    return data;
  };

  const refreshFriendSearch = async (query = friendSearchQuery) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setFriendSearchResults([]);
      setFriendSearchError("");
      return;
    }

    setFriendSearchLoading(true);
    setFriendSearchError("");
    try {
      const response = await fetch(
        `/api/friends/search?q=${encodeURIComponent(trimmed)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to search for friends");
      }
      setFriendSearchResults(
        Array.isArray(data?.results) ? data.results : [],
      );
    } catch (error) {
      console.error("Failed to search for friends:", error);
      setFriendSearchResults([]);
      setFriendSearchError(
        error instanceof Error ? error.message : "Failed to search for friends",
      );
    } finally {
      setFriendSearchLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId: number) => {
    const response = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Failed to send friend request");
    }

    await reloadFriendState();
    await refreshFriendSearch();
  };

  const handleCopyFriendCode = async () => {
    if (!friendCode || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(friendCode);
      setFriendCodeCopied(true);
      window.setTimeout(() => {
        setFriendCodeCopied(false);
      }, 1600);
    } catch (error) {
      console.error("Failed to copy friend code:", error);
    }
  };

  const handleAcceptFriendRequest = async (userId: number) => {
    try {
      const response = await fetch("/api/friends/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterUserId: userId }),
      });
      if (!response.ok) return;
      setIncomingFriendRequests((prev) => prev.filter((request) => request.userId !== userId));
      await reloadFriendState();
      await refreshFriendSearch();
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    }
  };

  const toggleAppearOffline = async () => {
    const nextAppearOffline = !friendPrivacy.appearOffline;
    setFriendPrivacy((prev) => ({ ...prev, appearOffline: nextAppearOffline }));
    try {
      await fetch("/api/friends/privacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appearOffline: nextAppearOffline,
          shareListeningActivity: friendPrivacy.shareListeningActivity,
        }),
      });
    } catch (error) {
      console.error("Failed to update friend privacy:", error);
      setFriendPrivacy((prev) => ({ ...prev, appearOffline: !nextAppearOffline }));
    }
  };

  const visibleFriendActivity = friendActivity;

  useEffect(() => {
    if (currentTrack && "mediaSession" in navigator) {
      const setMediaActionHandler = (
        action: MediaSessionAction,
        handler: MediaSessionActionHandler | null,
      ) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch {
          // Some iOS builds support a narrower action set. Ignore unsupported handlers.
        }
      };

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.user?.username || "Unknown Artist",
        album: playlistLabel,
        artwork: [
          {
            src: getTrackArtwork(currentTrack),
            sizes: "500x500",
            type: "image/jpeg",
          },
        ],
      });

      setMediaActionHandler("play", () => {
        if (audioRef.current) {
          void audioRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      });

      setMediaActionHandler("pause", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });

      setMediaActionHandler("previoustrack", () => {
        if (onPrevious) onPrevious();
      });

      setMediaActionHandler("nexttrack", () => {
        if (onNext) onNext();
      });

      setMediaActionHandler("seekbackward", (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(
            audioRef.current.currentTime - (details.seekOffset || 10),
            0,
          );
        }
      });

      setMediaActionHandler("seekforward", (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(
            audioRef.current.currentTime + (details.seekOffset || 10),
            audioRef.current.duration,
          );
        }
      });

      setMediaActionHandler("seekto", (details) => {
        if (audioRef.current && details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime;
        }
      });

      setMediaActionHandler("stop", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
        }
      });
    }

    return () => {
      if ("mediaSession" in navigator) {
        try {
          navigator.mediaSession.setActionHandler("play", null);
          navigator.mediaSession.setActionHandler("pause", null);
          navigator.mediaSession.setActionHandler("previoustrack", null);
          navigator.mediaSession.setActionHandler("nexttrack", null);
          navigator.mediaSession.setActionHandler("seekbackward", null);
          navigator.mediaSession.setActionHandler("seekforward", null);
          navigator.mediaSession.setActionHandler("seekto", null);
          navigator.mediaSession.setActionHandler("stop", null);
        } catch {
          // Ignore unsupported Media Session cleanup handlers.
        }
      }
    };
  }, [currentTrack, onPrevious, onNext, playlistLabel]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  useEffect(() => {
    let cancelled = false;

    const loadTrack = async () => {
      if (!currentTrack || !audioRef.current) return;
      const track = currentTrack;
      const trackId = String(track.id);

      if (
        promotedTrackIdRef.current === trackId &&
        preloadedTrackRef.current?.id === trackId &&
        preloadedTrackRef.current.ready
      ) {
        const oldActiveHls = hlsRef.current;
        hlsRef.current = standbyHlsRef.current;
        standbyHlsRef.current = oldActiveHls;
        preloadedTrackRef.current = null;
        promotedTrackIdRef.current = null;
        crossfadeStartedRef.current = false;
        if (crossfadeTimerRef.current !== null) {
          window.clearTimeout(crossfadeTimerRef.current);
          crossfadeTimerRef.current = null;
        }
        setCurrentTime(audioRef.current.currentTime);
        setDuration(audioRef.current.duration || track.duration || 0);
        setLoading(false);
        setIsPlaying(true);
        return;
      }

      hlsRef.current?.destroy();
      hlsRef.current = null;
      preloadedTrackRef.current = null;
      crossfadeStartedRef.current = false;

      setLoading(true);
      const shouldAutoPlay = track.remoteShouldPlay !== false;
      pendingRemoteSeekRef.current =
        typeof track.remoteStartPosition === "number"
          ? track.remoteStartPosition
          : null;

      try {
        let streamEntry = streamLookupRequestsRef.current.get(trackId);
        if (streamEntry && streamEntry.expiresAt > 0 && streamEntry.expiresAt <= Date.now()) {
          streamLookupRequestsRef.current.delete(trackId);
          streamEntry = undefined;
        }
        if (!streamEntry) {
          const streamRequest = fetch(
            `/api/stream?trackId=${encodeURIComponent(trackId)}`,
          ).then(async (response) => {
            const data = await response.json();
            if (!response.ok || !data.streamUrl) {
              throw new Error(data.error || "SoundCloud did not return a stream URL");
            }
            return data;
          });
          streamEntry = { promise: streamRequest, expiresAt: 0 };
          streamLookupRequestsRef.current.set(trackId, streamEntry);
          void streamRequest.then(
            () => {
              if (streamLookupRequestsRef.current.get(trackId) === streamEntry) {
                streamEntry!.expiresAt = Date.now() + 30_000;
              }
            },
            () => {
              if (streamLookupRequestsRef.current.get(trackId) === streamEntry) {
                streamLookupRequestsRef.current.delete(trackId);
              }
            },
          );
        }
        const streamData = await streamEntry.promise;
        if (cancelled || !audioRef.current) return;

        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(streamData.streamUrl);
          hls.attachMedia(audioRef.current);
          await new Promise<void>((resolve, reject) => {
            hls.once(Hls.Events.MANIFEST_PARSED, () => resolve());
            hls.once(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                const reason = typeof data.reason === "string" ? `: ${data.reason}` : "";
                reject(new Error(`${data.details || "HLS stream failed to load"}${reason}`));
              }
            });
          });
        } else if (
          audioRef.current.canPlayType("application/vnd.apple.mpegurl")
        ) {
          audioRef.current.src = streamData.streamUrl;
          audioRef.current.load();
        } else {
          throw new Error("This device cannot play SoundCloud HLS streams");
        }

        if (shouldAutoPlay) {
          try {
            await audioContextRef.current?.resume();
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  setIsPlaying(true);
                })
                .catch((error) => {
                  if (error?.name === "NotAllowedError") {
                    console.warn("Autoplay blocked for this device handoff.");
                    setIsPlaying(false);
                    return;
                  }
                  if (error?.name !== "AbortError") {
                    console.error("Play error:", error);
                  }
                });
            }
          } catch (error: any) {
            if (error?.name === "NotAllowedError") {
              console.warn("Autoplay blocked for this device handoff.");
              setIsPlaying(false);
            } else {
              throw error;
            }
          }
        } else {
          audioRef.current.pause();
        }
      } catch (error: any) {
        if (cancelled) return;
        if (error?.name === "NotAllowedError") {
          console.warn("Autoplay blocked while loading track.");
          setIsPlaying(false);
        } else {
          console.error("Load track error:", error);
          alert(
            `Failed to load track: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTrack();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.remoteShouldPlay, currentTrack?.remoteStartPosition]);

  useEffect(() => {
    if (
      !currentTrack ||
      !crossfadeEnabled ||
      !isPlaying ||
      !onNext ||
      (queueSource !== "playlist" && queueSource !== "search-related")
    ) return;
    const queueIndex = currentQueueIndex >= 0
      ? currentQueueIndex
      : queue.findIndex((item: any) => String(item?.id) === String(currentTrack.id));
    const nextTrack = isShuffle
      ? queue.filter((item: any) => String(item?.id) !== String(currentTrack.id))[Math.floor(Math.random() * Math.max(1, queue.length - 1))]
      : queueIndex >= 0 ? queue[queueIndex + 1] : null;
    if (!nextTrack?.id) return;
    const nextTrackId = String(nextTrack.id);
    if (preloadedTrackRef.current?.id === nextTrackId && preloadedTrackRef.current.ready) return;

    const standbyAudio = activeAudioSlot === 0 ? secondaryAudioRef.current : primaryAudioRef.current;
    if (!standbyAudio) return;
    let cancelled = false;
    standbyHlsRef.current?.destroy();
    standbyHlsRef.current = null;
    standbyAudio.pause();
    standbyAudio.removeAttribute("src");
    standbyAudio.load();
    preloadedTrackRef.current = null;

    const preloadNextTrack = async () => {
      try {
        let streamEntry = streamLookupRequestsRef.current.get(nextTrackId);
        if (streamEntry && streamEntry.expiresAt > 0 && streamEntry.expiresAt <= Date.now()) {
          streamLookupRequestsRef.current.delete(nextTrackId);
          streamEntry = undefined;
        }
        if (!streamEntry) {
          const streamRequest = fetch(`/api/stream?trackId=${encodeURIComponent(nextTrackId)}`).then(async (response) => {
            const data = await response.json();
            if (!response.ok || !data.streamUrl) {
              throw new Error(data.error || "Could not preload the next track.");
            }
            return data;
          });
          streamEntry = { promise: streamRequest, expiresAt: 0 };
          streamLookupRequestsRef.current.set(nextTrackId, streamEntry);
          void streamRequest.then(
            () => {
              if (streamLookupRequestsRef.current.get(nextTrackId) === streamEntry) {
                streamEntry!.expiresAt = Date.now() + 30_000;
              }
            },
            () => {
              if (streamLookupRequestsRef.current.get(nextTrackId) === streamEntry) {
                streamLookupRequestsRef.current.delete(nextTrackId);
              }
            },
          );
        }
        const streamData = await streamEntry.promise;
        if (cancelled) return;

        let standbyHls: Hls | null = null;
        if (Hls.isSupported()) {
          standbyHls = new Hls();
          standbyHlsRef.current = standbyHls;
          standbyHls.attachMedia(standbyAudio);
          standbyHls.loadSource(streamData.streamUrl);
          await new Promise<void>((resolve, reject) => {
            standbyHls!.once(Hls.Events.MANIFEST_PARSED, () => resolve());
            standbyHls!.once(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) reject(new Error(data.details || "Next track stream failed to load."));
            });
          });
          await new Promise<void>((resolve, reject) => {
            if (standbyAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
              resolve();
              return;
            }
            const timeout = window.setTimeout(() => reject(new Error("Next track did not buffer in time.")), 15000);
            standbyAudio.addEventListener("canplay", () => {
              window.clearTimeout(timeout);
              resolve();
            }, { once: true });
            standbyAudio.addEventListener("error", () => {
              window.clearTimeout(timeout);
              reject(new Error("Next track stream failed to buffer."));
            }, { once: true });
          });
        } else if (standbyAudio.canPlayType("application/vnd.apple.mpegurl")) {
          await new Promise<void>((resolve, reject) => {
            const timeout = window.setTimeout(() => reject(new Error("Next track did not buffer in time.")), 15000);
            const finish = () => {
              window.clearTimeout(timeout);
              resolve();
            };
            if (standbyAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
              finish();
              return;
            }
            standbyAudio.addEventListener("canplay", finish, { once: true });
            standbyAudio.addEventListener("error", () => reject(new Error("Next track stream failed to load.")), { once: true });
            standbyAudio.src = streamData.streamUrl;
            standbyAudio.load();
          });
        } else {
          throw new Error("This device cannot preload SoundCloud HLS streams.");
        }

        if (cancelled) {
          standbyHls?.destroy();
          return;
        }
        standbyAudio.currentTime = 0;
        standbyAudio.volume = audioRef.current?.volume ?? volume;
        const pipeline = audioPipelinesRef.current.get(standbyAudio);
        if (pipeline && audioContextRef.current) {
          pipeline.gain.gain.cancelScheduledValues(audioContextRef.current.currentTime);
          pipeline.gain.gain.setValueAtTime(0, audioContextRef.current.currentTime);
        }
        preloadedTrackRef.current = { id: nextTrackId, track: nextTrack, hls: standbyHls, ready: true };
      } catch (error) {
        if (!cancelled) console.warn("Could not preload next track for crossfade:", error);
      }
    };

    void preloadNextTrack();
    return () => {
      cancelled = true;
      if (promotedTrackIdRef.current === nextTrackId) return;
      if (crossfadeStartedRef.current) {
        crossfadeStartedRef.current = false;
        setCrossfadeArtwork(null);
        onCrossfadeVisualChange?.(null);
        if (crossfadeTimerRef.current !== null) {
          window.clearTimeout(crossfadeTimerRef.current);
          crossfadeTimerRef.current = null;
        }
        const activePipeline = audioRef.current
          ? audioPipelinesRef.current.get(audioRef.current)
          : null;
        const standbyPipeline = audioPipelinesRef.current.get(standbyAudio);
        if (audioContextRef.current) {
          const now = audioContextRef.current.currentTime;
          activePipeline?.gain.gain.setTargetAtTime(1, now, 0.04);
          standbyPipeline?.gain.gain.setTargetAtTime(0, now, 0.04);
        }
        standbyAudio.pause();
      }
      if (preloadedTrackRef.current?.id === nextTrackId) preloadedTrackRef.current = null;
      if (standbyHlsRef.current) {
        standbyHlsRef.current.destroy();
        standbyHlsRef.current = null;
      }
      standbyAudio.pause();
      standbyAudio.removeAttribute("src");
      standbyAudio.load();
    };
  }, [
    currentTrack?.id,
    crossfadeEnabled,
    isPlaying,
    queue,
    currentQueueIndex,
    activeAudioSlot,
    isShuffle,
  ]);

  useEffect(() => {
    if (!currentTrack?.id) return;
    if (currentTrack?.isLiked) {
      setIsLiked(true);
      return;
    }

    setIsLiked(false);
    checkIfLiked(currentTrack.id);
  }, [currentTrack?.id, currentTrack?.isLiked]);

  useEffect(() => {
    if (!currentTrack?.id) return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ trackId?: number; isLiked?: boolean }>).detail;
      if (!detail || detail.trackId !== currentTrack.id) return;
      setIsLiked(Boolean(detail.isLiked));
    };

    window.addEventListener("likes-updated", handler as EventListener);
    return () =>
      window.removeEventListener("likes-updated", handler as EventListener);
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack?.id) {
      setPlaylistsWithTrack([]);
      setIsInAnyPlaylist(false);
      return;
    }
    if (!isPlaylistMenuOpen && !isMobilePlaylistSheetOpen) return;

    setPlaylistsWithTrack([]);
    setIsInAnyPlaylist(false);
    checkPlaylistsForTrack(currentTrack.id);
  }, [currentTrack?.id, isPlaylistMenuOpen, isMobilePlaylistSheetOpen]);

  useEffect(() => {
    if (!isVolumePopoverOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        volumePopoverRef.current &&
        !volumePopoverRef.current.contains(event.target as Node)
      ) {
        setIsVolumePopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isVolumePopoverOpen]);

  useEffect(() => {
    if (!artworkContextMenu && !artworkContextPlaylistMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        artworkContextMenuRef.current &&
        !artworkContextMenuRef.current.contains(event.target as Node)
      ) {
        setArtworkContextMenu(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setArtworkContextMenu(null);
        setArtworkContextPlaylistMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [artworkContextMenu, artworkContextPlaylistMenu]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (window.innerWidth > 900) {
        setIsMobilePlayerOpen(false);
        setIsMobilePlaylistSheetOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const checkIfLiked = async (trackId: number | string) => {
    if (!trackId) return;
    try {
      const response = await fetch(`/api/check-like?trackId=${trackId}`);
      const data = await response.json();
      setIsLiked(data.isLiked);
    } catch (error) {
      console.error("Failed to check like status:", error);
      setIsLiked(false);
    }
  };

  const emitLikeUpdate = (
    trackId: number | string,
    nextLiked: boolean,
    track?: any,
  ) => {
    try {
      window.dispatchEvent(
        new CustomEvent("likes-updated", {
          detail: { trackId: Number(trackId), isLiked: nextLiked, track },
        }),
      );
    } catch (error) {
      console.error("Failed to dispatch likes-updated:", error);
    }
  };
  const emitLikedSongsToast = (nextLiked: boolean, track?: any) => {
    try {
      window.dispatchEvent(
        new CustomEvent("show-toast", {
          detail: {
            message: nextLiked
              ? "Added to Liked Songs"
              : "Removed from Liked Songs",
            artwork: getTrackArtwork(track),
          },
        }),
      );
    } catch (error) {
      console.error("Failed to dispatch liked songs toast:", error);
    }
  };

  const closeArtworkMenus = () => {
    setArtworkContextMenu(null);
    setArtworkContextPlaylistMenu(null);
  };

  const handleArtworkContextMenu = (event: ReactMouseEvent) => {
    event.preventDefault();
    setArtworkContextPlaylistMenu(null);
    setArtworkContextMenu({ x: event.clientX, y: event.clientY });
  };

  const shareCurrentTrack = async () => {
    const shareUrl =
      currentTrack?.permalink_url ||
      (typeof window !== "undefined"
        ? `${window.location.origin}/track/${currentTrack?.id}`
        : "");

    if (!shareUrl) return;

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: currentTrack?.title || "Track",
          text: currentTrack?.user?.username || undefined,
          url: shareUrl,
        });
        return;
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Failed to share track:", error);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      console.error("Failed to copy track URL:", error);
    }
  };

  const toggleLike = async () => {
    if (!currentTrack?.id) {
      alert("No track selected");
      return;
    }

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    emitLikeUpdate(currentTrack.id, nextLiked, currentTrack);

    try {
      const response = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: currentTrack.id,
          like: nextLiked,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update like");
      }

      const confirmedResponse = await fetch(`/api/check-like?trackId=${currentTrack.id}`);
      const confirmedData = await confirmedResponse.json();
      const confirmedLiked = Boolean(confirmedData?.isLiked);
      setIsLiked(confirmedLiked);
      emitLikeUpdate(currentTrack.id, confirmedLiked, currentTrack);
      emitLikedSongsToast(confirmedLiked, currentTrack);
    } catch (error) {
      console.error("Like failed:", error);
      setIsLiked(!nextLiked);
      emitLikeUpdate(currentTrack.id, !nextLiked, currentTrack);
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const checkPlaylistsForTrack = async (trackId: number | string) => {
    if (!trackId) return;
    const requestId = ++playlistMembershipRequestRef.current;
    try {
      const response = await fetch(
        `/api/check-track-in-playlists?trackId=${trackId}`,
      );
      const data = await response.json();
      if (playlistMembershipRequestRef.current !== requestId) return;
      setPlaylistsWithTrack(
        data.playlistsWithTrack?.map((p: any) => p.id) || [],
      );
      setIsInAnyPlaylist(data.isInAnyPlaylist);
    } catch (error) {
      if (playlistMembershipRequestRef.current !== requestId) return;
      console.error("Failed to check playlists:", error);
      setIsInAnyPlaylist(false);
      setPlaylistsWithTrack([]);
    }
  };

  const describeDevice = (device: any) => {
    if (!device) return "Unknown device";
    if (device.deviceId === deviceId) {
      return isMobileDevice ? "This Device" : "This Computer";
    }
    if (device.kind === "mobile") {
      if (device.platform === "ios") return "Mobile (iOS)";
      if (device.platform === "android") return "Mobile (Android)";
      return "Mobile";
    }
    if (device.kind === "desktop") {
      return "Desktop";
    }
    return "Web Player";
  };

  const claimPlaybackOutput = (targetDeviceId: string) => {
    if (!socket || !syncRoomId || !targetDeviceId) return;
    const position = audioRef.current?.currentTime || currentTime || 0;
    const shouldPlay = Boolean(isPlaying || playbackOwnerRef.current === deviceId);
    const targetTrack = currentTrackRef.current || currentTrack;

    sendRemoteCommand({
      type: "claim-output",
      deviceId: targetDeviceId,
      track: targetTrack,
      position,
      shouldPlay,
      sourceDeviceId: deviceId,
      queueData: queue,
      currentQueueIndex,
      queueSource,
    });

    setPlaybackOwnerDeviceId(targetDeviceId);

    if (targetDeviceId === deviceId) {
      suppressRemoteEchoUntilRef.current = Date.now() + 1500;
      if (targetTrack) {
        window.dispatchEvent(
          new CustomEvent("remote-load-track", {
            detail: {
              track: targetTrack,
              position,
              shouldPlay,
            },
          }),
        );
      } else if (audioRef.current) {
        audioRef.current.currentTime = position;
        if (shouldPlay) {
          void audioRef.current.play().catch((error) => {
            if (error?.name === "NotAllowedError") {
              console.warn("Tap play on this device to finish switching output.");
              setIsPlaying(false);
              return;
            }
            console.error("Claim playback error:", error);
          });
        }
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }

    setIsDeviceMenuOpen(false);
    setIsMobileDeviceSheetOpen(false);
  };

  const sendRemoteCommand = (command: any) => {
    if (!socket || !syncRoomId) return false;
    socket.emit("remote-command", {
      userId: syncRoomId,
      command,
    });
    return true;
  };

  const togglePlayPause = () => {
    const passiveOwner =
      playbackOwnerRef.current && playbackOwnerRef.current !== deviceId;

    if (passiveOwner) {
      sendRemoteCommand(isPlaying ? "pause" : "play");
      return;
    }

    if (!audioRef.current) return;
    setPlaybackOwnerDeviceId(deviceId);
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      void audioContextRef.current?.resume();
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const emitPlaybackState = (force = false) => {
    if (!socket || !currentTrack || !syncRoomId) return;
    const now = Date.now();
    const passiveOwner =
      playbackOwnerRef.current && playbackOwnerRef.current !== deviceId;
    if (passiveOwner || now < suppressRemoteEchoUntilRef.current) return;
    const currentPosition = audioRef.current?.currentTime || 0;
    const roundedPosition = Math.floor(currentPosition);
    const nextSnapshot = {
      trackId: currentTrack.id ?? null,
      playing: Boolean(isPlaying),
      roundedPosition,
    };

    if (
      !force &&
      lastEmittedPlaybackRef.current &&
      lastEmittedPlaybackRef.current.trackId === nextSnapshot.trackId &&
      lastEmittedPlaybackRef.current.playing === nextSnapshot.playing &&
      lastEmittedPlaybackRef.current.roundedPosition ===
        nextSnapshot.roundedPosition
    ) {
      return;
    }

    if (!force && now - lastRemoteSyncRef.current < 900) return;
    lastRemoteSyncRef.current = now;
    lastEmittedPlaybackRef.current = nextSnapshot;
    setPlaybackOwnerDeviceId(deviceId);

    console.log("[player-sync] emit playback-update", {
      roomId: syncRoomId,
      deviceId,
      trackId: currentTrack.id,
      playing: isPlaying,
      force,
      position: Math.round(currentPosition),
    });

    socket.emit("playback-update", {
      userId: syncRoomId,
      deviceId,
      state: {
        trackId: currentTrack.id,
        track: currentTrack.title,
        artist: currentTrack.user?.username || "Unknown",
        artwork: getTrackArtwork(currentTrack),
        trackData: currentTrack,
        position: currentPosition,
        duration: audioRef.current?.duration || currentTrack.duration || 0,
        playing: isPlaying,
        queueData: queue,
        currentQueueIndex,
        queueSource,
      },
    });
  };

  useEffect(() => {
    if (!socket || !currentTrack) return;
    emitPlaybackState(true);
  }, [isPlaying, currentTrack?.id, socket, syncRoomId, currentTrack]);

  useEffect(() => {
    try {
      window.dispatchEvent(
        new CustomEvent("player-state", {
          detail: {
            trackId: currentTrack?.id || null,
            isPlaying,
            track: currentTrack || null,
          },
        }),
      );
    } catch (error) {
      console.error("Failed to dispatch player-state:", error);
    }
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!socket || !currentTrack || !syncRoomId) return;

    const handleConnect = () => {
      emitPlaybackState(true);
    };

    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, currentTrack, syncRoomId, isPlaying]);

  useEffect(() => {
    if (!socket || !currentTrack || !isPlaying) return;
    const interval = window.setInterval(() => {
      emitPlaybackState();
    }, 2500);
    return () => window.clearInterval(interval);
  }, [socket, currentTrack?.id, isPlaying, syncRoomId]);

  useEffect(() => {
    const handleExternalToggle = () => {
      togglePlayPause();
    };

    const handleExternalNext = () => {
      handleNext();
    };

    const handleExternalPrev = () => {
      handlePrevious();
    };

    window.addEventListener("player-toggle", handleExternalToggle);
    window.addEventListener("player-next", handleExternalNext);
    window.addEventListener("player-prev", handleExternalPrev);
    return () => {
      window.removeEventListener("player-toggle", handleExternalToggle);
      window.removeEventListener("player-next", handleExternalNext);
      window.removeEventListener("player-prev", handleExternalPrev);
    };
  }, [isPlaying]);

  const beginCrossfade = () => {
    const next = preloadedTrackRef.current;
    const currentAudio = audioRef.current;
    const nextAudio = activeAudioSlot === 0 ? secondaryAudioRef.current : primaryAudioRef.current;
    const context = audioContextRef.current;
    if (
      !crossfadeEnabled ||
      !isPlaying ||
      !onNext ||
      crossfadeStartedRef.current ||
      !next?.ready ||
      !currentAudio ||
      !nextAudio ||
      !context
    ) return;

    const currentPipeline = audioPipelinesRef.current.get(currentAudio);
    const nextPipeline = audioPipelinesRef.current.get(nextAudio);
    if (!currentPipeline || !nextPipeline) return;

    crossfadeStartedRef.current = true;
    const remaining = Math.max(0.1, currentAudio.duration - currentAudio.currentTime);
    const fadeSeconds = Math.max(
      0.1,
      Math.min(crossfadeDuration, remaining, (currentAudio.duration || crossfadeDuration * 2) / 2),
    );
    const nextArtwork = getTrackArtwork(next.track);
    setCrossfadeArtwork(nextArtwork);
    onCrossfadeVisualChange?.(nextArtwork, fadeSeconds);
    const startTime = context.currentTime;
    const endTime = startTime + fadeSeconds;
    const currentGain = currentPipeline.gain.gain;
    const nextGain = nextPipeline.gain.gain;
    currentGain.cancelScheduledValues(startTime);
    nextGain.cancelScheduledValues(startTime);
    currentGain.setValueAtTime(1, startTime);
    nextGain.setValueAtTime(0, startTime);
    const fadeSteps = 64;
    const fadeOutCurve = new Float32Array(fadeSteps);
    const fadeInCurve = new Float32Array(fadeSteps);
    for (let index = 0; index < fadeSteps; index += 1) {
      const progress = index / (fadeSteps - 1);
      fadeOutCurve[index] = Math.cos(progress * Math.PI / 2);
      fadeInCurve[index] = Math.sin(progress * Math.PI / 2);
    }
    currentGain.setValueCurveAtTime(fadeOutCurve, startTime, fadeSeconds);
    nextGain.setValueCurveAtTime(fadeInCurve, startTime, fadeSeconds);
    nextAudio.volume = currentAudio.volume;

    void context.resume().then(() => nextAudio.play()).catch((error) => {
      console.warn("Crossfade could not start the next track:", error);
      setCrossfadeArtwork(null);
      onCrossfadeVisualChange?.(null);
      if (crossfadeTimerRef.current !== null) {
        window.clearTimeout(crossfadeTimerRef.current);
        crossfadeTimerRef.current = null;
      }
      currentGain.cancelScheduledValues(context.currentTime);
      currentGain.setTargetAtTime(1, context.currentTime, 0.04);
      nextGain.cancelScheduledValues(context.currentTime);
      nextGain.setTargetAtTime(0, context.currentTime, 0.04);
      crossfadeStartedRef.current = false;
    });

    crossfadeTimerRef.current = window.setTimeout(() => {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      promotedTrackIdRef.current = next.id;
      setActiveAudioSlot(activeAudioSlot === 0 ? 1 : 0);
      if (isShuffle) onCrossfadeNext?.(next.id);
      else onNext();
      setCrossfadeArtwork(null);
      onCrossfadeVisualChange?.(null);
      crossfadeTimerRef.current = null;
    }, fadeSeconds * 1000);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
      emitPlaybackState();

      const remaining = audioRef.current.duration - audioRef.current.currentTime;
      if (remaining > 0 && remaining <= crossfadeDuration) beginCrossfade();

      if (
        "mediaSession" in navigator &&
        !isNaN(audioRef.current.duration) &&
        audioRef.current.duration > 0
      ) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audioRef.current.duration,
            playbackRate: audioRef.current.playbackRate,
            position: audioRef.current.currentTime,
          });
        } catch (error) {
          console.warn("Failed to set position state:", error);
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && pendingRemoteSeekRef.current !== null) {
      audioRef.current.currentTime = pendingRemoteSeekRef.current;
      pendingRemoteSeekRef.current = null;
    }
    handleTimeUpdate();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (primaryAudioRef.current) primaryAudioRef.current.volume = newVolume;
    if (secondaryAudioRef.current) secondaryAudioRef.current.volume = newVolume;
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        primaryAudioRef.current && (primaryAudioRef.current.volume = volume);
        secondaryAudioRef.current && (secondaryAudioRef.current.volume = volume);
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        primaryAudioRef.current && (primaryAudioRef.current.volume = 0);
        secondaryAudioRef.current && (secondaryAudioRef.current.volume = 0);
        setIsMuted(true);
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleCurrentArtistFollow = async () => {
    const artistId = currentTrack?.user?.id;
    if (!artistId || checkingCurrentArtistFollow) return;

    setCheckingCurrentArtistFollow(true);
    try {
      const response = await fetch(
        isFollowingCurrentArtist ? "/api/unfollow" : "/api/follow",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: artistId }),
        },
      );

      if (response.ok) {
        setIsFollowingCurrentArtist((prev) => !prev);
      }
    } catch {
      // Ignore follow toggle failures here; the button state will stay as-is.
    } finally {
      setCheckingCurrentArtistFollow(false);
    }
  };

  const renderTrackBio = (bio: string) => {
    if (!bio) return null;

    return bio.split(/(@\w+)/g).map((part, index) => {
      if (!part.startsWith("@")) {
        return <span key={`${part}-${index}`}>{part}</span>;
      }

      return (
        <span key={`${part}-${index}`} style={{ color: "#ff5500" }}>
          {part}
        </span>
      );
    });
  };

  const handleQueueItemSelect = (track: any, kind: "queue" | "history") => {
    if (!track) return;

    const passiveOwner =
      playbackOwnerRef.current && playbackOwnerRef.current !== deviceId;
    if (passiveOwner) {
      const commandSource =
        kind === "history" ? "search-related" : queueSource === "playlist" ? "playlist" : "search-related";
      const commandIndex =
        kind === "history"
          ? listeningHistory.findIndex((item) => item?.id === track.id)
          : queueItems.findIndex((item) => item?.id === track.id);
      const commandQueue =
        kind === "history"
          ? listeningHistory
          : commandIndex > -1
            ? queueItems.slice(commandIndex)
            : queueItems;

      sendRemoteCommand({
        type: "load-track",
        track,
        position: 0,
        shouldPlay: true,
        queueData: commandQueue,
        currentQueueIndex: 0,
        queueSource: commandSource,
      });
      return;
    }

    if (!onQueueSelect) return;
    if (kind === "history") {
      onQueueSelect(track, "search-related", listeningHistory);
      return;
    }

    const source =
      queueSource === "playlist" ? "playlist" : "search-related";
    const selectedIndex = queueItems.findIndex((item) => item?.id === track.id);
    const reorderedQueue =
      selectedIndex > -1
        ? queueItems.slice(selectedIndex)
        : queueItems;
    onQueueSelect(track, source, reorderedQueue);
  };

  const handleTrackEnd = () => {
    if (crossfadeStartedRef.current) return;
    setIsPlaying(false);
    if (onTrackEnd) onTrackEnd();
  };

  const cancelCrossfade = () => {
    if (!crossfadeStartedRef.current) return;
    crossfadeStartedRef.current = false;
    setCrossfadeArtwork(null);
    onCrossfadeVisualChange?.(null);
    if (crossfadeTimerRef.current !== null) {
      window.clearTimeout(crossfadeTimerRef.current);
      crossfadeTimerRef.current = null;
    }
    const activeAudio = audioRef.current;
    const standbyAudio = activeAudioSlot === 0 ? secondaryAudioRef.current : primaryAudioRef.current;
    const activePipeline = activeAudio ? audioPipelinesRef.current.get(activeAudio) : null;
    const standbyPipeline = standbyAudio ? audioPipelinesRef.current.get(standbyAudio) : null;
    if (audioContextRef.current) {
      const now = audioContextRef.current.currentTime;
      activePipeline?.gain.gain.setTargetAtTime(1, now, 0.04);
      standbyPipeline?.gain.gain.setTargetAtTime(0, now, 0.04);
    }
    standbyAudio?.pause();
  };

  const handlePrevious = () => {
    const passiveOwner =
      playbackOwnerRef.current && playbackOwnerRef.current !== deviceId;
    if (passiveOwner) {
      sendRemoteCommand("prev");
      return;
    }

    cancelCrossfade();

    if (!audioRef.current) {
      onPrevious?.();
      return;
    }

    const now = Date.now();
    const timeSinceLastClick = now - lastBackClickRef.current;
    const currentTimeValue = audioRef.current.currentTime;

    if (currentTimeValue < 2 || timeSinceLastClick < 2000) {
      lastBackClickRef.current = 0;
      onPrevious?.();
    } else {
      lastBackClickRef.current = now;
      audioRef.current.currentTime = 0;
    }
  };

  const handleNext = () => {
    const passiveOwner =
      playbackOwnerRef.current && playbackOwnerRef.current !== deviceId;
    if (passiveOwner) {
      sendRemoteCommand("next");
      return;
    }

    cancelCrossfade();
    onNext?.();
  };

  const openMobilePlayer = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 900) {
      setMobileSheetPage("player");
      setIsMobilePlayerOpen(true);
    }
  };

  const closeMobilePlayer = () => {
    setIsMobilePlayerOpen(false);
    setIsMobilePlaylistSheetOpen(false);
    setMobileSheetPage("player");
  };

  const handleMobileSheetTouchStart = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    mobileSheetTouchStartRef.current = event.touches[0]?.clientY ?? null;
    mobileSheetTouchCurrentRef.current = mobileSheetTouchStartRef.current;
  };

  const handleMobileSheetTouchMove = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    mobileSheetTouchCurrentRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleMobileSheetTouchEnd = () => {
    if (
      mobileSheetTouchStartRef.current !== null &&
      mobileSheetTouchCurrentRef.current !== null
    ) {
      const deltaY =
        mobileSheetTouchCurrentRef.current - mobileSheetTouchStartRef.current;

      if (deltaY < -90 && mobileSheetPage === "player") {
        setMobileSheetPage("details");
      } else if (deltaY > 90) {
        if (mobileSheetPage === "details") {
          if ((mobileTrackPageRef.current?.scrollTop || 0) <= 0) {
            setMobileSheetPage("player");
          }
        } else {
          closeMobilePlayer();
        }
      }
    }

    mobileSheetTouchStartRef.current = null;
    mobileSheetTouchCurrentRef.current = null;
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <>
      <div className="player-bar">
      <audio
        ref={primaryAudioRef}
        preload="auto"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnd}
      />
      <audio
        ref={secondaryAudioRef}
        preload="auto"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnd}
      />
      <div className="player-container player-desktop-shell" style={playerStyle}>
        <div className="player-content">
          <div className="player-left">
            <div
              className="player-artwork-wrapper"
              style={{
                position: "relative",
                display: "inline-block",
                "--crossfade-duration": `${crossfadeDuration}s`,
              } as CSSProperties}
            >
              <a
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  onTrackOpen?.(currentTrack);
                }}
                onContextMenu={handleArtworkContextMenu}
              >
                <img
                  src={getTrackArtwork(currentTrack)}
                  alt={currentTrack.title}
                  className="player-artwork clickable"
                  style={{ cursor: "pointer" }}
                />
                {crossfadeArtwork && (
                  <img
                    src={crossfadeArtwork}
                    alt=""
                    aria-hidden="true"
                    className="player-artwork player-artwork-crossfade"
                  />
                )}
              </a>
            </div>
            <div className="player-info-container">
              <div className="player-info">
                <div className="player-artist-row">
                  {canOpenArtist ? (
                    <button
                      type="button"
                      className="player-link player-artist"
                      onClick={() => onArtistClick?.(currentTrack.user)}
                    >
                      {nowPlayingArtist?.username || "Unknown"}
                    </button>
                  ) : (
                    <span className="player-artist">
                      {currentTrack.user?.username || "Unknown"}
                    </span>
                  )}
                  {playlistLabel &&
                    (canOpenPlaylist ? (
                      <button
                        type="button"
                        className="player-link player-playlist-link"
                        onClick={() =>
                          onPlaylistClick?.(playlistId, playlistLabel)
                        }
                        aria-label={`Open playlist ${playlistLabel}`}
                      >
                        {playlistLabel}
                      </button>
                    ) : (
                      <span className="player-playlist-link">
                        {playlistLabel}
                      </span>
                    ))}
                </div>
                <div className="player-title">
                  <a
                    href={`/track/${currentTrack.id}`}
                    className="player-title-link"
                    style={{
                      color: "#ff5500",
                      textDecoration: "underline",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      onTrackOpen?.(currentTrack);
                    }}
                  >
                    {currentTrack.title}
                  </a>
                </div>
              </div>
              <div className="player-actions">
                <button
                  className={`player-like ${isLiked ? "liked" : ""}`}
                  onClick={toggleLike}
                  title={isLiked ? "Unlike" : "Like"}
                >
                  <img
                    src="https://img.icons8.com/parakeet-line/48/like.png"
                    alt={isLiked ? "Unlike" : "Like"}
                    className="player-like-icon"
                  />
                </button>
                <button
                  className={`player-add-playlist ${isInAnyPlaylist ? "in-playlist" : ""}`}
                  onClick={() => setIsPlaylistMenuOpen(!isPlaylistMenuOpen)}
                  title={
                    isInAnyPlaylist ? "Added to playlist" : "Add to playlist"
                  }
                >
                  <img
                    src={
                      isInAnyPlaylist
                        ? "https://img.icons8.com/parakeet-line/50/checked.png"
                        : "https://img.icons8.com/parakeet-line/48/add.png"
                    }
                    alt="Add to playlist"
                    className="player-add-playlist-icon"
                  />
                </button>
                <button
                  type="button"
                  className={`player-device-btn ${isDeviceMenuOpen ? "open" : ""}`}
                  onClick={() => setIsDeviceMenuOpen((open) => !open)}
                  title="Choose listening device"
                  aria-label="Choose listening device"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="13" height="10" rx="2" />
                    <path d="M8 19h12a1 1 0 0 0 1-1v-7" />
                    <path d="M8 19l-2 2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`player-queue-btn ${isQueuePanelOpen ? "open" : ""}`}
                  onClick={() => {
                    setActiveSidebarTab("queue");
                    setIsQueuePanelOpen((open) => !open);
                  }}
                  title="Queue"
                  aria-label="Open queue"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="14" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              className={`player-shuffle ${isShuffle ? "active" : ""}`}
              onClick={() => onShuffleChange?.(!isShuffle)}
              title={isShuffle ? "Shuffle Off" : "Shuffle On"}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
            </button>
            <PlaylistMenu
              trackId={currentTrack.id}
              isOpen={isPlaylistMenuOpen}
              onClose={() => setIsPlaylistMenuOpen(false)}
              playlistsWithTrack={playlistsWithTrack}
            />
            {artworkContextMenu ? (
              <div
                ref={artworkContextMenuRef}
                className="context-menu"
                style={{ top: artworkContextMenu.y, left: artworkContextMenu.x }}
              >
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={async () => {
                    await shareCurrentTrack();
                    closeArtworkMenus();
                  }}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    onTrackOpen?.(currentTrack);
                    closeArtworkMenus();
                  }}
                >
                  Go to Track
                </button>
                <button
                  type="button"
                  className="context-menu-item"
                  onClick={() => {
                    setArtworkContextPlaylistMenu(artworkContextMenu);
                    setArtworkContextMenu(null);
                  }}
                >
                  Add to Playlist...
                </button>
              </div>
            ) : null}
            <div
              className="context-playlist-menu"
              style={{
                top: artworkContextPlaylistMenu?.y,
                left: artworkContextPlaylistMenu?.x,
                visibility: artworkContextPlaylistMenu ? "visible" : "hidden",
                pointerEvents: artworkContextPlaylistMenu ? "auto" : "none",
              }}
            >
              <PlaylistMenu
                trackId={currentTrack.id}
                isOpen={!!artworkContextPlaylistMenu}
                onClose={() => setArtworkContextPlaylistMenu(null)}
                playlistsWithTrack={playlistsWithTrack}
              />
            </div>
            {isDeviceMenuOpen ? (
              <div className="player-device-menu">
                <div className="player-device-menu-title">Listen On</div>
                <div className="player-device-menu-list">
                  {availableDevices.map((device) => {
                    const isActive = device?.deviceId === playbackOwnerDeviceId;
                    const isCurrentDevice = device?.deviceId === deviceId;
                    return (
                      <button
                        key={device?.socketId || device?.deviceId}
                        type="button"
                        className={`player-device-menu-item ${isActive ? "active" : ""}`}
                        onClick={() => claimPlaybackOutput(device.deviceId)}
                      >
                        <span>{describeDevice(device)}</span>
                        <span className="player-device-menu-meta">
                          {isActive ? (isCurrentDevice ? "Listening here" : "Listening there") : isCurrentDevice ? "This device" : "Available"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="player-center">
            <div className="player-controls">
              <button
                className="player-btn"
                onClick={handlePrevious}
                title="Previous"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <line
                    x1="5"
                    y1="4"
                    x2="5"
                    y2="20"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <polygon points="19 3 19 21 5 12 19 3" />
                </svg>
              </button>
              <button
                className="player-btn player-btn-play"
                onClick={togglePlayPause}
                disabled={loading}
                aria-label={loading ? "Loading track" : isPlaying ? "Pause" : "Play"}
              >
                {loading ? (
                  <svg
                    className="player-loading-spinner"
                    viewBox="0 0 24 24"
                    role="img"
                    aria-label="Loading"
                  >
                    <circle className="player-loading-spinner-track" cx="12" cy="12" r="9" />
                    <path className="player-loading-spinner-head" d="M21 12a9 9 0 0 0-9-9" />
                  </svg>
                ) : isPlaying ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>
              <button className="player-btn" onClick={handleNext} title="Next">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="5 3 5 21 19 12 5 3" />
                  <line
                    x1="19"
                    y1="4"
                    x2="19"
                    y2="20"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>
            <div className="player-progress">
              <span className="player-time">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="player-seek"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
              />
              <span className="player-time">{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-right">
            <div
              className={`player-volume-wrap ${isVolumePopoverOpen ? "open" : ""}`}
              ref={volumePopoverRef}
            >
              <button
                className="player-volume-btn"
                onClick={() => setIsVolumePopoverOpen((open) => !open)}
                title="Volume"
                aria-label="Volume"
              >
                {isMuted || volume === 0 ? (
                  <img
                    src="https://img.icons8.com/parakeet-line/48/mute.png"
                    alt="Mute"
                    className="player-volume-icon"
                  />
                ) : volume < 0.33 ? (
                  <img
                    src="https://img.icons8.com/parakeet-line/48/low-volume.png"
                    alt="Low volume"
                    className="player-volume-icon"
                  />
                ) : volume < 0.66 ? (
                  <img
                    src="https://img.icons8.com/parakeet-line/48/medium-volume.png"
                    alt="Medium volume"
                    className="player-volume-icon"
                  />
                ) : (
                  <img
                    src="https://img.icons8.com/parakeet-line/48/high-volume.png"
                    alt="High volume"
                    className="player-volume-icon"
                  />
                )}
              </button>
              <input
                type="range"
                className="player-volume-slider"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
              />
              <div className="player-volume-popover">
                <button
                  type="button"
                  className="player-volume-mute"
                  onClick={toggleMute}
                >
                  {isMuted || volume === 0 ? "Unmute" : "Mute"}
                </button>
                <input
                  type="range"
                  className="player-volume-slider-vertical"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      <aside
        className={`player-queue-panel ${isQueuePanelOpen ? "open" : ""} ${isQueueResizing ? "resizing" : ""}`}
        style={{ width: `${queuePanelWidth}px` }}
      >
        <div
          className="player-queue-panel-resizer"
          onPointerDown={handleQueueResizeStart}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize queue panel"
        />
        <div className="player-queue-panel-header">
          <div className="player-sidebar-tabs" role="tablist" aria-label="Player sidebar tabs">
            <button
              type="button"
              className={`player-sidebar-tab ${activeSidebarTab === "queue" ? "active" : ""}`}
              onClick={() => setActiveSidebarTab("queue")}
              role="tab"
              aria-selected={activeSidebarTab === "queue"}
            >
              Queue
            </button>
            <button
              type="button"
              className={`player-sidebar-tab ${activeSidebarTab === "friends" ? "active" : ""}`}
              onClick={() => setActiveSidebarTab("friends")}
              role="tab"
              aria-selected={activeSidebarTab === "friends"}
            >
              Friends
            </button>
            <button
              type="button"
              className={`player-sidebar-tab ${activeSidebarTab === "now-playing" ? "active" : ""}`}
              onClick={() => setActiveSidebarTab("now-playing")}
              role="tab"
              aria-selected={activeSidebarTab === "now-playing"}
            >
              Now Playing
            </button>
          </div>
        </div>
        {activeSidebarTab === "queue" ? (
          <div
            ref={queueListRef}
            className="player-queue-list"
            onScroll={handleQueueListScroll}
          >
            {historyItems.length ? (
              <section className="player-queue-section">
                <div className="player-queue-section-label">Listening History</div>
                {historyItems.map((track, index) => (
                  <button
                    key={`history-${track.id ?? "unknown"}-${track.played_at || track.playedAt || index}-${index}`}
                    type="button"
                    className="player-queue-item player-queue-item-history"
                    onClick={() => handleQueueItemSelect(track, "history")}
                  >
                    <img
                      src={getTrackArtwork(track)}
                      alt={track.title}
                      className="player-queue-item-cover"
                    />
                    <div className="player-queue-item-copy">
                      <div className="player-queue-item-title">{track.title}</div>
                      <div className="player-queue-item-artist">
                        {track.user?.username || "Unknown"}
                      </div>
                    </div>
                  </button>
                ))}
                {historyLoadingMore ? (
                  <div className="player-queue-empty">Loading older history...</div>
                ) : null}
              </section>
            ) : null}

            <section ref={queueNowPlayingSectionRef} className="player-queue-section">
              <div className="player-queue-section-label">Now Playing</div>
              {currentQueueTrack ? (
                <div
                  ref={queueCurrentTrackRef}
                  className="player-queue-item player-queue-item-current"
                >
                  <img
                    src={getTrackArtwork(currentQueueTrack)}
                    alt={currentQueueTrack.title}
                    className="player-queue-item-cover"
                  />
                  <div className="player-queue-item-copy">
                    <div className="player-queue-item-title">
                      {currentQueueTrack.title}
                    </div>
                    <div className="player-queue-item-artist">
                      {currentQueueTrack.user?.username || "Unknown"}
                    </div>
                  </div>
                  <div className="player-queue-item-badge">Playing</div>
                </div>
              ) : (
                <div className="track-page-placeholder track-page-placeholder-block">
                  Nothing is playing yet.
                </div>
              )}

              {upcomingQueueTracks.length ? (
                <>
                  <div className="player-queue-section-label">Up Next</div>
                  {upcomingQueueTracks.map((track, index) => (
                    <button
                      key={`queue-${track.id || index}`}
                      type="button"
                      className="player-queue-item"
                      onClick={() => handleQueueItemSelect(track, "queue")}
                    >
                      <img
                        src={getTrackArtwork(track)}
                        alt={track.title}
                        className="player-queue-item-cover"
                      />
                      <div className="player-queue-item-copy">
                        <div className="player-queue-item-title">{track.title}</div>
                        <div className="player-queue-item-artist">
                          {track.user?.username || "Unknown"}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="player-queue-empty">No upcoming tracks.</div>
              )}
            </section>
          </div>
        ) : activeSidebarTab === "friends" ? (
          <div className="player-queue-list player-sidebar-friends">
            <section className="player-friends-controls">
              <button
                type="button"
                className={`player-friends-privacy-btn ${friendPrivacy.appearOffline ? "active" : ""}`}
                onClick={() => void toggleAppearOffline()}
              >
                {friendPrivacy.appearOffline ? "Appearing Offline" : "Appear Offline"}
              </button>
              {friendsLoading ? (
                <div className="player-friends-meta">Refreshing friends...</div>
              ) : outgoingFriendRequests.length ? (
                <div className="player-friends-meta">
                  {outgoingFriendRequests.length} pending request{outgoingFriendRequests.length === 1 ? "" : "s"}
                </div>
              ) : null}
            </section>
            <section className="player-friend-discovery-card">
              <div className="player-queue-section-label">Find Friends</div>
              <div className="player-friend-code-row">
                <div className="player-friend-code-copy">
                  <div className="player-friend-code-label">Your friend code</div>
                  <div className="player-friend-code-value">
                    {friendCode || "Loading..."}
                  </div>
                </div>
                <button
                  type="button"
                  className="player-friend-code-btn"
                  onClick={() => void handleCopyFriendCode()}
                  disabled={!friendCode}
                >
                  {friendCodeCopied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="player-friend-search-row">
                <input
                  type="text"
                  className="player-friend-search-input"
                  value={friendSearchQuery}
                  onChange={(event) => setFriendSearchQuery(event.target.value)}
                  placeholder="Search SoundCloud name or friend code"
                />
              </div>
              {friendSearchLoading ? (
                <div className="player-friends-meta">Searching...</div>
              ) : friendSearchError ? (
                <div className="player-friends-meta">{friendSearchError}</div>
              ) : null}
              {friendSearchResults.length ? (
                <div className="player-friend-search-results">
                  {friendSearchResults.map((result) => (
                    <div
                      key={`friend-search-${result.userId}`}
                      className="player-friend-request-card player-friend-search-card"
                    >
                      <div className="player-friend-card-top">
                        <img
                          src={result.avatarUrl || "/placeholder.png"}
                          alt={result.name}
                          className="player-friend-avatar"
                        />
                        <div className="player-friend-copy">
                          <div className="player-friend-name">{result.name}</div>
                          <div className="player-friend-status-row">
                            <span className="player-friend-status idle">
                              {result.friendCode || "SoundCloud user"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`player-now-playing-follow-btn ${result.status === "friends" ? "following" : ""}`}
                        onClick={() => {
                          if (result.status === "incoming") {
                            void handleAcceptFriendRequest(result.userId);
                            return;
                          }
                          if (result.status === "none") {
                            void handleSendFriendRequest(result.userId);
                          }
                        }}
                        disabled={
                          result.status === "self" ||
                          result.status === "outgoing" ||
                          result.status === "friends"
                        }
                      >
                        {result.status === "incoming"
                          ? "Accept Friend"
                          : result.status === "outgoing"
                            ? "Requested"
                            : result.status === "friends"
                              ? "Friends"
                              : result.status === "self"
                                ? "You"
                                : "Add Friend"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : friendSearchQuery.trim() && !friendSearchLoading && !friendSearchError ? (
                <div className="player-sidebar-empty">
                  <div className="player-sidebar-empty-title">No matches found</div>
                  <div className="player-sidebar-empty-copy">
                    Try a SoundCloud username or paste a friend code.
                  </div>
                </div>
              ) : null}
            </section>
            {incomingFriendRequests.length ? (
              <section className="player-queue-section">
                <div className="player-queue-section-label">Friend Requests</div>
                {incomingFriendRequests.map((request) => (
                  <div key={`friend-request-${request.userId}`} className="player-friend-request-card">
                    <div className="player-friend-card-top">
                      <img
                        src={request.avatarUrl || "/placeholder.png"}
                        alt={request.name}
                        className="player-friend-avatar"
                      />
                      <div className="player-friend-copy">
                        <div className="player-friend-name">{request.name}</div>
                        <div className="player-friend-status-row">
                          <span className="player-friend-status idle">Incoming request</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="player-now-playing-follow-btn"
                      onClick={() => void handleAcceptFriendRequest(request.userId)}
                    >
                      Accept Friend
                    </button>
                  </div>
                ))}
              </section>
            ) : null}
            {visibleFriendActivity.length ? (
              visibleFriendActivity.map((friend) => {
                const activeTrack = friend.online
                  ? friend.currentTrack
                  : friend.lastTrack;
                const statusLabel = friend.online ? "Online" : "Offline";

                return (
                  <section
                    key={friend.id}
                    className={`player-friend-card ${activeTrack ? "player-friend-card-listening" : ""}`}
                    style={
                      activeTrack?.artwork
                        ? ({
                            "--player-friend-artwork": `url("${activeTrack.artwork}")`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    <div className="player-friend-card-top">
                      <img
                        src={friend.avatarUrl || "/placeholder.png"}
                        alt={friend.name}
                        className="player-friend-avatar"
                      />
                      <div className="player-friend-copy">
                        <div className="player-friend-name">{friend.name}</div>
                        {activeTrack ? (
                          <div className="player-friend-banner-copy">
                            <div className="player-friend-track-title">
                              {activeTrack.title}
                            </div>
                            <div className="player-friend-track-artist">
                              {activeTrack.artist || "Unknown"}
                            </div>
                          </div>
                        ) : (
                          <div className="player-friend-status-row">
                            <span className={`player-friend-status ${friend.online ? "online" : "offline"}`}>
                              {statusLabel}
                            </span>
                            {friend.updatedAt ? (
                            <span className="player-friend-time">
                              {new Date(friend.updatedAt).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })
            ) : incomingFriendRequests.length ? null : (
              <div className="player-sidebar-empty">
                <div className="player-sidebar-empty-title">No friends yet</div>
                <div className="player-sidebar-empty-copy">
                  Open an artist profile and use Add Friend to start building your list.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="player-queue-list player-sidebar-now-playing">
            <section className="player-now-playing-card">
              <img
                src={getTrackArtwork(currentTrack)}
                alt={currentTrack.title}
                className="player-now-playing-cover"
              />
              <div className="player-now-playing-copy">
                <div className="player-now-playing-title">{currentTrack.title}</div>
                <div className="player-now-playing-artist">
                  {nowPlayingArtist?.username || "Unknown"}
                </div>
              </div>
            </section>
            <section className="player-now-playing-artist-card">
              <div className="player-queue-section-label">Artist Preview</div>
              <div
                role="button"
                tabIndex={0}
                className="player-now-playing-artist-shell"
                onClick={() => {
                  if (nowPlayingArtist && onArtistClick) {
                    onArtistClick(nowPlayingArtist);
                  }
                }}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && nowPlayingArtist && onArtistClick) {
                    event.preventDefault();
                    onArtistClick(nowPlayingArtist);
                  }
                }}
              >
                <div
                  className="player-now-playing-artist-banner"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(8,8,12,0.18), rgba(8,8,12,0.88)), url("${
                      nowPlayingArtist?.avatar_url?.replace?.("-large", "-t500x500") ||
                      getTrackArtwork(currentTrack)
                    }")`,
                  }}
                />
                <img
                  src={
                    nowPlayingArtist?.avatar_url?.replace?.("-large", "-t500x500") ||
                    "/placeholder.png"
                  }
                  alt={nowPlayingArtist?.username || "Unknown"}
                  className="player-now-playing-artist-avatar"
                />
                <div className="player-now-playing-artist-copy">
                  <div className="player-now-playing-artist-name">
                    {currentTrack.user?.username || "Unknown"}
                  </div>
                  <div className="player-now-playing-artist-meta">
                    {typeof nowPlayingArtist?.followers_count === "number"
                      ? `${Number(nowPlayingArtist.followers_count).toLocaleString()} followers`
                      : "SoundCloud artist profile"}
                  </div>
                </div>
                <button
                  type="button"
                  className={`player-now-playing-follow-btn ${isFollowingCurrentArtist ? "following" : ""}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleCurrentArtistFollow();
                  }}
                >
                  {checkingCurrentArtistFollow
                    ? "..."
                    : isFollowingCurrentArtist
                      ? "Following"
                      : "Follow"}
                </button>
              </div>
            </section>
            <section className="player-queue-section">
              <div className="player-queue-section-label">Up Next</div>
              {upcomingQueueTracks.length ? (
                upcomingQueueTracks.slice(0, 5).map((track, index) => (
                  <div key={`now-playing-next-${track.id || index}`} className="player-queue-item">
                    <img
                      src={getTrackArtwork(track)}
                      alt={track.title}
                      className="player-queue-item-cover"
                    />
                    <div className="player-queue-item-copy">
                      <div className="player-queue-item-title">{track.title}</div>
                      <div className="player-queue-item-artist">
                        {track.user?.username || "Unknown"}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="player-queue-empty">Nothing queued after this track.</div>
              )}
            </section>
          </div>
        )}
      </aside>
      <button
        type="button"
        className={`player-queue-pull-tab ${isQueuePanelOpen ? "open" : ""} ${isQueueResizing ? "dragging" : ""}`}
        style={{
          right: isQueuePanelOpen ? `${Math.max(queuePanelWidth, 0)}px` : "0px",
        }}
        onPointerDown={handleQueuePullTabPointerDown}
        onClick={handleQueuePullTabClick}
        aria-label={isQueuePanelOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={isQueuePanelOpen}
      >
        <span className="player-queue-pull-tab-grip" />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d={isQueuePanelOpen ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        role="button"
        tabIndex={0}
        className="mobile-player-collapsed"
        onClick={openMobilePlayer}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openMobilePlayer();
          }
        }}
        aria-label={`Open player for ${currentTrack.title}`}
      >
        <img
          src={getTrackArtwork(currentTrack)}
          alt={currentTrack.title}
          className="mobile-player-cover"
        />
        <div className="mobile-player-meta">
          <div className="mobile-player-artist">
            {currentTrack.user?.username || "Unknown"}
          </div>
          <div className="mobile-player-title">{currentTrack.title}</div>
        </div>
        <button
          type="button"
          className="mobile-player-icon-btn mobile-device-btn"
          onClick={(event) => {
            event.stopPropagation();
            setIsMobileDeviceSheetOpen(true);
          }}
          aria-label="Choose listening device"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="13" height="10" rx="2" />
            <path d="M8 19h12a1 1 0 0 0 1-1v-7" />
            <path d="M8 19l-2 2" />
          </svg>
        </button>
        <button
          type="button"
          className="mobile-player-icon-btn"
          onClick={(event) => {
            event.stopPropagation();
            togglePlayPause();
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className={`mobile-player-icon-btn mobile-like-btn ${isLiked ? "liked" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            void toggleLike();
          }}
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <img
            src="https://img.icons8.com/parakeet-line/48/like.png"
            alt={isLiked ? "Unlike" : "Like"}
            className="player-like-icon"
          />
        </button>
      </div>
      <div
        className={`mobile-player-sheet ${isMobilePlayerOpen ? "open" : ""}`}
        onClick={closeMobilePlayer}
      >
        <div
          className="mobile-player-sheet-panel"
          onClick={(event) => event.stopPropagation()}
          onTouchStart={handleMobileSheetTouchStart}
          onTouchMove={handleMobileSheetTouchMove}
          onTouchEnd={handleMobileSheetTouchEnd}
        >
          <div className="mobile-player-sheet-handle" />
          <div className="mobile-player-sheet-top">
            {playlistLabel ? (
              <div className="mobile-player-sheet-top-context">{playlistLabel}</div>
            ) : (
              <div />
            )}
            <button
              type="button"
              className="mobile-player-minimize"
              onClick={closeMobilePlayer}
              aria-label="Minimize player"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 15l6-6 6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div className="mobile-player-sheet-body">
            <div
              className={`mobile-player-sheet-pages mobile-player-sheet-pages-${mobileSheetPage}`}
            >
              <section className="mobile-player-sheet-page mobile-player-sheet-page-player">
                <img
                  src={getTrackArtwork(currentTrack)}
                  alt={currentTrack.title}
                  className="mobile-player-sheet-cover"
                />
                <div className="mobile-player-sheet-actions-row">
                  <div className="mobile-player-sheet-actions-left">
                    <button
                      type="button"
                      className={`mobile-player-icon-btn mobile-like-btn ${isLiked ? "liked" : ""}`}
                      onClick={() => void toggleLike()}
                      aria-label={isLiked ? "Unlike" : "Like"}
                    >
                      <img
                        src="https://img.icons8.com/parakeet-line/48/like.png"
                        alt={isLiked ? "Unlike" : "Like"}
                        className="player-like-icon"
                      />
                    </button>
                    <button
                      type="button"
                      className={`mobile-player-icon-btn mobile-shuffle-btn ${isShuffle ? "active" : ""}`}
                      onClick={() => onShuffleChange?.(!isShuffle)}
                      aria-label={isShuffle ? "Shuffle Off" : "Shuffle On"}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="16 3 21 3 21 8"></polyline>
                        <line x1="4" y1="20" x2="21" y2="3"></line>
                        <polyline points="21 16 21 21 16 21"></polyline>
                        <line x1="15" y1="15" x2="21" y2="21"></line>
                        <line x1="4" y1="4" x2="9" y2="9"></line>
                      </svg>
                    </button>
                  </div>
                  <div className="mobile-player-sheet-actions-right">
                    <button
                      type="button"
                      className="mobile-player-icon-btn mobile-device-btn"
                      onClick={() => setIsMobileDeviceSheetOpen(true)}
                      aria-label="Choose listening device"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="5" width="13" height="10" rx="2" />
                        <path d="M8 19h12a1 1 0 0 0 1-1v-7" />
                        <path d="M8 19l-2 2" />
                      </svg>
                    </button>
                    <div className="mobile-player-sheet-playlist-wrap">
                      <button
                        type="button"
                        className={`mobile-player-icon-btn mobile-playlist-btn ${isInAnyPlaylist ? "in-playlist" : ""}`}
                        onClick={() => setIsMobilePlaylistSheetOpen(true)}
                        aria-label={
                          isInAnyPlaylist ? "Added to playlist" : "Add to playlist"
                        }
                      >
                        <img
                          src={
                            isInAnyPlaylist
                              ? "https://img.icons8.com/parakeet-line/50/checked.png"
                              : "https://img.icons8.com/parakeet-line/48/add.png"
                          }
                          alt="Add to playlist"
                          className="player-add-playlist-icon"
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mobile-player-sheet-meta">
                  <div className="mobile-player-sheet-artist">
                    {currentTrack.user?.username || "Unknown"}
                  </div>
                  <div
                    ref={mobileTitleRef}
                    className={`mobile-player-sheet-title ${shouldMarqueeMobileTitle ? "is-marquee" : ""}`}
                  >
                    <span ref={mobileTitleSpanRef}>{currentTrack.title}</span>
                  </div>
                </div>
                <div className="mobile-player-sheet-progress">
                  <span className="player-time">{formatTime(currentTime)}</span>
                  <input
                    type="range"
                    className="player-seek"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                  />
                  <span className="player-time">{formatTime(duration)}</span>
                </div>
                <div className="mobile-player-sheet-controls">
                  <button
                    type="button"
                    className="player-btn"
                    onClick={handlePrevious}
                    title="Previous"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <line
                        x1="5"
                        y1="4"
                        x2="5"
                        y2="20"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <polygon points="19 3 19 21 5 12 19 3" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="player-btn player-btn-play"
                    onClick={togglePlayPause}
                    disabled={loading}
                    aria-label={loading ? "Loading track" : isPlaying ? "Pause" : "Play"}
                  >
                    {loading ? (
                      <svg
                        className="player-loading-spinner"
                        viewBox="0 0 24 24"
                        role="img"
                        aria-label="Loading"
                      >
                        <circle className="player-loading-spinner-track" cx="12" cy="12" r="9" />
                        <path className="player-loading-spinner-head" d="M21 12a9 9 0 0 0-9-9" />
                      </svg>
                    ) : isPlaying ? (
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="player-btn"
                    onClick={handleNext}
                    title="Next"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 5 21 19 12 5 3" />
                      <line
                        x1="19"
                        y1="4"
                        x2="19"
                        y2="20"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>
                </div>
                <div className="mobile-player-sheet-swipe-hint">
                  Swipe up for track page
                </div>
              </section>
              <section
                ref={mobileTrackPageRef}
                className="mobile-player-sheet-page mobile-player-sheet-page-details"
              >
                <section className="mobile-player-track-page">
              <div className="mobile-player-track-page-header">Track Page</div>
              {mobileTrackDetailsError ? (
                <div className="track-page-placeholder">
                  {mobileTrackDetailsError}. Showing available track info.
                </div>
              ) : null}

              <div className="track-panel-stats mobile-track-panel-stats">
                {mobileTrackStats.map((stat) => (
                  <div key={stat.label} className="track-panel-stat">
                    <div className="track-panel-stat-label">{stat.label}</div>
                    <div className="track-panel-stat-value">
                      {Number(stat.value || 0).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <section className="mobile-player-track-page-section track-panel-section-copy">
                  <h3 className="search-section-title">About This Track</h3>
                  {mobileTrackBio ? (
                    <div className="track-panel-copy">{renderTrackBio(mobileTrackBio)}</div>
                  ) : mobileTrackDetailsLoading ? (
                    <div className="track-page-placeholder track-page-placeholder-block">
                      Loading track details...
                    </div>
                  ) : null}
                </section>

              {mobileTrackArtist?.username ? (
                <section className="mobile-player-track-page-section">
                  <h3 className="search-section-title">Artist</h3>
                  <button
                    type="button"
                    className="player-link track-page-artist"
                    onClick={() => onArtistClick?.(mobileTrackArtist)}
                  >
                    {mobileTrackArtist.username}
                  </button>
                </section>
              ) : null}

              <section className="mobile-player-track-page-section track-panel-section-comments">
                <h3 className="search-section-title">Comments</h3>
                {mobileTrackDetailsLoading && mobileComments.length === 0 ? (
                  <div className="track-page-placeholder track-page-placeholder-block">
                    Loading comments...
                  </div>
                ) : mobileComments.length === 0 ? (
                  <div className="track-page-placeholder track-page-placeholder-block">
                    No comments yet.
                  </div>
                ) : (
                  <div className="track-panel-comments">
                    {mobileVisibleComments.map((comment) => (
                      <div key={comment.id} className="track-panel-comment">
                        <div className="track-panel-comment-head">
                          <img
                            src={comment.user.avatar_url || "/placeholder.png"}
                            alt={comment.user.username}
                            width={36}
                            height={36}
                            style={{ borderRadius: "50%", objectFit: "cover" }}
                          />
                          <div>
                            <div className="track-panel-comment-user">
                              {comment.user.username}
                            </div>
                            <div className="track-panel-comment-time">
                              {new Date(comment.timestamp * 1000).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="track-panel-comment-body">{comment.body}</div>
                      </div>
                    ))}
                    {mobileCanShowMoreComments ? (
                      <button
                        type="button"
                        className="track-panel-more"
                        onClick={() =>
                          setMobileVisibleCommentsCount((prev) => prev + 10)
                        }
                      >
                        View more comments
                      </button>
                    ) : null}
                  </div>
                )}
              </section>

              <section className="mobile-player-track-page-section track-panel-section-related">
                <h3 className="search-section-title">Related Tracks</h3>
                {mobileTrackDetailsLoading && mobileRelatedTracks.length === 0 ? (
                  <div className="track-page-placeholder track-page-placeholder-block">
                    Loading related tracks...
                  </div>
                ) : mobileRelatedTracks.length === 0 ? (
                  <div className="track-page-placeholder track-page-placeholder-block">
                    No related tracks found.
                  </div>
                ) : (
                  <div className="library-grid mobile-player-related-grid">
                    {mobileRelatedTracks.map((relatedTrack) => {
                      const relatedArtist =
                        relatedTrack.user?.username ||
                        relatedTrack.artist?.username ||
                        "Unknown";
                      const relatedArtwork =
                        getTrackArtwork(relatedTrack) || "/placeholder.png";

                      return (
                        <div
                          key={relatedTrack.id}
                          className="track-card"
                          onClick={() => onTrackOpen?.(relatedTrack)}
                        >
                          <img
                            src={relatedArtwork}
                            alt={relatedTrack.title}
                            className="track-cover"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="track-info clickable">
                            <div className="track-title">{relatedTrack.title}</div>
                            <div className="track-artist">{relatedArtist}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
                </section>
              </section>
            </div>
          </div>
        </div>
      </div>
      <MobilePlaylistSheet
        trackId={currentTrack.id}
        isOpen={isMobilePlaylistSheetOpen}
        onClose={() => setIsMobilePlaylistSheetOpen(false)}
        playlistsWithTrack={playlistsWithTrack}
      />
      <div
        className={`mobile-device-sheet ${isMobileDeviceSheetOpen ? "open" : ""}`}
        onClick={() => setIsMobileDeviceSheetOpen(false)}
      >
        <div className="mobile-device-sheet-panel" onClick={(event) => event.stopPropagation()}>
          <div className="mobile-player-sheet-handle" />
          <div className="mobile-device-sheet-header">
            <div className="mobile-device-sheet-title">Listen On</div>
            <button
              type="button"
              className="mobile-player-minimize"
              onClick={() => setIsMobileDeviceSheetOpen(false)}
              aria-label="Close device menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="mobile-device-sheet-list">
            {availableDevices.map((device) => {
              const isActive = device?.deviceId === playbackOwnerDeviceId;
              const isCurrentDevice = device?.deviceId === deviceId;
              return (
                <button
                  key={device?.socketId || device?.deviceId}
                  type="button"
                  className={`mobile-device-sheet-item ${isActive ? "active" : ""}`}
                  onClick={() => claimPlaybackOutput(device.deviceId)}
                >
                  <span className="mobile-device-sheet-name">{describeDevice(device)}</span>
                  <span className="mobile-device-sheet-meta">
                    {isActive ? (isCurrentDevice ? "Listening on this device" : "Listening on that device") : isCurrentDevice ? "This device" : "Available"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
});

export default Player;














