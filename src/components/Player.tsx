import { useEffect, useRef, useState } from "react";

interface PlayerProps {
  currentTrack: any;
  onTrackEnd?: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export default function Player({
  currentTrack,
  onTrackEnd,
  onPrevious,
  onNext,
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
              <div className="player-artist">
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
              {isLiked ? "❤️" : "🤍"}
            </button>
          </div>

          <div className="player-center">
            <div className="player-controls">
              <button
                className="player-btn"
                onClick={handlePrevious}
                title="Previous"
              >
                ⏮
              </button>
              <button
                className="player-btn player-btn-play"
                onClick={togglePlayPause}
                disabled={loading}
              >
                {loading ? "⏳" : isPlaying ? "⏸" : "▶"}
              </button>
              <button className="player-btn" onClick={handleNext} title="Next">
                ⏭
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
              {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
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

        {/* Attribution - Required by SoundCloud Terms */}
        <div className="player-attribution">
          <span>
            By{" "}
            <a
              href={`https://soundcloud.com/${currentTrack.user?.permalink || "#"}`}
              target="_blank"
              rel="noopener noreferrer"
              className="player-attribution-link"
            >
              {currentTrack.user?.username || "Unknown"}
            </a>
          </span>
          <span className="player-attribution-divider">•</span>
          <span>
            Powered by{" "}
            <a
              href="https://soundcloud.com"
              target="_blank"
              rel="noopener noreferrer"
              className="player-attribution-link"
            >
              SoundCloud
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
