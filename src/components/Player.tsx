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
        // Get stream URLs (progressive mp3)
        const resp = await fetch(
          `https://api.soundcloud.com/tracks/${currentTrack.id}/streams?client_id=${clientId}`,
          { headers: { Authorization: `OAuth ${token}` } },
        );
        if (!resp.ok) throw new Error(`streams ${resp.status}`);
        const streams = await resp.json();

        const mp3 = streams.http_mp3_128_url || streams.hls_mp3_128_url;
        if (!mp3) {
          console.warn(
            "No mp3 stream available for track",
            currentTrack.id,
            streams,
          );
          return;
        }

        if (canceled) return;
        audioRef.current!.src = mp3;
        await audioRef
          .current!.play()
          .catch((e) => console.warn("play error", e));
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
