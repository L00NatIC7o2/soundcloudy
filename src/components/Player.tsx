import { useEffect, useRef, useState, memo } from "react";
import PlaylistMenu from "./PlaylistMenu";

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
  isShuffle = false,
  onShuffleChange,
}: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [playlistsWithTrack, setPlaylistsWithTrack] = useState<number[]>([]);
  const [isInAnyPlaylist, setIsInAnyPlaylist] = useState(false);
  const lastBackClickRef = useRef<number>(0);
  const playlistLabel =
    currentTrack?.playlistTitle ||
    currentTrack?.publisher_metadata?.album_title ||
    "";
  const playlistId = currentTrack?.playlistId || null;
  const canOpenPlaylist = Boolean(onPlaylistClick && playlistId);
  const canOpenArtist = Boolean(onArtistClick && currentTrack?.user);

  // Update Media Session metadata
  useEffect(() => {
    if (currentTrack && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.user?.username || "Unknown Artist",
        album: playlistLabel,
        artwork: [
          {
            src: currentTrack.artwork_url?.replace("-large", "-t500x500") || "",
            sizes: "500x500",
            type: "image/jpeg",
          },
        ],
      });

      // Set action handlers for media keys
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
      // Clean up handlers
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
  }, [currentTrack, onPrevious, onNext]);

  // Update playback state
  useEffect(() => {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [isPlaying]);

  // Load track - Get stream URL from API
  useEffect(() => {
    const loadTrack = async () => {
      if (!currentTrack || !audioRef.current) return;

      setLoading(true);

      try {
        if (audioRef.current) {
          // Stream directly via proxy to reduce startup latency
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
  }, [currentTrack?.id]);

  // Only check playlists when menu is opened, not on every track change
  useEffect(() => {
    if (!currentTrack?.id || !isPlaylistMenuOpen) return;
    checkPlaylistsForTrack(currentTrack.id);
  }, [currentTrack?.id, isPlaylistMenuOpen]);

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

  const toggleLike = async () => {
    if (!currentTrack?.id) {
      alert("No track selected");
      return;
    }

    try {
      const response = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: currentTrack.id,
          like: !isLiked,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update like");
      }
      await checkIfLiked(currentTrack.id);
    } catch (error) {
      console.error("Like failed:", error);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("player-state", {
        detail: {
          isPlaying,
          trackId: currentTrack?.id ?? null,
        },
      }),
    );
  }, [isPlaying, currentTrack?.id]);

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

      // Update Media Session position - only if duration is valid
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
    const currentTime = audioRef.current.currentTime;

    // If song has played for less than 2 seconds OR back was clicked within 2 seconds, go to previous track
    if (currentTime < 2 || timeSinceLastClick < 2000) {
      lastBackClickRef.current = 0;
      onPrevious?.();
    } else {
      // Otherwise, restart the current song
      lastBackClickRef.current = now;
      audioRef.current.currentTime = 0;
    }
  };

  const handleNext = () => {
    onNext?.();
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="player-bar">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleTrackEnd}
      />
      <div className="player-container">
        {loading && <div className="player-loading">Loading track...</div>}
        <div className="player-content">
          <div className="player-left">
            <img
              src={
                currentTrack.artwork_url?.replace("-large", "-t200x200") ||
                "/placeholder.png"
              }
              alt={currentTrack.title}
              className="player-artwork"
            />
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
                  <span>{currentTrack.title}</span>
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
                  "⏳"
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
            <button className="player-volume-btn" onClick={toggleMute}>
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
          </div>
        </div>
      </div>
    </div>
  );
});

export default Player;
