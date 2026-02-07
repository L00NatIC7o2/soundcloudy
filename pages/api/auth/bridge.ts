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
