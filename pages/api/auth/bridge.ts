import type { NextApiRequest, NextApiResponse } from "next";

import { randomBytes } from "crypto";

type ConnectEntry = {
  createdAt: number;
  expires_in: number;
  status?: "pending" | "complete";
  tokens?: any;
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const globalAny = globalThis as any;
  if (!globalAny.__SC_CONNECT_CODES)
    globalAny.__SC_CONNECT_CODES = new Map<string, ConnectEntry>();
  const store: Map<string, ConnectEntry> = globalAny.__SC_CONNECT_CODES;

  const connectCode = randomBytes(6).toString("hex");
  const expires_in = 300; // seconds
  const entry: ConnectEntry = {
    createdAt: Date.now(),
    expires_in,
    status: "pending",
  };
  store.set(connectCode, entry);

  return res.status(200).json({ connect_code: connectCode, expires_in });
}
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const nonce = typeof req.query.nonce === "string" ? req.query.nonce : null;
  if (!nonce) {
    return res.status(400).json({ error: "Missing nonce" });
  }

  const store: Map<string, any> | undefined = (globalThis as any)
    .__scAuthBridgeStore;
  const entry = store?.get(nonce);
  if (!entry) {
    return res.status(401).json({ error: "Invalid or expired nonce" });
  }

  store?.delete(nonce);

  const cookies = [
    `soundcloud_token=${entry.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${entry.expires_in || 3600}`,
  ];

  if (entry.refresh_token) {
    cookies.push(
      `soundcloud_refresh_token=${entry.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    );
  }

  res.setHeader("Set-Cookie", cookies);
  res.redirect(302, "/");
}
