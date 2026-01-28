import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    const response = await axios.post(
      "https://api.soundcloud.com/oauth2/token",
      {
        client_id: process.env.SOUNDCLOUD_CLIENT_ID,
        client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET,
        grant_type: "authorization_code",
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback`,
        code,
        scope: "non-expiring",
      },
    );

    const { access_token } = response.data;

    // Set token in secure HTTP-only cookie
    res.setHeader(
      "Set-Cookie",
      `soundcloud_token=${access_token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000`,
    );

    // Redirect to home
    res.redirect(302, "/");
  } catch (error: any) {
    console.error(
      "Auth callback error:",
      error.response?.data || error.message,
    );
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message,
    });
  }
}
