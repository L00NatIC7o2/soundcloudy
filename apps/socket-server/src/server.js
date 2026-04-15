import http from "http";
import { attachSocketServer } from "../../../server/socket-io.cjs";

const port = Number(process.env.PORT || 3001);
const host = process.env.HOSTNAME || "0.0.0.0";

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

attachSocketServer(server);

server.listen(port, host, () => {
  console.log(`Socket server listening on http://${host}:${port}`);
});
