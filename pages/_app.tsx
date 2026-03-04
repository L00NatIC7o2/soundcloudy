import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import "../src/styles/main.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [scTokens, setScTokens] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // Service worker registration failed - not critical
      });
    }
    // populate user id for display
    if (typeof window !== "undefined") {
      const existing = localStorage.getItem("soundcloudy_user_id");
      if (existing) setUserId(existing);
      else {
        const id = Math.random().toString(36).slice(2);
        localStorage.setItem("soundcloudy_user_id", id);
        setUserId(id);
      }
      const tokens = localStorage.getItem("soundcloudy_tokens");
      if (tokens) setScTokens(JSON.parse(tokens));
    }
  }, []);

  const connectSoundCloud = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const res = await fetch(`/api/auth/bridge`, { method: "POST" });
      const json = await res.json();
      const code = json.connect_code;
      // open auth in new tab
      window.open(`/api/auth/start?connect_code=${code}`, "_blank");

      // poll for completion
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const c = await fetch(`/api/auth/complete?connect_code=${code}`);
        if (c.status === 200) {
          const body = await c.json();
          localStorage.setItem(
            "soundcloudy_tokens",
            JSON.stringify(body.tokens),
          );
          setScTokens(body.tokens);
          break;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <>
      <Component {...pageProps} />
      {userId && (
        <div
          style={{
            position: "fixed",
            top: 8,
            right: 8,
            padding: "6px 10px",
            fontSize: 12,
            background: "rgba(0,0,0,0.65)",
            color: "#fff",
            borderRadius: 6,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div>ID: {userId}</div>
          <div style={{ fontSize: 11, opacity: 0.9 }}>
            {scTokens ? "SoundCloud: connected" : "SoundCloud: disconnected"}
          </div>
          <button onClick={connectSoundCloud} style={{ padding: "4px 8px" }}>
            {scTokens ? "Refresh" : connecting ? "Connecting..." : "Connect"}
          </button>
        </div>
      )}
    </>
  );
}
