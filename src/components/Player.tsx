import { useEffect, useRef, useState } from "react";

interface PlayerProps {
  currentTrack: any;
}

export default function Player({ currentTrack }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    if (currentTrack && audioRef.current) {
      const streamUrl = `/api/stream?trackId=${currentTrack.id}`;
      audioRef.current.src = streamUrl;
      audioRef.current.load();

      // Check if track is liked
      checkIfLiked();

      // Auto-play
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

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
    if (!currentTrack?.id) return;

    const newLikeState = !isLiked;

    // Optimistic UI update
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
        throw new Error("Failed to update like status");
      }

      console.log(
        `Track ${currentTrack.id} ${newLikeState ? "liked" : "unliked"} successfully`,
      );
    } catch (error) {
      console.error("Like failed:", error);
      // Revert on error
      setIsLiked(!newLikeState);
      alert("Failed to update like status. Please try again.");
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;

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
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
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
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return "🔇";
    if (volume < 0.5) return "🔉";
    return "🔊";
  };

  if (!currentTrack) {
    return <div className="player-loading">Loading last played track...</div>;
  }

  return (
    <div className="player-container">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

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
              {currentTrack.user?.username || "Unknown Artist"}
            </div>
            <div
              className={`player-title ${isHovering ? "scrolling" : ""}`}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
            >
              <span>{currentTrack.title}</span>
            </div>
          </div>
          <button
            className={`player-like ${isLiked ? "liked" : ""}`}
            onClick={toggleLike}
            title={isLiked ? "Unlike" : "Like"}
            disabled={!currentTrack}
          >
            {isLiked ? "❤️" : "🤍"}
          </button>
        </div>

        <div className="player-center">
          <div className="player-controls">
            <button className="player-btn" title="Previous">
              ⏮
            </button>
            <button className="player-btn player-btn-play" onClick={togglePlay}>
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button className="player-btn" title="Next">
              ⏭
            </button>
          </div>

          <div className="player-progress">
            <span className="player-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="player-seek"
            />
            <span className="player-time">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player-right">
          <button className="player-volume-btn" onClick={toggleMute}>
            {getVolumeIcon()}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="player-volume-slider"
          />
        </div>
      </div>
    </div>
  );
}
