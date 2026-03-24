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
  trackData?: any;
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

function getTrackArtwork(track: any) {
  return (
    track?.artwork_url?.replace?.("-large", "-t500x500") ||
    track?.user?.avatar_url?.replace?.("-large", "-t500x500") ||
    "/placeholder.png"
  );
}

export default function MobilePage() {
  const socketRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const [roomId, setRoomId] = useState("");
  const [host, setHost] = useState("localhost");
  const [originBase, setOriginBase] = useState(getClientAppBase());
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Connect to your desktop to sync playback and switch output.",
  );
  const [setupOpen, setSetupOpen] = useState(true);
  const [playback, setPlayback] = useState<PlaybackState>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [localTrack, setLocalTrack] = useState<any>(null);
  const [localPlaying, setLocalPlaying] = useState(false);
  const [localTime, setLocalTime] = useState(0);
  const [localDuration, setLocalDuration] = useState(0);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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

  const mobileLink = useMemo(() => {
    if (!roomId) return `${originBase}/mobile`;
    return `${originBase}/mobile?room=${encodeURIComponent(roomId)}`;
  }, [originBase, roomId]);

  const socketUrl = useMemo(() => {
    return getClientSocketUrl(originBase);
  }, [originBase]);

  const desktopProgressPercent =
    typeof playback.position === "number" &&
    typeof playback.duration === "number" &&
    playback.duration > 0
      ? Math.min((playback.position / playback.duration) * 100, 100)
      : 0;

  const localProgressPercent =
    localDuration > 0 ? Math.min((localTime / localDuration) * 100, 100) : 0;

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
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setConnectionState("disconnected");
    setStatusMessage("Disconnected.");
  };

  useEffect(() => {
    if (!roomId || typeof window === "undefined") return;
    const incomingRoom = new URL(window.location.href).searchParams.get("room");
    if (incomingRoom && incomingRoom === roomId) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socketUrl]);

  const runSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    setSearching(true);
    setLocalError(null);
    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}&limit=20`,
      );
      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Connect SoundCloud on this phone first."
            : `Search failed with ${response.status}`,
        );
      }
      const data = await response.json();
      setResults(Array.isArray(data.collection) ? data.collection : []);
    } catch (error) {
      setResults([]);
      setLocalError(
        error instanceof Error ? error.message : "Unable to search right now.",
      );
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = window.setTimeout(() => {
      void runSearch(query);
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const loadLocalTrack = async (track: any, startAt = 0) => {
    if (!track || !audioRef.current) return;
    setLocalTrack(track);
    setLoadingTrack(true);
    setLocalError(null);
    pendingSeekRef.current = startAt;

    try {
      audioRef.current.src = `/api/stream?trackId=${track.id}&proxy=1`;
      audioRef.current.load();
      await audioRef.current.play();
      setLocalPlaying(true);
    } catch (error) {
      setLocalPlaying(false);
      setLocalError(
        error instanceof Error
          ? error.message
          : "Unable to play this track on mobile.",
      );
    } finally {
      setLoadingTrack(false);
    }
  };

  const sendDesktopCommand = (command: string | Record<string, any>) => {
    if (!socketRef.current || connectionState !== "connected") {
      setStatusMessage("Connect to your desktop first.");
      setSetupOpen(true);
      return;
    }
    socketRef.current.emit("remote-command", {
      userId: roomId.trim(),
      command,
    });
  };

  const takePlaybackHere = async () => {
    if (!playback.trackData) {
      setStatusMessage("No desktop track is ready to take over yet.");
      return;
    }
    await loadLocalTrack(playback.trackData, playback.position || 0);
    sendDesktopCommand("pause");
    setStatusMessage("Playback moved to your phone.");
  };

  const sendPlaybackToDesktop = () => {
    if (!localTrack) {
      setStatusMessage("Start a track on your phone first.");
      return;
    }
    sendDesktopCommand({
      type: "load-track",
      track: localTrack,
      position: audioRef.current?.currentTime || 0,
      shouldPlay: true,
    });
    audioRef.current?.pause();
    setLocalPlaying(false);
    setStatusMessage("Playback moved to your desktop.");
  };

  const toggleLocalPlayPause = async () => {
    if (!audioRef.current) return;
    if (localPlaying) {
      audioRef.current.pause();
      setLocalPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setLocalPlaying(true);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Unable to resume playback.",
      );
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(mobileLink);
      setStatusMessage("Mobile link copied.");
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
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (!audioRef.current) return;
          setLocalTime(audioRef.current.currentTime);
          setLocalDuration(audioRef.current.duration || 0);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && pendingSeekRef.current !== null) {
            audioRef.current.currentTime = pendingSeekRef.current;
            pendingSeekRef.current = null;
          }
          setLocalDuration(audioRef.current?.duration || 0);
        }}
        onPause={() => setLocalPlaying(false)}
        onPlay={() => setLocalPlaying(true)}
      />

      <div
        style={{
          maxWidth: 520,
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
                Soundcloudy Mobile
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>
                Phone Player
              </div>
            </div>
            <button
              onClick={() => setSetupOpen((prev) => !prev)}
              style={secondaryButtonStyle}
            >
              {setupOpen ? "Hide Setup" : "Show Setup"}
            </button>
          </div>

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
              justifySelf: "start",
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

          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
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
                  Desktop room ID
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
                  Web app base URL
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
                  lineHeight: 1.45,
                  wordBreak: "break-all",
                }}
              >
                Share link: {mobileLink}
                <br />
                Socket: {host}:3001
              </div>
            </div>
          ) : null}
        </div>

        <div
          style={{
            ...glassCardStyle,
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Swap Output</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <button onClick={() => void takePlaybackHere()} style={controlButtonStyle}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Play Here</div>
              <div style={buttonHintStyle}>Take over the desktop song</div>
            </button>
            <button onClick={sendPlaybackToDesktop} style={controlButtonStyle}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Play on Desktop</div>
              <div style={buttonHintStyle}>Send this phone song back</div>
            </button>
          </div>
        </div>

        <div
          style={{
            ...glassCardStyle,
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Now Playing Here</div>
          <div
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 24,
              background:
                localTrack
                  ? `linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.58)), url("${getTrackArtwork(localTrack)}") center/cover`
                  : "linear-gradient(135deg, rgba(255,85,0,0.9), rgba(255,133,60,0.22))",
              minHeight: 260,
              display: "grid",
              alignItems: "end",
              padding: 18,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backdropFilter: localTrack ? "blur(18px)" : "none",
                background: "rgba(0,0,0,0.18)",
              }}
            />
            <div style={{ position: "relative", display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "88px 1fr",
                  gap: 14,
                  alignItems: "end",
                }}
              >
                <img
                  src={localTrack ? getTrackArtwork(localTrack) : "/placeholder.png"}
                  alt={localTrack?.title || "No local track"}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 20,
                    objectFit: "cover",
                    background: "rgba(255,255,255,0.08)",
                  }}
                />
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
                    {localTrack?.title || "Pick a song below"}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "rgba(255,255,255,0.72)",
                    }}
                  >
                    {localTrack?.user?.username || "Search and start playing on your phone"}
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
                    width: `${localProgressPercent}%`,
                    height: "100%",
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
                <span>{formatTime(localTime)}</span>
                <span>{formatTime(localDuration)}</span>
              </div>

              <button
                onClick={() => void toggleLocalPlayPause()}
                style={{
                  ...primaryButtonStyle,
                  justifySelf: "start",
                }}
              >
                {loadingTrack
                  ? "Loading..."
                  : localPlaying
                    ? "Pause on Phone"
                    : "Play on Phone"}
              </button>
            </div>
          </div>
          {localError ? (
            <div style={{ fontSize: 12, color: "#ffb3b3" }}>{localError}</div>
          ) : null}
        </div>

        <div
          style={{
            ...glassCardStyle,
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Desktop Playback</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: playback.artwork ? "64px 1fr" : "1fr",
              gap: 14,
              alignItems: "center",
            }}
          >
            {playback.artwork ? (
              <img
                src={playback.artwork}
                alt={playback.track || "Desktop track"}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 18,
                  objectFit: "cover",
                }}
              />
            ) : null}
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {playback.track || "Nothing synced yet"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.68)",
                  marginBottom: 8,
                }}
              >
                {playback.artist || "Waiting for desktop playback..."}
              </div>
              <div
                style={{
                  height: 4,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: `${desktopProgressPercent}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #ff5500, #ff8a3d)",
                  }}
                />
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.58)" }}>
                {formatTime(playback.position)} / {formatTime(playback.duration)}
              </div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <button
              onClick={() => sendDesktopCommand("prev")}
              style={secondaryButtonStyle}
            >
              Prev
            </button>
            <button
              onClick={() =>
                sendDesktopCommand(playback.playing ? "pause" : "play")
              }
              style={primaryButtonStyle}
            >
              {playback.playing ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => sendDesktopCommand("next")}
              style={secondaryButtonStyle}
            >
              Next
            </button>
          </div>
        </div>

        <div
          style={{
            ...glassCardStyle,
            padding: 18,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700 }}>Search & Play</div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tracks on SoundCloud"
            style={inputStyle}
          />
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.58)" }}>
            If search fails with auth, use the top-right SoundCloud connect
            helper on this phone first.
          </div>
          {searching ? (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.68)" }}>
              Searching...
            </div>
          ) : null}
          {results.map((track) => (
            <button
              key={track.id}
              onClick={() => void loadLocalTrack(track)}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr",
                gap: 12,
                alignItems: "center",
                width: "100%",
                textAlign: "left",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.05)",
                color: "white",
                borderRadius: 18,
                padding: 10,
                cursor: "pointer",
              }}
            >
              <img
                src={getTrackArtwork(track)}
                alt={track.title}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  objectFit: "cover",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginBottom: 4,
                  }}
                >
                  {track.title}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.62)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {track.user?.username || "Unknown"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
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
  gap: 6,
  alignContent: "center",
  minHeight: 86,
  padding: 14,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  textAlign: "left",
  cursor: "pointer",
};

const buttonHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.58)",
  lineHeight: 1.4,
};


