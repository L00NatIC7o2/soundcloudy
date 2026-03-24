import { Server } from "socket.io";

const port = Number(process.env.PORT || 3001);
const io = new Server(port, { cors: { origin: "*" } });
const playbackByRoom = new Map();

io.on("connection", (socket) => {
  socket.on("join", (userId, ack) => {
    if (!userId || typeof userId !== "string") {
      if (typeof ack === "function") {
        ack({ ok: false, error: "Missing room id" });
      }
      return;
    }

    socket.join(userId);

    if (typeof ack === "function") {
      ack({
        ok: true,
        roomId: userId,
        playbackState: playbackByRoom.get(userId) || null,
      });
    }
  });

  socket.on("playback-update", ({ userId, state }) => {
    if (userId && state) {
      playbackByRoom.set(userId, state);
    }
    socket.to(userId).emit("playback-update", state);
  });

  socket.on("remote-command", ({ userId, command }) => {
    socket.to(userId).emit("remote-command", command);
  });
});

console.log(`Socket server listening on port ${port}`);
