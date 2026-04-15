const http = require("http");
const next = require("next");

const { attachSocketServer } = require("./socket-io.cjs");

const port = Number(process.env.PORT || 10000);
const host = process.env.HOSTNAME || "0.0.0.0";
const dev = process.env.NODE_ENV !== "production";

async function start() {
  const app = next({ dev, hostname: host, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    handle(req, res);
  });

  attachSocketServer(server);

  server.listen(port, host, () => {
    console.log(`[server] Soundcloudy app listening on http://${host}:${port}`);
    console.log("[server] Next.js + Socket.IO merged server ready");
  });
}

start().catch((error) => {
  console.error("[server] fatal startup error", error);
  process.exit(1);
});
