import { useEffect, useRef } from "react";

type Track = {
  id: number;
  title: string;
  stream_url?: string;
  media?: { transcodings?: { url: string; format?: { protocol?: string } }[] };
};
type Props = { currentTrack?: Track | null; token: string; clientId: string };

function Player({ currentTrack, token }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    let canceled = false;

    (async () => {
      try {
        // fetch full track to get media/stream_url
        const tResp = await fetch(
          `https://api.soundcloud.com/tracks/${currentTrack.id}`,
          { headers: { Authorization: `OAuth ${token}` } },
        );
        if (!tResp.ok) throw new Error(`track ${tResp.status}`);
        const track = await tResp.json();

        // try progressive first
        const prog = track.media?.transcodings?.find(
          (t: any) => t.format?.protocol === "progressive",
        );
        if (prog) {
          const sResp = await fetch(`${prog.url}?oauth_token=${token}`);
          if (sResp.ok) {
            const stream = await sResp.json();
            if (!canceled) {
              audioRef.current!.src = stream.url;
              await audioRef.current!.play().catch(() => {});
              return;
            }
          }
        }

        // fallback to stream_url with oauth_token
        if (track.stream_url && !canceled) {
          audioRef.current!.src = `${track.stream_url}?oauth_token=${token}`;
          await audioRef.current!.play().catch(() => {});
        } else {
          console.warn("No playable stream for track", track.id);
        }
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
