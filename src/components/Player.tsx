import { useEffect, useRef, useState, memo, type CSSProperties } from "react";
import { io, Socket } from "socket.io-client";
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
}

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
}: PlayerProps) {
  const getTrackArtwork = (track: any) =>
    track?.artwork_url?.replace?.("-large", "-t500x500") ||
    track?.user?.avatar_url?.replace?.("-large", "-t500x500") ||
    "/placeholder.png";

  const audioRef = useRef<HTMLAudioElement>(null);
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
  const playbackOwnerRef = useRef<string | null>(null);
  const syncRoomRetryRef = useRef<number | null>(null);
  const suppressRemoteEchoUntilRef = useRef(0);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

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
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [isQueuePanelOpen, setIsQueuePanelOpen] = useState(false);
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
  const pendingRemoteSeekRef = useRef<number | null>(null);
  const mobileTitleRef = useRef<HTMLDivElement>(null);
  const mobileTitleSpanRef = useRef<HTMLSpanElement>(null);
  const mobileSheetTouchStartRef = useRef<number | null>(null);
  const mobileSheetTouchCurrentRef = useRef<number | null>(null);
  const mobileTrackPageRef = useRef<HTMLDivElement | null>(null);
  const queueCurrentTrackRef = useRef<HTMLDivElement | null>(null);
  const queueListRef = useRef<HTMLDivElement | null>(null);

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

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest(".player-queue-panel") ||
        target.closest(".player-queue-btn") ||
        target.closest(".player-bar")
      ) {
        return;
      }
      setIsQueuePanelOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isQueuePanelOpen]);

  useEffect(() => {
    if (!isQueuePanelOpen) return;
    const frame = window.requestAnimationFrame(() => {
      queueCurrentTrackRef.current?.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    isQueuePanelOpen,
    currentTrack?.id,
    currentQueueIndex,
    queue.length,
    listeningHistory.length,
  ]);

  const handleQueueListScroll = () => {
    const element = queueListRef.current;
    if (!element || !isQueuePanelOpen) return;
    if (!historyHasMore || historyLoadingMore || !onRequestMoreHistory) return;
    if (element.scrollTop > 120) return;
    onRequestMoreHistory();
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

  useEffect(() => {
    if (currentTrack && "mediaSession" in navigator) {
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

      navigator.mediaSession.setActionHandler("play", () => {
        if (audioRef.current) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      });

      navigator.mediaSession.setActionHandler("pause", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });

      navigator.mediaSession.setActionHandler("previoustrack", () => {
        if (onPrevious) onPrevious();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        if (onNext) onNext();
      });

      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(
            audioRef.current.currentTime - (details.seekOffset || 10),
            0,
          );
        }
      });

      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(
            audioRef.current.currentTime + (details.seekOffset || 10),
            audioRef.current.duration,
          );
        }
      });

      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (audioRef.current && details.seekTime !== undefined) {
          audioRef.current.currentTime = details.seekTime;
        }
      });

      navigator.mediaSession.setActionHandler("stop", () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
        }
      });
    }

    return () => {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
        navigator.mediaSession.setActionHandler("seekto", null);
        navigator.mediaSession.setActionHandler("stop", null);
      }
    };
  }, [currentTrack, onPrevious, onNext, playlistLabel]);

  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  useEffect(() => {
    const loadTrack = async () => {
      if (!currentTrack || !audioRef.current) return;

      setLoading(true);
      const shouldAutoPlay = currentTrack.remoteShouldPlay !== false;
      pendingRemoteSeekRef.current =
        typeof currentTrack.remoteStartPosition === "number"
          ? currentTrack.remoteStartPosition
          : null;

      try {
        audioRef.current.src = `/api/stream?trackId=${currentTrack.id}&proxy=1`;
        audioRef.current.load();

        if (shouldAutoPlay) {
          try {
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
        setLoading(false);
      }
    };

    loadTrack();
  }, [currentTrack]);

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
    if (
      !currentTrack?.id ||
      (!isPlaylistMenuOpen && !isMobilePlaylistSheetOpen)
    )
      return;
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
    try {
      const response = await fetch(
        `/api/check-track-in-playlists?trackId=${trackId}`,
      );
      const data = await response.json();
      setPlaylistsWithTrack(
        data.playlistsWithTrack?.map((p: any) => p.id) || [],
      );
      setIsInAnyPlaylist(data.isInAnyPlaylist);
    } catch (error) {
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
    sendRemoteCommand({
      type: "claim-output",
      deviceId: targetDeviceId,
      track: currentTrackRef.current || currentTrack,
      position,
      shouldPlay,
      sourceDeviceId: deviceId,
    });
    setPlaybackOwnerDeviceId(targetDeviceId);
    if (targetDeviceId !== deviceId && audioRef.current) {
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
    if (!force && now - lastRemoteSyncRef.current < 700) return;
    lastRemoteSyncRef.current = now;
    setPlaybackOwnerDeviceId(deviceId);

    console.log("[player-sync] emit playback-update", {
      roomId: syncRoomId,
      deviceId,
      trackId: currentTrack.id,
      playing: isPlaying,
      force,
      position: Math.round(audioRef.current?.currentTime || 0),
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
        position: audioRef.current?.currentTime || 0,
        duration: audioRef.current?.duration || currentTrack.duration || 0,
        playing: isPlaying,
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
    }, 1000);
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

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
      emitPlaybackState();

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
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
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
      sendRemoteCommand({
        type: "load-track",
        track,
        position: 0,
        shouldPlay: true,
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
    if (onTrackEnd) onTrackEnd();
  };

  const handlePrevious = () => {
    const passiveOwner =
      playbackOwnerRef.current && playbackOwnerRef.current !== deviceId;
    if (passiveOwner) {
      sendRemoteCommand("prev");
      return;
    }

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
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnd}
      />
      <div className="player-container player-desktop-shell" style={playerStyle}>
        {loading && <div className="player-loading">Loading track...</div>}
        <div className="player-content">
          <div className="player-left">
            <div
              className="player-artwork-wrapper"
              style={{ position: "relative", display: "inline-block" }}
            >
              <a
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  onTrackOpen?.(currentTrack);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  alert("Share | Go to Track | Add to Playlist");
                }}
              >
                <img
                  src={getTrackArtwork(currentTrack)}
                  alt={currentTrack.title}
                  className="player-artwork clickable"
                  style={{ cursor: "pointer" }}
                />
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
                      {currentTrack.user?.username || "Unknown"}
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
                  onClick={() => setIsQueuePanelOpen((open) => !open)}
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
              >
                {loading ? (
                  "?"
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
      <aside className={`player-queue-panel ${isQueuePanelOpen ? "open" : ""}`}>
        <div className="player-queue-panel-header">
          <div className="player-queue-panel-title">Queue</div>
          <button
            type="button"
            className="player-queue-panel-close"
            onClick={() => setIsQueuePanelOpen(false)}
            aria-label="Close queue"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="player-queue-panel-subtitle">
          Scroll up for listening history
        </div>
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
                  key={`history-${track.id || index}`}
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

          <section className="player-queue-section">
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
      </aside>
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
                  >
                    {isPlaying ? (
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








