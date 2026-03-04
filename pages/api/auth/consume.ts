import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const nonce = typeof req.query.nonce === "string" ? req.query.nonce : null;

  if (!nonce) {
    return res.status(400).json({ error: "Missing nonce" });
  }

  const store = (globalThis as any).__SC_CONNECT_CODES;
  const entry = store?.get(nonce);

  if (!entry || !entry.tokens) {
    return res.status(401).json({ error: "Invalid or incomplete session" });
  }

  // Extract tokens
  const { access_token, refresh_token, expires_in } = entry.tokens;

  // Cleanup store
  store.delete(nonce);

  const isProd = process.env.NODE_ENV === "production";
  const cookies = [
    `soundcloud_token=${access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expires_in || 3600}${isProd ? "; Secure" : ""}`,
  ];

  if (refresh_token) {
    cookies.push(
      `soundcloud_refresh_token=${refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${isProd ? "; Secure" : ""}`,
    );
  }

  res.setHeader("Set-Cookie", cookies);
  res.redirect(302, "/");
}
