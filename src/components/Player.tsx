import { useEffect, useRef } from "react";

type Track = { id: number; title: string };
type Props = { currentTrack?: Track | null; token: string; clientId: string };

function Player({ currentTrack, token }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    audioRef.current.src = `/api/stream?trackId=${currentTrack.id}&token=${encodeURIComponent(token)}`;
    audioRef.current.play().catch(() => {});
  }, [currentTrack, token]);

  return (
    <div>
      <div>{currentTrack ? currentTrack.title : "No track selected"}</div>
      <audio ref={audioRef} controls />
    </div>
  );
}

export default Player;
export { Player };
