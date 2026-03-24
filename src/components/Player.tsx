import { useEffect, useRef, useState, memo, type CSSProperties } from "react";
import { io, Socket } from "socket.io-client";
import PlaylistMenu from "./PlaylistMenu";
import MobilePlaylistSheet from "./MobilePlaylistSheet";
import { prefetchTrackDetails } from "../lib/trackDetails";
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
  isShuffle = false,
  onShuffleChange,
}: PlayerProps) {
  const getTrackArtwork = (track: any) =>
    track?.artwork_url?.replace?.("-large", "-t500x500") ||
    track?.user?.avatar_url?.replace?.("-large", "-t500x500") ||
    "/placeholder.png";

  const audioRef = useRef<HTMLAudioElement>(null);
  const userId =
    typeof window !== "undefined"
      ? localStorage.getItem("soundcloudy_user_id") ||
        (() => {
          const id = Math.random().toString(36).slice(2);
          localStorage.setItem("soundcloudy_user_id", id);
          return id;
        })()
      : "";
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;
    const s = io(getClientSocketUrl(window.location.origin));
    setSocket(s);

    s.on("connect", () => {
      s.emit("join", userId);
    });

    s.on("playback-update", (remoteState) => {
      if (typeof remoteState.position === "number" && audioRef.current) {
        audioRef.current.currentTime = remoteState.position;
      }
      if (typeof remoteState.playing === "boolean") {
        setIsPlaying(remoteState.playing);
        if (audioRef.current) {
          if (remoteState.playing) audioRef.current.play();
          else audioRef.current.pause();
        }
      }
    });

    s.on("remote-command", (command) => {
      if (command && typeof command === "object") {
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
  }, [userId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isMobilePlaylistSheetOpen, setIsMobilePlaylistSheetOpen] =
    useState(false);
  const [shouldMarqueeMobileTitle, setShouldMarqueeMobileTitle] = useState(false);
  const [isVolumePopoverOpen, setIsVolumePopoverOpen] = useState(false);
  const [playlistsWithTrack, setPlaylistsWithTrack] = useState<number[]>([]);
  const [isInAnyPlaylist, setIsInAnyPlaylist] = useState(false);
  const lastBackClickRef = useRef<number>(0);
  const lastRemoteSyncRef = useRef<number>(0);
  const pendingRemoteSeekRef = useRef<number | null>(null);
  const mobileTitleRef = useRef<HTMLDivElement>(null);
  const mobileTitleSpanRef = useRef<HTMLSpanElement>(null);
  const mobileSheetTouchStartRef = useRef<number | null>(null);
  const mobileSheetTouchCurrentRef = useRef<number | null>(null);

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
      pendingRemoteSeekRef.current =
        typeof currentTrack.remoteStartPosition === "number"
          ? currentTrack.remoteStartPosition
          : null;

      try {
        audioRef.current.src = `/api/stream?trackId=${currentTrack.id}&proxy=1`;
        audioRef.current.load();

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
            })
            .catch((error) => {
              if (error.name !== "AbortError") {
                console.error("Play error:", error);
              }
            });
        }
      } catch (error) {
        console.error("Load track error:", error);
        alert(
          `Failed to load track: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
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

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const emitPlaybackState = (force = false) => {
    if (!socket || !currentTrack || !userId) return;
    const now = Date.now();
    if (!force && now - lastRemoteSyncRef.current < 700) return;
    lastRemoteSyncRef.current = now;

    socket.emit("playback-update", {
      userId,
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
  }, [isPlaying, currentTrack?.id, socket, userId, currentTrack]);

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
    if (!socket || !currentTrack || !userId) return;

    const handleConnect = () => {
      emitPlaybackState(true);
    };

    socket.on("connect", handleConnect);
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket, currentTrack, userId, isPlaying]);

  useEffect(() => {
    if (!socket || !currentTrack || !isPlaying) return;
    const interval = window.setInterval(() => {
      emitPlaybackState();
    }, 1000);
    return () => window.clearInterval(interval);
  }, [socket, currentTrack?.id, isPlaying, userId]);

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

  const handleTrackEnd = () => {
    if (onTrackEnd) onTrackEnd();
  };

  const handlePrevious = () => {
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
    onNext?.();
  };

  const openMobilePlayer = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 900) {
      setIsMobilePlayerOpen(true);
    }
  };

  const closeMobilePlayer = () => {
    setIsMobilePlayerOpen(false);
    setIsMobilePlaylistSheetOpen(false);
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
      mobileSheetTouchCurrentRef.current !== null &&
      mobileSheetTouchCurrentRef.current - mobileSheetTouchStartRef.current > 90
    ) {
      closeMobilePlayer();
    }

    mobileSheetTouchStartRef.current = null;
    mobileSheetTouchCurrentRef.current = null;
  };

  if (!currentTrack) {
    return null;
  }

  return (
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
          </div>
        </div>
      </div>
      <MobilePlaylistSheet
        trackId={currentTrack.id}
        isOpen={isMobilePlaylistSheetOpen}
        onClose={() => setIsMobilePlaylistSheetOpen(false)}
        playlistsWithTrack={playlistsWithTrack}
      />
    </div>
  );
});

export default Player;








