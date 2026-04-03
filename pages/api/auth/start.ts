import type { NextApiRequest, NextApiResponse } from "next";
import { getConnectStore } from "../../../apps/backend/src/server/auth/connectStore";
import {
  generateCodeChallenge,
  generateCodeVerifier,
} from "../../../apps/backend/src/server/auth/pkce";
import { getAuthCallbackUrl } from "../../../apps/backend/src/server/http/origin";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const codes = getConnectStore();
  const { connect_code } = req.query;
  if (!connect_code || typeof connect_code !== "string")
    return res.status(400).json({ error: "missing connect_code" });

  const existingEntry = codes.get(connect_code);
  if (!existingEntry)
    return res.status(404).json({ error: "invalid connect_code" });

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  if (!clientId)
    return res.status(500).json({ error: "SOUNDCLOUD_CLIENT_ID not set" });

  const redirectUri = getAuthCallbackUrl(req);
  const state = connect_code;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  codes.set(connect_code, {
    ...existingEntry,
    codeVerifier,
    status: "pending",
    createdAt: Date.now(),
  });

  res.setHeader(
    "Set-Cookie",
    `soundcloud_code_verifier=${codeVerifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
  );

  const authUrl = `https://soundcloud.com/connect?client_id=${encodeURIComponent(
    clientId,
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=non-expiring&state=${encodeURIComponent(
    state,
  )}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;

  res.redirect(authUrl);
}
