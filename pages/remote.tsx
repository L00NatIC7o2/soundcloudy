import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

type PlaybackState = {
  playing?: boolean;
  track?: string;
  position?: number;
};

export default function Remote() {
  const [userId, setUserId] = useState("");
  const [connected, setConnected] = useState(false);
  const [playback, setPlayback] = useState<PlaybackState>({});
  const [host, setHost] = useState("localhost");
  const socketRef = useRef<any>(null);

  useEffect(() => {
    // compute hostname on client only
    if (typeof window !== "undefined") {
      setHost(window.location.hostname);
    }

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const connect = () => {
    if (!userId) return alert("Enter your user id to join room");
    const origin =
      typeof window !== "undefined" ? window.location.hostname : "localhost";
    const url = `${window.location.protocol}//${origin}:3001`;
    const socket = io(url, { transports: ["websocket"], reconnection: true });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.emit("join", userId);

    socket.on("playback-update", (state: PlaybackState) => {
      setPlayback(state || {});
    });

    socket.on("remote-command", (command: string) => {
      if (command === "play") setPlayback((p) => ({ ...p, playing: true }));
      if (command === "pause") setPlayback((p) => ({ ...p, playing: false }));
    });
  };

  const sendUpdate = (state: PlaybackState) => {
    if (!socketRef.current || !connected) return alert("Not connected");
    socketRef.current.emit("playback-update", { userId, state });
  };

  const sendCommand = (command: string) => {
    if (!socketRef.current || !connected) return alert("Not connected");
    socketRef.current.emit("remote-command", { userId, command });
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h2>Remote Control</h2>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6 }}>
          User ID (room)
        </label>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="paste your desktop user id"
          style={{ padding: 8, width: "100%", maxWidth: 360 }}
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={connect} style={{ marginRight: 8 }}>
            Connect
          </button>
          <span style={{ marginLeft: 8 }}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <h4>Playback State</h4>
        <div>Track: {playback.track || "—"}</div>
        <div>Playing: {playback.playing ? "Yes" : "No"}</div>
        <div>
          Position:{" "}
          {typeof playback.position === "number"
            ? `${playback.position}s`
            : "—"}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => sendCommand("prev")} style={{ marginRight: 8 }}>
          Prev
        </button>
        <button
          onClick={() => {
            const cmd = playback.playing ? "pause" : "play";
            sendCommand(cmd);
          }}
          style={{ marginRight: 8 }}
        >
          {playback.playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => sendCommand("next")} style={{ marginRight: 8 }}>
          Next
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4>Send Full Playback Update</h4>
        <div style={{ marginBottom: 8 }}>
          <input
            id="trackInput"
            placeholder="Track name"
            style={{ padding: 8, width: 260, marginRight: 8 }}
          />
          <input
            id="posInput"
            placeholder="Position (s)"
            type="number"
            style={{ padding: 8, width: 120, marginRight: 8 }}
          />
          <button
            onClick={() => {
              const track = (
                document.getElementById("trackInput") as HTMLInputElement
              ).value;
              const pos = Number(
                (document.getElementById("posInput") as HTMLInputElement)
                  .value || 0,
              );
              sendUpdate({
                track: track || undefined,
                position: isNaN(pos) ? undefined : pos,
                playing: playback.playing,
              });
            }}
          >
            Send Update
          </button>
        </div>
      </div>

      <div style={{ marginTop: 20, color: "#666", fontSize: 13 }}>
        <div>
          Tip: open this page on your iPhone using your computer's IP:{" "}
          <strong>{host}:3000/remote</strong>
        </div>
        <div>
          Make sure the socket server is running:{" "}
          <em>[server/socket-server.js]</em> (port 3001)
        </div>
      </div>
    </div>
  );
}
