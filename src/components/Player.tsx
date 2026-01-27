import { useEffect, useRef, useState } from "react";

type Track = { id: number; title: string; user?: { username: string } };
type Props = { currentTrack?: Track | null; token: string };

function Player({ currentTrack, token }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    setError(null);
    setIsLoading(true);

    const url = `/api/stream?trackId=${currentTrack.id}&token=${encodeURIComponent(token)}`;
    audioRef.current.src = url;
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
  }, [currentTrack, token]);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleError = (e: any) => {
    console.error("Audio error:", e);
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
    <div>
      <div>{currentTrack.title}</div>
      <audio ref={audioRef} controls />
    </div>
  );
}

export default Player;
export { Player };
