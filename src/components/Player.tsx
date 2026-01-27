import { useEffect, useRef } from "react";

type Track = { id: number; title: string };
type Props = { currentTrack?: Track | null; token: string; clientId: string };

function Player({ currentTrack, token, clientId }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    const url = `/api/stream?trackId=${currentTrack.id}&token=${encodeURIComponent(
      token,
    )}&clientId=${encodeURIComponent(clientId)}`;
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
  }, [currentTrack, token, clientId]);

  return (
    <div>
      <div>{currentTrack ? currentTrack.title : "No track selected"}</div>
      <audio ref={audioRef} controls />
    </div>
  );
}

export default Player;
export { Player };
