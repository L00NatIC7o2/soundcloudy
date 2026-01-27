import { useEffect, useRef, useState } from "react";

type Track = { id: number; title: string; user?: { username: string } };
type Props = { currentTrack?: Track | null };

function Player({ currentTrack }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    setError(null);
    setIsLoading(true);

    // Use proxied stream endpoint
    const streamUrl = `/api/stream?trackId=${currentTrack.id}`;
    audioRef.current.src = streamUrl;
    audioRef.current.load();

    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Play error:", err);
        setError(err.message);
        setIsLoading(false);
      });
  }, [currentTrack]);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleError = (e: any) => {
    console.error("Audio error:", e.target.error);
    setError("Failed to load audio");
    setIsLoading(false);
  };
  const handleCanPlay = () => {
    console.log("Audio can play");
    setIsLoading(false);
  };

  if (!currentTrack) {
    return <div className="p-4 text-center">No track selected</div>;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 shadow-lg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="font-semibold">{currentTrack.title}</div>
            <div className="text-sm text-gray-400">
              {currentTrack.user?.username}
            </div>
          </div>

          {isLoading && <div className="text-sm">Loading...</div>}
          {error && <div className="text-sm text-red-500">{error}</div>}

          <audio
            ref={audioRef}
            controls
            crossOrigin="anonymous"
            onPlay={handlePlay}
            onPause={handlePause}
            onError={handleError}
            onCanPlay={handleCanPlay}
            className="max-w-md"
          />
        </div>
      </div>
    </div>
  );
}

export default Player;
export { Player };
