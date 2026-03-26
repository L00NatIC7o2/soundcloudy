import { Server } from "socket.io";

const port = Number(process.env.PORT || 3001);
const io = new Server(port, { cors: { origin: "*" } });
const playbackByRoom = new Map();

io.on("connection", (socket) => {
  console.log("[socket] client connected", socket.id);

  socket.on("join", (payload, ack) => {
    const roomId =
      typeof payload === "string"
        ? payload
        : typeof payload?.roomId === "string"
          ? payload.roomId
          : null;
    const deviceId =
      typeof payload === "object" && typeof payload?.deviceId === "string"
        ? payload.deviceId
        : null;

    if (!roomId) {
      if (typeof ack === "function") {
        ack({ ok: false, error: "Missing room id" });
      }
      return;
    }

    socket.data.roomId = roomId;
    socket.data.deviceId = deviceId;
    socket.join(roomId);
    console.log("[socket] join", {
      socketId: socket.id,
      roomId,
      deviceId,
      cachedPlayback: Boolean(playbackByRoom.get(roomId)),
    });

    if (typeof ack === "function") {
      ack({
        ok: true,
        roomId,
        playbackState: playbackByRoom.get(roomId) || null,
      });
    }
  });

  socket.on("playback-update", ({ userId, deviceId, state }) => {
    const roomId = userId || socket.data.roomId;
    console.log("[socket] playback-update", {
      socketId: socket.id,
      roomId,
      deviceId: deviceId || socket.data.deviceId || null,
      trackId: state?.trackId || null,
      playing: state?.playing ?? null,
      position: typeof state?.position === "number" ? Math.round(state.position) : null,
    });

    let nextState = null;
    if (roomId && state) {
      nextState = {
        ...state,
        deviceId: deviceId || socket.data.deviceId || null,
      };
      playbackByRoom.set(roomId, nextState);
    }
    if (roomId && nextState) {
      socket.to(roomId).emit("playback-update", nextState);
    }
  });

  socket.on("remote-command", ({ userId, command }) => {
    const roomId = userId || socket.data.roomId;
    console.log("[socket] remote-command", {
      socketId: socket.id,
      roomId,
      command,
    });
    if (roomId) {
      socket.to(roomId).emit("remote-command", command);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnect", {
      socketId: socket.id,
      roomId: socket.data.roomId || null,
      deviceId: socket.data.deviceId || null,
      reason,
    });
  });
});

console.log(`Socket server listening on port ${port}`);
