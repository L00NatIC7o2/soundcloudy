import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code } = req.query as { code?: string };

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    // Exchange code for OAuth token from SoundCloud
    const tokenResp = await fetch("https://api.soundcloud.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
        client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback`,
        scope: "non-expiring",
      }).toString(),
    });

    const tokenData = await tokenResp.json();
    console.log("Token response:", tokenData);

    if (!tokenResp.ok) {
      return res
        .status(400)
        .json({ error: tokenData.error_description || "Auth failed" });
    }

    // Store the oauth_token in a secure cookie or session
    res.setHeader(
      "Set-Cookie",
      `soundcloud_token=${tokenData.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );

    res.redirect("/");
  } catch (err: any) {
    console.error("Auth callback error:", err);
    res.status(500).json({ error: err.message });
  }
}
