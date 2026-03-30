import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getConnectStore, type ConnectEntry } from "../../server/auth/connectStore";
import { getAllowedCorsOrigin } from "../../server/http/origin";

function applyCors(req: NextApiRequest, res: NextApiResponse) {
  const allowedOrigin = getAllowedCorsOrigin(req);
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const store = getConnectStore();

  const connectCode = randomBytes(6).toString("hex");
  const expires_in = 300; // 5 minutes
  const entry: ConnectEntry = {
    createdAt: Date.now(),
    expires_in,
    status: "pending",
  };

  store.set(connectCode, entry);

  return res.status(200).json({ connect_code: connectCode, expires_in });
}
