import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { getConnectStore, type ConnectEntry } from "../../server/auth/connectStore";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

