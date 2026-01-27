import { useEffect, useRef } from "react";

type Track = {
  id: number;
  title: string;
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
        const tResp = await fetch(
          `https://api.soundcloud.com/tracks/${currentTrack.id}`,
          { headers: { Authorization: `OAuth ${token}` } },
        );
        if (!tResp.ok) throw new Error(`track ${tResp.status}`);
        const track = await tResp.json();

        const prog = track.media?.transcodings?.find(
          (t: any) => t.format?.protocol === "progressive",
        );
        if (!prog) {
          console.warn("No progressive stream", track);
          return;
        }

        const sResp = await fetch(`${prog.url}?oauth_token=${token}`);
        if (!sResp.ok) throw new Error(`stream ${sResp.status}`);
        const stream = await sResp.json();

        if (canceled) return;
        audioRef.current!.src = stream.url;
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
