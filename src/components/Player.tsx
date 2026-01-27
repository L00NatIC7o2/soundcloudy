import { useEffect, useRef } from "react";

type Track = { id: number; title: string };
type Props = { currentTrack?: Track | null; token: string; clientId: string };

function Player({ currentTrack, token, clientId }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    let canceled = false;

    (async () => {
      try {
        const track = await fetch(
          `https://api.soundcloud.com/tracks/${currentTrack.id}?client_id=${clientId}`,
          { headers: { Authorization: `OAuth ${token}` } },
        ).then((r) => r.json());

        if (canceled) return;
        const streamUrl = `${track.stream_url}?client_id=${clientId}`;
        audioRef.current!.src = streamUrl;
        await audioRef.current!.play().catch(() => {});
      } catch (e) {
        console.error("Player stream error:", e);
      }
    })();

    return () => {
      canceled = true;
    };
  }, [currentTrack, clientId, token]);

  return (
    <div>
      <div>{currentTrack ? currentTrack.title : "No track selected"}</div>
      <audio ref={audioRef} controls />
    </div>
  );
}

export default Player;
export { Player };
