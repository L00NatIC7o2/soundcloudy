import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getConnectStore, type ConnectEntry } from "../../../apps/backend/src/server/auth/connectStore";

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

function handleLocalBridge(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const store = getConnectStore();
  const connectCode = randomBytes(6).toString("hex");
  const expires_in = 300;
  const entry: ConnectEntry = {
    createdAt: Date.now(),
    expires_in,
    status: "pending",
  };
  store.set(connectCode, entry);
  return res.status(200).json({ connect_code: connectCode, expires_in, source: "local" });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const remoteApiBase = getRemoteApiBase(req);
  if (!remoteApiBase) {
    return handleLocalBridge(req, res);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(`${remoteApiBase}/api/auth/bridge`, {
      method: "POST",
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text ? { raw: text } : null;
    }
    return res.status(response.status).json(body);
  } catch (error) {
    console.error("[auth bridge proxy] failed", {
      remoteApiBase,
      message: error instanceof Error ? error.message : String(error),
    });
    return res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to reach auth backend",
      remoteApiBase,
    });
  }
}

