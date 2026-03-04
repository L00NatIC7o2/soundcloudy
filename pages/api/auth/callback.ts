import type { NextApiRequest, NextApiResponse } from "next";

const codes = (globalThis.__SC_CONNECT_CODES ||= new Map<string, any>());

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code, state } = req.query;
  if (!code || typeof code !== "string")
    return res.status(400).json({ error: "missing code" });
  const connectCode = typeof state === "string" ? state : undefined;
  if (!connectCode || !codes.has(connectCode))
    return res.status(400).json({ error: "invalid state" });

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;
  const base = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`;
  const redirectUri = `${base.replace(/\/$/, "")}/api/auth/callback`;

  if (!clientId || !clientSecret)
    return res
      .status(500)
      .json({ error: "SOUNDCLOUD_CLIENT_ID/SECRET not set" });

  // Exchange code for token
  try {
    const tokenRes = await fetch("https://api.soundcloud.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code,
      }),
    });
    const tokenJson = await tokenRes.json();
    // store tokens under connectCode
    codes.set(connectCode, {
      ...(codes.get(connectCode) || {}),
      tokens: tokenJson,
      createdAt: Date.now(),
    });

    // show a simple page to inform the user they can close the window
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(
      `<html><body><h3>Authorization complete</h3><p>You can now return to your app. You may close this window.</p></body></html>`,
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "token exchange failed" });
  }
}
