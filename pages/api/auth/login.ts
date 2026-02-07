import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const requestedRedirect =
    typeof req.query.redirect_uri === "string" ? req.query.redirect_uri : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const redirectUri = requestedRedirect
    ? requestedRedirect
    : process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL}/api/auth/callback`
      : undefined;

  if (!clientId || !redirectUri) {
    return res.status(500).json({
      error: "Missing SOUNDCLOUD_CLIENT_ID or NEXTAUTH_URL env vars",
    });
  }

  const url = new URL("https://soundcloud.com/connect");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "non-expiring");
  if (state) {
    url.searchParams.set("state", state);
  }

  res.redirect(url.toString());
}
