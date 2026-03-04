import type { NextApiRequest, NextApiResponse } from "next";

const codes = (globalThis.__SC_CONNECT_CODES ||= new Map<string, any>());

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { connect_code } = req.query;
  if (!connect_code || typeof connect_code !== "string")
    return res.status(400).json({ error: "missing connect_code" });
  if (!codes.has(connect_code))
    return res.status(404).json({ error: "invalid connect_code" });

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const base = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`;
  if (!clientId)
    return res.status(500).json({ error: "SOUNDCLOUD_CLIENT_ID not set" });

  const redirectUri = `${base.replace(/\/$/, "")}/api/auth/callback`;
  const state = connect_code; // pass connect code through state

  const authUrl = `https://soundcloud.com/connect?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=non-expiring&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
}
