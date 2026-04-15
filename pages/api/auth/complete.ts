import type { NextApiRequest, NextApiResponse } from "next";
import { getConnectStore } from "../../../apps/backend/src/server/auth/connectStore";

const DEFAULT_REMOTE_API_URL = "https://soundcloudy-app.onrender.com";

function getRequestOrigin(req: NextApiRequest) {
  const protoHeader = req.headers["x-forwarded-proto"];
  const hostHeader = req.headers["x-forwarded-host"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || "http";
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader || req.headers.host;
  return host ? `${proto}://${host}`.replace(/\/$/, "") : "";
}

function getRemoteApiBase(req: NextApiRequest) {
  const configured = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_REMOTE_API_URL).replace(/\/$/, "");
  const requestOrigin = getRequestOrigin(req);
  if (!configured || configured === requestOrigin) {
    return null;
  }
  return configured;
}

function handleLocalComplete(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const connectCode =
    typeof req.query.connect_code === "string" ? req.query.connect_code : null;

  if (!connectCode) {
    return res.status(400).json({ error: "missing connect_code" });
  }

  const codes = getConnectStore();
  const entry = codes.get(connectCode);
  if (!entry) return res.status(404).json({ error: "invalid connect_code" });
  if (!entry.tokens) return res.status(202).json({ status: "pending" });

  return res.json({ status: "complete", tokens: entry.tokens, source: "local" });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const remoteApiBase = getRemoteApiBase(req);
  if (!remoteApiBase) {
    return handleLocalComplete(req, res);
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const connectCode =
    typeof req.query.connect_code === "string" ? req.query.connect_code : null;

  if (!connectCode) {
    return res.status(400).json({ error: "missing connect_code" });
  }

  try {
    const response = await fetch(
      `${remoteApiBase}/api/auth/complete?connect_code=${encodeURIComponent(connectCode)}`,
    );
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text ? { raw: text } : null;
    }
    return res.status(response.status).json(body);
  } catch (error) {
    console.error("[auth complete proxy] failed", {
      remoteApiBase,
      connectCode,
      message: error instanceof Error ? error.message : String(error),
    });
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to reach auth backend",
      remoteApiBase,
    });
  }
}

