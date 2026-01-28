import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code, error } = req.query;

  if (error) {
    res.redirect(`/login?error=${error}`);
    return;
  }

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing authorization code" });
    return;
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback`;

    const response = await axios.post(
      "https://api.soundcloud.com/oauth2/token",
      {
        client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
        // Remove scope: "non-expiring"
      },
    );

    const { access_token, refresh_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error("No access token in response");
    }

    console.log("Token received, expires in:", expires_in);

    // Store both access and refresh tokens
    const cookies = [
      `soundcloud_token=${access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expires_in || 3600}`,
    ];

    if (refresh_token) {
      cookies.push(
        `soundcloud_refresh_token=${refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
      );
    }

    res.setHeader("Set-Cookie", cookies);
    res.redirect(302, "/");
  } catch (error: any) {
    console.error(
      "Auth callback error:",
      error.response?.data || error.message,
    );
    res.redirect(`/login?error=auth_failed`);
  }
}
