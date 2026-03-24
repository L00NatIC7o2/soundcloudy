import { useEffect, useMemo, useRef, useState } from "react";
import io from "socket.io-client";
import { getClientAppBase, getClientSocketUrl } from "../src/lib/runtimeConfig";

type PlaybackState = {
  playing?: boolean;
  track?: string;
  artist?: string;
  artwork?: string;
  position?: number;
  duration?: number;
};

type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  color: "white",
  background:
    "radial-gradient(circle at top, rgba(255,85,0,0.26), transparent 34%), linear-gradient(180deg, #111 0%, #050505 100%)",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const glassCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 24,
  backdropFilter: "blur(22px)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.28)",
};

function formatTime(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    return "0:00";
  }
  const mins = Math.floor(value / 60);
  const secs = Math.floor(value % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Remote() {
  const socketRef = useRef<any>(null);
  const [roomId, setRoomId] = useState("");
  const [host, setHost] = useState("localhost");
  const [originBase, setOriginBase] = useState(getClientAppBase());
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Connect to your desktop to start controlling playback.",
  );
  const [playback, setPlayback] = useState<PlaybackState>({});
  const [setupOpen, setSetupOpen] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const detectedBase = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}`;
    const incomingRoom =
      url.searchParams.get("room") ||
      url.searchParams.get("userId") ||
      url.searchParams.get("code") ||
      "";

    setHost(url.hostname || "localhost");
    setOriginBase(getClientAppBase(detectedBase));
    if (incomingRoom) {
      setRoomId(incomingRoom);
      setSetupOpen(false);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const remoteLink = useMemo(() => {
    if (!roomId) return `${originBase}/remote`;
    return `${originBase}/remote?room=${encodeURIComponent(roomId)}`;
  }, [originBase, roomId]);

  const socketUrl = useMemo(() => {
    return getClientSocketUrl(originBase);
  }, [originBase]);

  const progressPercent =
    typeof playback.position === "number" &&
    typeof playback.duration === "number" &&
    playback.duration > 0
      ? Math.min((playback.position / playback.duration) * 100, 100)
      : 0;

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionState("disconnected");
    setStatusMessage("Disconnected.");
  };

  const connect = () => {
    const trimmedRoomId = roomId.trim();
    if (!trimmedRoomId) {
      setConnectionState("error");
      setStatusMessage("Enter a room ID first.");
      setSetupOpen(true);
      return;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setConnectionState("connecting");
    setStatusMessage("Connecting to your desktop...");

    const socket = io(socketUrl, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 800,
      timeout: 6000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatusMessage("Connected to socket. Joining your room...");
      socket.emit("join", trimmedRoomId, (response?: any) => {
        if (response?.ok) {
          setConnectionState("connected");
          setStatusMessage(`Connected to room ${trimmedRoomId}.`);
          if (response.playbackState) {
            setPlayback(response.playbackState);
          }
          setSetupOpen(false);
        } else {
          setConnectionState("error");
          setStatusMessage(response?.error || "Failed to join room.");
          setSetupOpen(true);
        }
      });
    });

    socket.on("disconnect", () => {
      setConnectionState("disconnected");
      setStatusMessage("Disconnected from remote server.");
    });

    socket.on("connect_error", (error: Error) => {
      setConnectionState("error");
      setStatusMessage(
        error?.message || "Unable to reach the remote socket server.",
      );
      setSetupOpen(true);
    });

    socket.on("playback-update", (state: PlaybackState) => {
      setPlayback(state || {});
    });

    socket.on("remote-command", (command: string) => {
      if (command === "play") setPlayback((prev) => ({ ...prev, playing: true }));
      if (command === "pause") {
        setPlayback((prev) => ({ ...prev, playing: false }));
      }
    });
  };

  useEffect(() => {
    if (!roomId || typeof window === "undefined") return;
    const incomingRoom = new URL(window.location.href).searchParams.get("room");
    if (incomingRoom && incomingRoom === roomId) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socketUrl]);

  const sendCommand = (command: string) => {
    if (!socketRef.current || connectionState !== "connected") {
      setStatusMessage("Connect first before sending commands.");
      setSetupOpen(true);
      return;
    }
    socketRef.current.emit("remote-command", {
      userId: roomId.trim(),
      command,
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(remoteLink);
      setStatusMessage("Remote link copied.");
    } catch {
      setStatusMessage("Unable to copy automatically. Copy the link manually.");
    }
  };

  const statusColor =
    connectionState === "connected"
      ? "#7CFFB2"
      : connectionState === "error"
        ? "#FF8F8F"
        : "#FFD97A";

  return (
    <div style={shellStyle}>
      <div
        style={{
          maxWidth: 460,
          margin: "0 auto",
          padding: "22px 18px 140px",
          display: "grid",
          gap: 18,
        }}
      >
        <div
          style={{
            ...glassCardStyle,
            padding: 20,
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.58)",
                  marginBottom: 6,
                }}
              >
                Soundcloudy Remote
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
                Mobile Control
              </div>
            </div>
            <button
              onClick={() => setSetupOpen((prev) => !prev)}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                borderRadius: 999,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {setupOpen ? "Hide Setup" : "Show Setup"}
            </button>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                color: statusColor,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: statusColor,
                  boxShadow: `0 0 16px ${statusColor}`,
                }}
              />
              {connectionState}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.58)",
              }}
            >
              Host: {host}:3000
            </div>
          </div>

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.74)",
            }}
          >
            {statusMessage}
          </div>

          {setupOpen ? (
            <div
              style={{
                display: "grid",
                gap: 12,
                paddingTop: 6,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                  Room ID
                </label>
                <input
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  placeholder="paste your desktop room id"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                  Web App Base URL
                </label>
                <input
                  value={originBase}
                  onChange={(event) => setOriginBase(event.target.value)}
                  placeholder="http://192.168.1.25:3000"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button onClick={connect} style={primaryButtonStyle}>
                  Connect
                </button>
                <button onClick={disconnect} style={secondaryButtonStyle}>
                  Disconnect
                </button>
                <button onClick={copyLink} style={secondaryButtonStyle}>
                  Copy Link
                </button>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.48)",
                  wordBreak: "break-all",
                  lineHeight: 1.45,
                }}
              >
                Share link: {remoteLink}
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            ...glassCardStyle,
            padding: 18,
            display: "grid",
            gap: 16,
          }}
        >
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 24,
              background:
                playback.artwork
                  ? `linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.58)), url("${playback.artwork}") center/cover`
                  : "linear-gradient(135deg, rgba(255,85,0,0.8), rgba(255,133,60,0.25))",
              minHeight: 250,
              display: "grid",
              alignItems: "end",
              padding: 18,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backdropFilter: playback.artwork ? "blur(18px)" : "none",
                background: "rgba(0,0,0,0.16)",
              }}
            />
            <div
              style={{
                position: "relative",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "88px 1fr",
                  gap: 14,
                  alignItems: "end",
                }}
              >
                <div
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 20,
                    overflow: "hidden",
                    background: "rgba(255,255,255,0.08)",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
                  }}
                >
                  {playback.artwork ? (
                    <img
                      src={playback.artwork}
                      alt={playback.track || "Current track"}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : null}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 800,
                      lineHeight: 1.1,
                      marginBottom: 6,
                      wordBreak: "break-word",
                    }}
                  >
                    {playback.track || "Nothing playing yet"}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,0.72)",
                    }}
                  >
                    {playback.artist || "Waiting for your desktop player..."}
                  </div>
                </div>
              </div>

              <div
                style={{
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.16)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #ff5500, #ff8a3d)",
                    transition: "width 220ms linear",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "rgba(255,255,255,0.68)",
                }}
              >
                <span>{formatTime(playback.position)}</span>
                <span>{formatTime(playback.duration)}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <button onClick={() => sendCommand("prev")} style={controlButtonStyle}>
              <IconPrev />
              <span>Prev</span>
            </button>
            <button
              onClick={() => sendCommand(playback.playing ? "pause" : "play")}
              style={{
                ...controlButtonStyle,
                background: "linear-gradient(135deg, #ff5500, #ff7c2f)",
                border: 0,
                color: "white",
              }}
            >
              {playback.playing ? <IconPause /> : <IconPlay />}
              <span>{playback.playing ? "Pause" : "Play"}</span>
            </button>
            <button onClick={() => sendCommand("next")} style={controlButtonStyle}>
              <IconNext />
              <span>Next</span>
            </button>
          </div>
        </div>

        <div
          style={{
            ...glassCardStyle,
            padding: 16,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Remote Tips</div>
          <div style={tipTextStyle}>
            Scan the QR from your desktop helper, then keep this page open like
            a mini mobile player.
          </div>
          <div style={tipTextStyle}>
            If nothing loads, make sure your phone and computer are on the same
            Wi-Fi and the socket server is running on port `3001`.
          </div>
        </div>
      </div>
    </div>
  );
}

function IconPrev() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="4" width="2" height="16" rx="1" />
      <path d="M19 5v14l-10-7z" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.5v13l10-6.5z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <rect x="7" y="5" width="3.5" height="14" rx="1" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5v14l10-7z" />
      <rect x="17" y="4" width="2" height="16" rx="1" />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  padding: "14px 16px",
  fontSize: 15,
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 999,
  padding: "12px 16px",
  background: "linear-gradient(135deg, #ff5500, #ff7c2f)",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 999,
  padding: "12px 16px",
  background: "rgba(255,255,255,0.06)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const controlButtonStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  gap: 6,
  minHeight: 82,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  fontWeight: 700,
  cursor: "pointer",
};

const tipTextStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  color: "rgba(255,255,255,0.68)",
};


