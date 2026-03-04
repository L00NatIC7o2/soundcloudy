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

  // Ensure global store exists
  const globalAny = globalThis as any;
  if (!globalAny.__SC_CONNECT_CODES) {
    globalAny.__SC_CONNECT_CODES = new Map<string, ConnectEntry>();
  }
  const store: Map<string, ConnectEntry> = globalAny.__SC_CONNECT_CODES;

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
