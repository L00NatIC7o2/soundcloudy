import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import "../src/styles/main.css";
import { getClientAppBase } from "../src/lib/runtimeConfig";

export default function MyApp({ Component, pageProps }: AppProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [scTokens, setScTokens] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);
  const [remoteBaseUrl, setRemoteBaseUrl] = useState(getClientAppBase());
  const [remoteBaseInput, setRemoteBaseInput] = useState(getClientAppBase());
  const [helperOpen, setHelperOpen] = useState(false);
  const [remotePanelOpen, setRemotePanelOpen] = useState(false);
  const connectWidgetTop =
    typeof window !== "undefined" &&
    (window as any).electronAPI?.windowControls
      ? 42
      : "calc(env(safe-area-inset-top) + 8px)";

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // Service worker registration failed - not critical
      });
    }

    if (typeof window !== "undefined") {
      const existingDeviceId = localStorage.getItem("soundcloudy_device_id");
      if (!existingDeviceId) {
        const id = Math.random().toString(36).slice(2);
        localStorage.setItem("soundcloudy_device_id", id);
      }

      const tokens = localStorage.getItem("soundcloudy_tokens");
      if (tokens) setScTokens(JSON.parse(tokens));

      const savedRemoteBase = localStorage.getItem("soundcloudy_remote_base");
      if (savedRemoteBase) {
        setRemoteBaseUrl(savedRemoteBase);
        setRemoteBaseInput(savedRemoteBase);
      }

      const electronApi = (window as any).electronAPI;
      if (!savedRemoteBase && electronApi?.getLocalNetworkUrl) {
        electronApi
          .getLocalNetworkUrl()
          .then((url: string) => {
            if (url) {
              setRemoteBaseUrl(url);
              setRemoteBaseInput(url);
            }
          })
          .catch(() => {});
      } else if (!savedRemoteBase) {
        const base = getClientAppBase(window.location.origin);
        setRemoteBaseUrl(base);
        setRemoteBaseInput(base);
      }

      fetch("/api/auth/session")
        .then(async (response) => {
          if (!response.ok) return null;
          return response.json();
        })
        .then((session) => {
          if (session?.roomId) {
            setUserId(session.roomId);
          }
        })
        .catch(() => {});
    }
  }, []);

  const connectSoundCloud = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const res = await fetch(`/api/auth/bridge`, { method: "POST" });
      const json = await res.json();
      const code = json.connect_code;
      const startUrl = `/api/auth/start?connect_code=${code}`;
      const electronApi = (window as any).electronAPI;
      if (electronApi?.openExternal) {
        await electronApi.openExternal(`${window.location.origin}${startUrl}`);
      } else {
        window.open(startUrl, "_blank");
      }

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

  const remoteLink = useMemo(() => {
    if (!userId) return `${remoteBaseUrl}/mobile`;
    return `${remoteBaseUrl}/mobile?room=${encodeURIComponent(userId)}`;
  }, [remoteBaseUrl, userId]);

  const qrCodeUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(remoteLink)}`;
  }, [remoteLink]);

  const remoteUsesLocalhost = useMemo(() => {
    return /:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(remoteBaseUrl);
  }, [remoteBaseUrl]);

  const saveRemoteBase = () => {
    const next = remoteBaseInput.trim().replace(/\/$/, "");
    if (!next) return;
    setRemoteBaseUrl(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("soundcloudy_remote_base", next);
    }
  };

  const openRemoteInBrowser = async () => {
    const electronApi = (window as any).electronAPI;
    if (electronApi?.openExternal) {
      await electronApi.openExternal(remoteLink);
      return;
    }
    window.open(remoteLink, "_blank");
  };

  const copyRemoteLink = async () => {
    try {
      await navigator.clipboard.writeText(remoteLink);
    } catch (error) {
      console.error("Failed to copy remote link:", error);
    }
  };

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Soundcloudy" />
      </Head>
      <Component {...pageProps} />
      {userId && (
        <>
          <button
            onClick={() => setHelperOpen((prev) => !prev)}
            style={{
              position: "fixed",
              top: connectWidgetTop,
              right: 8,
              padding: "9px 12px",
              fontSize: 12,
              background: "rgba(0,0,0,0.78)",
              color: "#fff",
              borderRadius: 999,
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              gap: 8,
              backdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
            }}
          >
            <span>{helperOpen ? "Hide Setup" : "Show Setup"}</span>
            <span
              style={{
                fontSize: 11,
                opacity: 0.72,
              }}
            >
              {scTokens ? "Connected" : "Disconnected"}
            </span>
          </button>
          {helperOpen ? (
            <div
              style={{
                position: "fixed",
                top:
                  typeof window !== "undefined" &&
                  (window as any).electronAPI?.windowControls
                    ? 84
                    : "calc(env(safe-area-inset-top) + 50px)",
                right: 8,
                padding: "10px 12px",
                fontSize: 12,
                background: "rgba(0,0,0,0.72)",
                color: "#fff",
                borderRadius: 10,
                zIndex: 9999,
                display: "grid",
                gap: 10,
                width: 230,
                backdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div>ID: {userId}</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>
                  {scTokens
                    ? "SoundCloud: connected"
                    : "SoundCloud: disconnected"}
                </div>
              </div>

              <button onClick={connectSoundCloud} style={{ padding: "6px 8px" }}>
                {scTokens
                  ? "Refresh"
                  : connecting
                    ? "Connecting..."
                    : "Connect"}
              </button>

              <div
                style={{
                  display: "grid",
                  gap: 6,
                  paddingTop: 2,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <button
                  onClick={() => setRemotePanelOpen((prev) => !prev)}
                  style={{ padding: "6px 8px" }}
                >
                  {remotePanelOpen ? "Hide Remote Setup" : "Show Remote Setup"}
                </button>
                {remotePanelOpen ? (
                  <>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>
                      Remote Setup
                    </div>
                    <input
                      value={remoteBaseInput}
                      onChange={(event) => setRemoteBaseInput(event.target.value)}
                      placeholder="http://192.168.1.25:3000"
                      style={{
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.06)",
                        color: "#fff",
                        fontSize: 12,
                      }}
                    />
                    <button
                      onClick={saveRemoteBase}
                      style={{ padding: "6px 8px" }}
                    >
                      Save Remote Base
                    </button>
                    {remoteUsesLocalhost ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#ffb3b3",
                          lineHeight: 1.35,
                        }}
                      >
                        This link still uses localhost. Replace it with your
                        computer&apos;s LAN IP like `http://192.168.x.x:3000`
                        before scanning on your phone.
                      </div>
                    ) : null}
                    <img
                      src={qrCodeUrl}
                      alt="Remote QR code"
                      style={{
                        width: 140,
                        height: 140,
                        justifySelf: "center",
                        borderRadius: 10,
                        background: "#fff",
                        padding: 6,
                      }}
                    />
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.7,
                        wordBreak: "break-all",
                      }}
                    >
                      {remoteLink}
                    </div>
                    <button
                      onClick={openRemoteInBrowser}
                      style={{ padding: "6px 8px" }}
                    >
                      Open Mobile In Browser
                    </button>
                    <button
                      onClick={copyRemoteLink}
                      style={{ padding: "6px 8px" }}
                    >
                      Copy Remote Link
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}



