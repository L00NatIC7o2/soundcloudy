import { Server } from "socket.io";

const io = new Server(3001, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("join", (userId) => {
    socket.join(userId); // Use userId as room
  });

  socket.on("playback-update", ({ userId, state }) => {
    socket.to(userId).emit("playback-update", state);
  });

  socket.on("remote-command", ({ userId, command }) => {
    socket.to(userId).emit("remote-command", command);
  });
});
