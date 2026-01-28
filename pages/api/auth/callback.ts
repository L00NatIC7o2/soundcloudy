import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/login?error=${error}`);
  }

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback`;

    console.log("Token request with:", {
      client_id: process.env.SOUNDCLOUD_CLIENT_ID,
      redirect_uri: redirectUri,
      code: code.substring(0, 20) + "...",
    });

    const response = await axios.post(
      "https://api.soundcloud.com/oauth2/token",
      {
        client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
        scope: "non-expiring",
      },
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      },
    );

    const { access_token } = response.data;

    if (!access_token) {
      throw new Error("No access token in response");
    }

    // Set token in secure HTTP-only cookie
    res.setHeader(
      "Set-Cookie",
      `soundcloud_token=${access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    );

    // Redirect to home
    return res.redirect(302, "/");
  } catch (error: any) {
    console.error(
      "Auth callback error:",
      error.response?.data || error.message,
    );
    return res.redirect(
      `/login?error=${encodeURIComponent(error.response?.data?.error_description || error.message)}`,
    );
  }
}
