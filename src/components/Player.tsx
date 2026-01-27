import { useEffect, useRef } from "react";

type Track = { id: number; title: string };
type Props = { currentTrack?: Track | null; token: string; clientId: string };

function Player({ currentTrack, token }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    let canceled = false;

    (async () => {
      try {
        const resp = await fetch(
          `https://api.soundcloud.com/tracks/${currentTrack.id}`,
          { headers: { Authorization: `OAuth ${token}` } },
        );
        if (!resp.ok) throw new Error(`track fetch ${resp.status}`);
        const track = await resp.json();

        if (canceled) return;
        const streamUrl = `${track.stream_url}?oauth_token=${token}`;
        audioRef.current!.src = streamUrl;
        await audioRef.current!.play().catch(() => {});
      } catch (e) {
        console.error("Player stream error:", e);
      }
    })();

    return () => {
      canceled = true;
    };
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
