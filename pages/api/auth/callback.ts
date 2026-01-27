import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error) {
    return res.redirect(`/?error=${error}`);
  }

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    console.log("Exchanging code for token...");

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

    if (!tokenResp.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return res.redirect(`/?error=token_exchange_failed`);
    }

    // Set secure cookie with the OAuth token
    res.setHeader(
      "Set-Cookie",
      `soundcloud_token=${tokenData.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    );

    console.log("Token stored successfully");
    res.redirect("/");
  } catch (err: any) {
    console.error("Auth callback error:", err);
    res.redirect(`/?error=auth_error`);
  }
}
