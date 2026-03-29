import { Server } from "socket.io";

const port = Number(process.env.PORT || 3001);
const io = new Server(port, { cors: { origin: "*" } });
const playbackByRoom = new Map();
const roomDevices = new Map();

function getRoomDeviceList(roomId) {
  return Array.from(roomDevices.get(roomId)?.values() || []);
}

function broadcastDevices(roomId) {
  io.to(roomId).emit("devices-update", {
    devices: getRoomDeviceList(roomId),
    activeDeviceId: playbackByRoom.get(roomId)?.deviceId || null,
  });
}

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
    const deviceMeta =
      typeof payload === "object" && payload?.deviceMeta && typeof payload.deviceMeta === "object"
        ? payload.deviceMeta
        : {};

    if (!roomId) {
      if (typeof ack === "function") {
        ack({ ok: false, error: "Missing room id" });
      }
      return;
    }

    socket.data.roomId = roomId;
    socket.data.deviceId = deviceId;
    socket.data.deviceMeta = deviceMeta;
    socket.join(roomId);

    const devices = roomDevices.get(roomId) || new Map();
    devices.set(socket.id, {
      socketId: socket.id,
      deviceId: deviceId || socket.id,
      kind: typeof deviceMeta?.kind === "string" ? deviceMeta.kind : "web",
      platform: typeof deviceMeta?.platform === "string" ? deviceMeta.platform : "unknown",
      label: typeof deviceMeta?.label === "string" ? deviceMeta.label : null,
      isCurrent: false,
    });
    roomDevices.set(roomId, devices);
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
        devices: getRoomDeviceList(roomId),
      });
    }

    broadcastDevices(roomId);
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
      broadcastDevices(roomId);
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
    const roomId = socket.data.roomId || null;
    if (roomId && roomDevices.has(roomId)) {
      const devices = roomDevices.get(roomId);
      devices.delete(socket.id);
      if (devices.size === 0) {
        roomDevices.delete(roomId);
      } else {
        roomDevices.set(roomId, devices);
      }
      broadcastDevices(roomId);
    }

    console.log("[socket] disconnect", {
      socketId: socket.id,
      roomId,
      deviceId: socket.data.deviceId || null,
      reason,
    });
  });
});

console.log(`Socket server listening on port ${port}`);
