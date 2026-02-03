import { useEffect, useRef, useState } from "react";

interface PlayerProps {
  currentTrack: any;
  onTrackEnd?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onArtistClick?: (artist: any) => void;
  isShuffle?: boolean;
  onShuffleChange?: (shuffle: boolean) => void;
}

export default function Player({
  currentTrack,
  onTrackEnd,
  onPrevious,
  onNext,
  onArtistClick,
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

  // Update Media Session metadata
  useEffect(() => {
    if (currentTrack && "mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.user?.username || "Unknown Artist",
        album: currentTrack.publisher_metadata?.album_title || "",
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

          // Check like status
          checkIfLiked();

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

  const checkIfLiked = async () => {
    if (!currentTrack?.id) return;
    try {
      const response = await fetch(
        `/api/check-like?trackId=${currentTrack.id}`,
      );
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

    const newLikeState = !isLiked;
    setIsLiked(newLikeState);

    try {
      const response = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackId: currentTrack.id,
          like: newLikeState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update like");
      }
    } catch (error) {
      console.error("Like failed:", error);
      setIsLiked(!newLikeState);
      alert(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
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

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);

      // Update Media Session position - only if duration is valid
      if (
        "mediaSession" in navigator &&
        navigator.mediaSession.setPositionState &&
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
    onPrevious?.();
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
            <div className="player-info">
              <div
                className="player-artist"
                onClick={() => onArtistClick?.(currentTrack.user)}
                style={{
                  cursor: onArtistClick ? "pointer" : "default",
                  textDecoration: onArtistClick ? "underline" : "none",
                }}
              >
                {currentTrack.user?.username || "Unknown"}
              </div>
              <div className="player-title">
                <span>{currentTrack.title}</span>
              </div>
            </div>
            <button
              className={`player-like ${isLiked ? "liked" : ""}`}
              onClick={toggleLike}
              title={isLiked ? "Unlike" : "Like"}
            >
              <span className="player-like-icon">{isLiked ? "♥" : "♡"}</span>
            </button>
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
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M16.6915026,12.4744748 L21.1271369,16.9101091 C21.6563168,17.439289 21.6563168,18.3159781 21.1271369,18.8451579 C20.5979571,19.3743378 19.7212681,19.3743378 19.1920882,18.8451579 L14.7564539,14.4095236 L10.3208196,18.8451579 C9.79163977,19.3743378 8.91495066,19.3743378 8.38577084,18.8451579 C7.85659103,18.3159781 7.85659103,17.439289 8.38577084,16.9101091 L12.8214051,12.4744748 L8.38577084,8.03884049 C7.85659103,7.50966068 7.85659103,6.63297157 8.38577084,6.10379175 C8.91495066,5.57461194 9.79163977,5.57461194 10.3208196,6.10379175 L14.7564539,10.5394261 L19.1920882,6.10379175 C19.7212681,5.57461194 20.5979571,5.57461194 21.1271369,6.10379175 C21.6563168,6.63297157 21.6563168,7.50966068 21.1271369,8.03884049 L16.6915026,12.4744748 Z" />
                </svg>
              ) : volume < 0.5 ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M3 9v6h4l5 5V4l-5 5H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 16.91c-1.48 1.46-3.51 2.36-5.77 2.36-2.26 0-4.29-.9-5.77-2.36l-1.1 1.1c1.86 1.86 4.41 3 7.07 3s5.21-1.14 7.07-3l-1.1-1.1zM19.5 5.5C19.5 2.46 16.84 0 13.5 0S7.5 2.46 7.5 5.5h2.5c0-1.93 1.71-3.5 3-3.5s3 1.57 3 3.5v5c0 1.93-1.71 3.5-3 3.5s-3-1.57-3-3.5H7.5c0 3.04 2.66 5.5 6 5.5s6-2.46 6-5.5v-5z" />
                </svg>
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
}
