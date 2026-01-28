import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const refreshToken = req.cookies.soundcloud_refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: "No refresh token" });
    }

    console.log("Refreshing token...");

    const params = new URLSearchParams({
      client_id: process.env.SOUNDCLOUD_CLIENT_ID!,
      client_secret: process.env.SOUNDCLOUD_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
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

    const newToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token || refreshToken;
    const expiresIn = response.data.expires_in || 3600;

    console.log("Token refreshed - expires in:", expiresIn);

    const cookies = [
      `soundcloud_token=${newToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${expiresIn}`,
      `soundcloud_refresh_token=${newRefreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    ];

    res.setHeader("Set-Cookie", cookies);
    res.json({ success: true, expiresIn });
  } catch (error: any) {
    console.error("Refresh error:", error.response?.data || error.message);
    res.status(401).json({ error: "Failed to refresh token" });
  }
}
