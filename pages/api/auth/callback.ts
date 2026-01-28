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

    console.log("Exchanging code for token with:", {
      client_id: process.env.SOUNDCLOUD_CLIENT_ID,
      redirect_uri: redirectUri,
    });

    // Use application/x-www-form-urlencoded format
    const params = new URLSearchParams({
      client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
      client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: code,
    });

    const response = await axios.post(
      "https://api.soundcloud.com/oauth2/token",
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    const { access_token, refresh_token, expires_in } = response.data;

    if (!access_token) {
      throw new Error("No access token in response");
    }

    console.log("Token received successfully, expires in:", expires_in);

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

    // Show more detailed error
    const errorMsg =
      error.response?.data?.error_description ||
      error.response?.data?.error ||
      "auth_failed";

    res.redirect(`/login?error=${encodeURIComponent(errorMsg)}`);
  }
}
